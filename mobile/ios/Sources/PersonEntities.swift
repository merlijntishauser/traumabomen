import Foundation

/// Full-fidelity, editable models for the reflective layer attached to a
/// person, mirroring the web's entity schemas in `frontend/src/types/domain.ts`
/// exactly (snake_case keys, nullable fields written as explicit `null` the way
/// the web does). These are the round-trip forms used by the edit forms and by
/// `AppModel`'s save path; the lossy `StoryItem` in `TreeData` stays for the
/// canvas and badges.
///
/// Property names are the JSON keys, so the synthesized `CodingKeys` match the
/// wire format without a mapping table (as the existing `TreeDecoding` structs
/// already do).

/// Writes explicit `null` for a nil optional instead of omitting the key, so a
/// round-trip matches the web's `field: null` output.
extension KeyedEncodingContainer {
    mutating func encodeOrNull<T: Encodable>(_ value: T?, forKey key: Key) throws {
        if let value { try encode(value, forKey: key) } else { try encodeNil(forKey: key) }
    }
}

struct TraumaEventContent: Codable {
    var title: String = ""
    var description: String = ""
    var category: String = "loss"
    var approximate_date: String = ""
    var severity: Int = 3
    var tags: [String] = []
}

struct LifeEventContent: Codable {
    var title: String = ""
    var description: String = ""
    var category: String = "family"
    var approximate_date: String = ""
    var impact: Int? = nil
    var tags: [String] = []

    enum CodingKeys: String, CodingKey {
        case title, description, category, approximate_date, impact, tags
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(title, forKey: .title)
        try c.encode(description, forKey: .description)
        try c.encode(category, forKey: .category)
        try c.encode(approximate_date, forKey: .approximate_date)
        try c.encodeOrNull(impact, forKey: .impact)
        try c.encode(tags, forKey: .tags)
    }
}

struct TurningPointContent: Codable {
    var title: String = ""
    var description: String = ""
    var category: String = "achievement"
    var approximate_date: String = ""
    var significance: Int? = nil
    var tags: [String] = []

    enum CodingKeys: String, CodingKey {
        case title, description, category, approximate_date, significance, tags
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(title, forKey: .title)
        try c.encode(description, forKey: .description)
        try c.encode(category, forKey: .category)
        try c.encode(approximate_date, forKey: .approximate_date)
        try c.encodeOrNull(significance, forKey: .significance)
        try c.encode(tags, forKey: .tags)
    }
}

struct ClassificationPeriodContent: Codable, Identifiable {
    var id = UUID()
    var start_year: Int
    var end_year: Int?

    enum CodingKeys: String, CodingKey { case start_year, end_year }

    init(start_year: Int, end_year: Int? = nil) {
        self.start_year = start_year
        self.end_year = end_year
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        start_year = try c.decode(Int.self, forKey: .start_year)
        end_year = try c.decodeIfPresent(Int.self, forKey: .end_year)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(start_year, forKey: .start_year)
        try c.encodeOrNull(end_year, forKey: .end_year)
    }
}

struct ClassificationContent: Codable {
    var dsm_category: String = ""
    var dsm_subcategory: String? = nil
    var status: String = "suspected"
    var diagnosis_year: Int? = nil
    var periods: [ClassificationPeriodContent] = []
    var notes: String? = nil

    enum CodingKeys: String, CodingKey {
        case dsm_category, dsm_subcategory, status, diagnosis_year, periods, notes
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(dsm_category, forKey: .dsm_category)
        try c.encodeOrNull(dsm_subcategory, forKey: .dsm_subcategory)
        try c.encode(status, forKey: .status)
        try c.encodeOrNull(diagnosis_year, forKey: .diagnosis_year)
        try c.encode(periods, forKey: .periods)
        try c.encodeOrNull(notes, forKey: .notes)
    }
}
