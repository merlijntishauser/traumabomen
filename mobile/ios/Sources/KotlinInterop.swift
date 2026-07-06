import Foundation
import TraumabomenCore

extension KotlinByteArray {
    func toData() -> Data {
        var data = Data(count: Int(size))
        for i in 0..<size {
            data[Int(i)] = UInt8(bitPattern: get(index: i))
        }
        return data
    }

    static func from(_ data: Data) -> KotlinByteArray {
        let array = KotlinByteArray(size: Int32(data.count))
        for (i, byte) in data.enumerated() {
            array.set(index: Int32(i), value: Int8(bitPattern: byte))
        }
        return array
    }
}
