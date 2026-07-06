import Foundation
import LocalAuthentication
import Security

/// Secure Enclave custody of the master key, the design's one deliberate
/// loosening of "the key only lives in memory": after a passphrase unlock
/// the derived key is wrapped by an Enclave key that only releases under
/// the currently enrolled biometrics. Face ID carries daily use; the
/// passphrase is required again after 7 days, on biometric enrollment
/// change (biometryCurrentSet invalidates the key), passcode removal
/// (WhenPasscodeSetThisDeviceOnly evicts the items), or reinstall (nothing
/// is backed up or migrated).
enum KeyCustody {
    private static let keyTag = Data("org.traumabomen.companion.custody-key".utf8)
    private static let blobService = "org.traumabomen.companion.custody"
    static let maxAge: TimeInterval = 7 * 24 * 3600

    #if DEBUG
    /// The simulator has no passcode, and WhenPasscodeSetThisDeviceOnly
    /// (correctly) refuses without one. Tests flip this to a relaxed
    /// accessibility class so the biometric gate itself stays testable.
    /// Compiled out of release builds.
    static var relaxedForSimulatorTesting = false
    #endif

    private static var accessibility: CFString {
        #if DEBUG
        if relaxedForSimulatorTesting { return kSecAttrAccessibleWhenUnlockedThisDeviceOnly }
        #endif
        return kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly
    }

    private struct StoredBlob: Codable {
        let wrapped: Data
        let at: Date
    }

    enum CustodyError: Error {
        case accessControl, keyCreation, wrap, persist
    }

    /// Whether this device can offer biometric custody at all.
    static var isAvailable: Bool {
        var error: NSError?
        return LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    /// True when a wrapped key exists and is within the 7-day window.
    static func hasFreshKey() -> Bool {
        guard let blob = loadBlob() else { return false }
        guard Date().timeIntervalSince(blob.at) <= maxAge else {
            purge()
            return false
        }
        return true
    }

    /// Wrap and persist the master key under a fresh Enclave key.
    static func store(masterKey: Data) throws {
        purge()

        var flags: SecAccessControlCreateFlags = [.privateKeyUsage, .biometryCurrentSet]
        #if DEBUG
        // The simulator's Security daemon rejects biometry-bound Enclave
        // keys without real enrollment; relaxed test mode verifies the
        // wrap/persist/restore mechanics and leaves the biometric gate to
        // on-device verification.
        if relaxedForSimulatorTesting { flags = [.privateKeyUsage] }
        #endif
        var acError: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            nil,
            accessibility,
            flags,
            &acError
        ) else { throw CustodyError.accessControl }

        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: keyTag,
                kSecAttrAccessControl as String: access,
            ],
        ]
        var keyError: Unmanaged<CFError>?
        guard
            let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &keyError),
            let publicKey = SecKeyCopyPublicKey(privateKey)
        else {
            NSLog("custody: SecKeyCreateRandomKey error: %@",
                  keyError?.takeRetainedValue().localizedDescription ?? "nil")
            throw CustodyError.keyCreation
        }

        var encryptError: Unmanaged<CFError>?
        guard let wrapped = SecKeyCreateEncryptedData(
            publicKey,
            .eciesEncryptionCofactorVariableIVX963SHA256AESGCM,
            masterKey as CFData,
            &encryptError
        ) as Data? else { throw CustodyError.wrap }

        let blob = try JSONEncoder().encode(StoredBlob(wrapped: wrapped, at: Date()))
        let add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: blobService,
            kSecAttrAccessible as String: accessibility,
            kSecValueData as String: blob,
        ]
        guard SecItemAdd(add as CFDictionary, nil) == errSecSuccess else {
            throw CustodyError.persist
        }
    }

    /// Release the master key; the Enclave prompts Face ID via the key's
    /// access control. Returns nil on cancel, stale window, or a key
    /// invalidated by enrollment change (the passphrase path takes over).
    static func retrieve(reason: String) -> Data? {
        guard let blob = loadBlob() else { return nil }
        guard Date().timeIntervalSince(blob.at) <= maxAge else {
            purge()
            return nil
        }

        let context = LAContext()
        context.localizedReason = reason
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyTag,
            kSecUseAuthenticationContext as String: context,
            kSecReturnRef as String: true,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess else {
            purge()
            return nil
        }
        let privateKey = item as! SecKey

        var error: Unmanaged<CFError>?
        guard let master = SecKeyCreateDecryptedData(
            privateKey,
            .eciesEncryptionCofactorVariableIVX963SHA256AESGCM,
            blob.wrapped as CFData,
            &error
        ) as Data? else {
            // Cancel or invalidated key; not purged on cancel so the user
            // can try again. A truly invalidated key gets replaced on the
            // next passphrase unlock (store purges first).
            return nil
        }
        return master
    }

    static func purge() {
        SecItemDelete([
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: blobService,
        ] as CFDictionary)
        SecItemDelete([
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyTag,
        ] as CFDictionary)
    }

    private static func loadBlob() -> StoredBlob? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: blobService,
            kSecReturnData as String: true,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data
        else { return nil }
        return try? JSONDecoder().decode(StoredBlob.self, from: data)
    }
}
