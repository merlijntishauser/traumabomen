package org.traumabomen.core.sync

/**
 * Every entity type the ciphertext mirror holds, with its field prefix in
 * the bulk sync endpoint (POST /trees/{id}/sync) and two capability flags:
 *
 * - [personLinked]: the server stores a person_ids junction next to the
 *   opaque blob, so sync payloads carry it in plaintext (ids only).
 * - [companionWritable]: the reflective layer the phone may write per the
 *   design (journal entries, turning points, trauma and life events).
 *   Everything else is read-only on the companion and edited at the desk.
 */
enum class EntityType(
    val syncPrefix: String,
    val personLinked: Boolean,
    val companionWritable: Boolean,
) {
    PERSONS("persons", personLinked = false, companionWritable = false),
    RELATIONSHIPS("relationships", personLinked = false, companionWritable = false),
    TRAUMA_EVENTS("events", personLinked = true, companionWritable = true),
    LIFE_EVENTS("life_events", personLinked = true, companionWritable = true),
    CLASSIFICATIONS("classifications", personLinked = true, companionWritable = false),
    TURNING_POINTS("turning_points", personLinked = true, companionWritable = true),
    PATTERNS("patterns", personLinked = true, companionWritable = false),
    JOURNAL_ENTRIES("journal_entries", personLinked = false, companionWritable = true),
    SIBLING_GROUPS("sibling_groups", personLinked = true, companionWritable = false),
}
