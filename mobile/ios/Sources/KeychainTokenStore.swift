import Foundation
import Security
import TraumabomenCore

/// The core's TokenStore backed by the Keychain: the refresh token persists
/// (device-only, never backed up) so a relaunch can restore the session for
/// biometric unlock; the short-lived access token stays in memory and is
/// re-minted through rotation on the first 401. Tokens are auth-only and
/// carry no encryption material.
final class KeychainTokenStore: TokenStore {
    private static let service = "org.traumabomen.companion.refresh-token"

    var accessToken: String?

    var refreshToken: String? {
        get { Self.read() }
        set {
            if let value = newValue {
                Self.write(value)
            } else {
                Self.delete()
            }
        }
    }

    static func clear() {
        delete()
    }

    private static func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecReturnData as String: true,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func write(_ value: String) {
        delete()
        let add: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecValueData as String: Data(value.utf8),
        ]
        SecItemAdd(add as CFDictionary, nil)
    }

    private static func delete() {
        SecItemDelete([
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
        ] as CFDictionary)
    }
}
