package org.traumabomen.core.sync

/**
 * Every entity type the ciphertext mirror holds, with its field prefix in
 * the bulk sync endpoint (POST /trees/{id}/sync), its REST path segment
 * (GET /trees/{id}/{apiPath}; note hyphens where the sync prefix has
 * underscores), and two capability flags:
 *
 * - [personLinked]: the server stores a person_ids junction next to the
 *   opaque blob, so sync payloads carry it in plaintext (ids only).
 * - [companionWritable]: the reflective layer the phone may write per the
 *   design (journal entries, turning points, trauma and life events).
 *   Everything else is read-only on the companion and edited at the desk.
 */
enum class EntityType(
    val syncPrefix: String,
    val apiPath: String,
    val personLinked: Boolean,
    val companionWritable: Boolean,
) {
    PERSONS("persons", "persons", personLinked = false, companionWritable = false),
    RELATIONSHIPS("relationships", "relationships", personLinked = false, companionWritable = false),
    TRAUMA_EVENTS("events", "events", personLinked = true, companionWritable = true),
    LIFE_EVENTS("life_events", "life-events", personLinked = true, companionWritable = true),
    CLASSIFICATIONS("classifications", "classifications", personLinked = true, companionWritable = false),
    TURNING_POINTS("turning_points", "turning-points", personLinked = true, companionWritable = true),
    PATTERNS("patterns", "patterns", personLinked = true, companionWritable = false),
    JOURNAL_ENTRIES("journal_entries", "journal", personLinked = false, companionWritable = true),
    SIBLING_GROUPS("sibling_groups", "sibling-groups", personLinked = true, companionWritable = false),
}
