// Spike: prove Apple CryptoKit handles the web client's AES-256-GCM blob
// format (12-byte IV, ciphertext with the 16-byte tag appended, both base64
// inside a JSON {iv, ciphertext} envelope).
//
// CryptoKit has no Argon2; on iOS the KMP core derives the key via libsodium
// (proven byte-compatible by verify_libsodium.py) and hands the raw key to
// CryptoKit. This script mirrors that: it takes masterKeyHex from the
// fixture and runs the full decrypt chain, then encrypts a fresh blob in the
// same format and decrypts it back.
//
// Run: swift verify_cryptokit.swift   (from this directory)

import CryptoKit
import Foundation

struct Blob: Codable {
    let iv: String
    let ciphertext: String
}

var failures = 0
func check(_ name: String, _ ok: Bool) {
    print("  \(ok ? "PASS" : "FAIL")  \(name)")
    if !ok { failures += 1 }
}

func decryptBlob(_ encrypted: String, key: SymmetricKey) throws -> String {
    let blob = try JSONDecoder().decode(Blob.self, from: Data(encrypted.utf8))
    let iv = Data(base64Encoded: blob.iv)!
    let ctAndTag = Data(base64Encoded: blob.ciphertext)!
    precondition(iv.count == 12, "IV must be 12 bytes")
    let tag = ctAndTag.suffix(16)
    let ct = ctAndTag.dropLast(16)
    let box = try AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: iv), ciphertext: ct, tag: tag)
    return String(data: try AES.GCM.open(box, using: key), encoding: .utf8)!
}

func encryptBlob(_ plaintext: String, key: SymmetricKey) throws -> String {
    let box = try AES.GCM.seal(Data(plaintext.utf8), using: key)
    let blob = Blob(
        iv: Data(box.nonce).base64EncodedString(),
        ciphertext: (box.ciphertext + box.tag).base64EncodedString()
    )
    return String(data: try JSONEncoder().encode(blob), encoding: .utf8)!
}

func hexToData(_ hex: String) -> Data {
    var data = Data()
    var index = hex.startIndex
    while index < hex.endIndex {
        let next = hex.index(index, offsetBy: 2)
        data.append(UInt8(hex[index..<next], radix: 16)!)
        index = next
    }
    return data
}

let dir = URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent()
let fixtureData = try Data(contentsOf: dir.appendingPathComponent("fixture.json"))
let fx = try JSONSerialization.jsonObject(with: fixtureData) as! [String: Any]

print("1. Key ring decryption (CryptoKit AES-256-GCM, master key from fixture)")
let masterKey = SymmetricKey(data: hexToData(fx["masterKeyHex"] as! String))
let keyRingJson = try decryptBlob(fx["encryptedKeyRing"] as! String, key: masterKey)
let keyRing = try JSONSerialization.jsonObject(with: Data(keyRingJson.utf8)) as! [String: String]
let expectedRing = fx["keyRingPlaintext"] as! [String: String]
check("key ring plaintext matches", keyRing == expectedRing)

let treeId = fx["treeId"] as! String
check("tree key unwraps to expected bytes", keyRing[treeId] == (fx["treeKeyB64"] as! String))

print("2. Entity decryption (tree key)")
let treeKey = SymmetricKey(data: Data(base64Encoded: keyRing[treeId]!)!)
let person = try JSONSerialization.jsonObject(
    with: Data(try decryptBlob(fx["encryptedPerson"] as! String, key: treeKey).utf8)
) as! [String: Any]
check("person name matches", person["name"] as? String == "Anna de Vries")
check("person notes match", person["notes"] as? String == "Sprak nooit over de oorlog; naaide 's nachts.")
let journal = try JSONSerialization.jsonObject(
    with: Data(try decryptBlob(fx["encryptedJournal"] as! String, key: treeKey).utf8)
) as! [String: Any]
check("journal content matches", journal["content"] as? String == "Wat nooit werd gezegd, wist iedereen.")

print("3. Reverse direction: CryptoKit-encrypted blob in web format")
let fresh = try encryptBlob("{\"content\": \"vanaf de iPhone\"}", key: treeKey)
let back = try decryptBlob(fresh, key: treeKey)
check("round-trips locally", back == "{\"content\": \"vanaf de iPhone\"}")
try fresh.write(to: dir.appendingPathComponent("cryptokit-encrypted.json"), atomically: true, encoding: .utf8)
print("     wrote cryptokit-encrypted.json for browser-side verification")

print()
if failures > 0 {
    print("SPIKE FAILED: \(failures) check(s)")
    exit(1)
}
print("SPIKE PASSED: CryptoKit reads and writes the web blob format exactly.")
