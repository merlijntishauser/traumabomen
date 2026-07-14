#!/bin/sh
# Round-trip the person entity models (Sources/PersonEntities.swift) against the
# shared golden fixture, asserting keys and explicit nulls survive. The models
# are pure Foundation, so this runs standalone via `swift`, no Xcode app host.
#
# Usage: scripts/verify-entities.sh [fixture.json]
set -eu
here=$(cd "$(dirname "$0")" && pwd)
ios="$here/.."
fixture="${1:-$ios/../../frontend/src/fixtures/person-entities.fixture.json}"
work=$(mktemp -d)
tmp="$work/rt.swift"
cat "$ios/Sources/PersonEntities.swift" > "$tmp"
cat >> "$tmp" <<'HARNESS'

// Harness appended by verify-entities.sh.
let fixturePath = CommandLine.arguments.dropFirst().first ?? ""
let raw = try! Data(contentsOf: URL(fileURLWithPath: fixturePath))
let root = try! JSONSerialization.jsonObject(with: raw) as! [String: Any]
func entry(_ k: String) -> Data { try! JSONSerialization.data(withJSONObject: root[k]!) }
func obj(_ d: Data) -> NSDictionary { try! JSONSerialization.jsonObject(with: d) as! NSDictionary }
var failures = 0
func check<T: Codable>(_ key: String, _ type: T.Type) {
    let golden = entry(key)
    do {
        let decoded = try JSONDecoder().decode(T.self, from: golden)
        let re = try JSONEncoder().encode(decoded)
        if obj(golden) == obj(re) { print("OK   \(key)") }
        else { print("FAIL \(key)\n  golden: \(obj(golden))\n  re:     \(obj(re))"); failures += 1 }
    } catch { print("FAIL \(key): \(error)"); failures += 1 }
}
check("trauma_event", TraumaEventContent.self)
check("life_event", LifeEventContent.self)
check("turning_point", TurningPointContent.self)
check("classification", ClassificationContent.self)
print(failures == 0 ? "ALL OK" : "\(failures) FAILURES")
exit(failures == 0 ? 0 : 1)
HARNESS
swift "$tmp" "$fixture"
