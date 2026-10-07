package org.traumabomen.core.dates

/**
 * Reading a free-text date the way a person writes one: "1997", "1963-1970",
 * "the sixties", "at 12", "as a child", "in her twenties", "'85". English and
 * Dutch. Calendar dates read directly; ages, stages of life and two-digit
 * years are read relative to a person and resolved against their birth year.
 *
 * Kept in step with the web app's frontend/src/lib/dateReading.ts: the same
 * text must land on the same years on every platform.
 */
enum class DateReadingKind {
    /** Calendar years. */
    YEARS,

    /** An age or a stage of life, always approximate. */
    AGES,

    /** Two-digit years ('85), resolved against a birth year. */
    SHORT,
}

data class DateReading(
    val kind: DateReadingKind,
    val from: Int,
    val to: Int,
    /** Only meaningful for [DateReadingKind.YEARS]; ages are always approximate. */
    val approx: Boolean = false,
)

data class YearSpan(val from: Int, val to: Int, val approx: Boolean)

/** Where a reading lands for one person: their ages for a calendar date, their years for an age. */
data class PlacedPerson(val name: String, val from: Int, val to: Int)

data class PersonBirth(val name: String, val birthYear: Int?)

object DateReader {
    /** The oldest age a stage like "old age" reaches; clipped to the life when drawn. */
    const val LATE_LIFE_END = 110
    private const val MAX_AGE = 120

    private val approxWords = setOf(
        "c.", "ca", "ca.", "circa", "about", "around", "approx", "approx.",
        "approximately", "ongeveer", "rond", "omstreeks",
    )

    private val decadeWords = mapOf(
        "twenties" to 20, "thirties" to 30, "forties" to 40, "fifties" to 50,
        "sixties" to 60, "seventies" to 70, "eighties" to 80, "nineties" to 90,
        "twintig" to 20, "dertig" to 30, "veertig" to 40, "vijftig" to 50,
        "zestig" to 60, "zeventig" to 70, "tachtig" to 80, "negentig" to 90,
    )

    private val decadeWord = decadeWords.keys.joinToString("|")
    private const val PRONOUN_EN = "(?:he|she|they|i|we|you)"
    private const val PRONOUN_NL = "(?:hij|ze|zij|ik|we|wij|je|jij)"
    private const val POSSESSIVE_EN = "(?:his|her|their|my|our|your)"

    /** Stages of life and the ages they span, most specific first. */
    private val lifeStages: List<Triple<Regex, Int, Int>> = listOf(
        Triple(Regex("""\b(?:as an? (?:baby|infant|newborn)|infancy|als baby|als zuigeling)\b"""), 0, 1),
        Triple(Regex("""\b(?:as a toddler|als peuter|peutertijd)\b"""), 1, 3),
        Triple(Regex("""\bearly childhood\b"""), 0, 5),
        Triple(Regex("""\b(?:pre-?school|kindergarten|kleuter(?:tijd|school)?)\b"""), 3, 6),
        Triple(Regex("""\b(?:primary|elementary|grade) school\b|\bbasisschool\b"""), 4, 12),
        Triple(Regex("""\b(?:high school|secondary school|middelbare school)\b"""), 12, 18),
        Triple(
            Regex(
                """\b(?:as an? (?:teen|teenager|adolescent)|teens|teenage years|adolescence|puberty|als (?:tiener|puber)|puberteit|tienerjaren|tienertijd)\b""",
            ),
            13,
            19,
        ),
        Triple(Regex("""\b(?:young adult(?:hood)?|jongvolwassen(?:e|heid)?)\b"""), 18, 25),
        Triple(
            Regex("""\b(?:(?:at|in|during) (?:university|college)|studententijd|studietijd|tijdens (?:de|haar|zijn) studie)\b"""),
            18,
            23,
        ),
        Triple(Regex("""\b(?:middle[- ]age(?:d)?|middelbare leeftijd)\b"""), 40, 60),
        Triple(
            Regex(
                """\b(?:old age|later life|late in life|retire(?:d|ment)|ouderdom|pensioen|op (?:oudere|latere|hoge) leeftijd)\b""",
            ),
            65,
            LATE_LIFE_END,
        ),
        Triple(Regex("""\bwhen $PRONOUN_EN (?:was|were) (?:little|small|young)\b"""), 0, 12),
        Triple(Regex("""\btoen $PRONOUN_NL (?:klein|jong) was\b"""), 0, 12),
        Triple(
            Regex("""\b(?:as an? (?:child|kid|little (?:boy|girl))|childhood|als kind|kindertijd|kinderjaren)\b"""),
            0,
            12,
        ),
        Triple(Regex("""\bjeugd\b"""), 0, 18),
    )

    private val agePatterns = listOf(
        Regex("""\b(?:at the age of|at age|aged|age|at)\s+(\d{1,3})\b"""),
        Regex("""\b(\d{1,3})\s*(?:years? old|jaar oud)\b"""),
        Regex("""\bop\s+(?:(?:zijn|haar|hun|mijn|je|jouw|onze)\s+)?(\d{1,3})(?:e|ste|de)?(?:\s|$)"""),
        Regex("""\b(\d{1,3})-?jarige?\b"""),
        Regex("""\btoen $PRONOUN_NL (\d{1,3})(?: jaar)? (?:oud )?was\b"""),
        Regex("""\bwhen $PRONOUN_EN (?:was|were) (\d{1,3})\b"""),
    )

    private val ageRange =
        Regex("""\b(?:ages?|aged|at|between|tussen|leeftijd)\s+(\d{1,3})\s*(?:-|to|and|tot|en)\s*(\d{1,3})\b""")

    /** Read a free-text date. Null when there is nothing to place. */
    fun read(text: String?): DateReading? {
        if (text == null) return null
        val normal = normalise(text)
        if (normal.isEmpty()) return null
        return readCalendar(normal)
            ?: readDecadeWords(normal)
            ?: readAges(normal)
            ?: readLifeStage(normal)
            ?: readShortYears(normal)
    }

    /** The calendar years a reading covers for one person, or null when it needs a birth year they lack. */
    fun yearsFor(reading: DateReading, birthYear: Int?): YearSpan? = when (reading.kind) {
        DateReadingKind.YEARS -> YearSpan(reading.from, reading.to, reading.approx)
        DateReadingKind.AGES ->
            birthYear?.let { YearSpan(it + reading.from, it + reading.to, approx = true) }
        DateReadingKind.SHORT -> birthYear?.let {
            val from = yearEnding(reading.from, it)
            YearSpan(from, yearEnding(reading.to, from), approx = false)
        }
    }

    /**
     * Where a reading lands for the people an entry belongs to: their ages for a
     * calendar date, their calendar years for an age. People born after a
     * calendar date, or without a birth year for an age, are left out.
     */
    fun placeForPeople(reading: DateReading, people: List<PersonBirth>): List<PlacedPerson> =
        people.mapNotNull { (name, birthYear) ->
            if (reading.kind == DateReadingKind.YEARS) {
                if (birthYear == null || reading.to < birthYear) {
                    null
                } else {
                    PlacedPerson(name, maxOf(0, reading.from - birthYear), reading.to - birthYear)
                }
            } else {
                yearsFor(reading, birthYear)?.let { PlacedPerson(name, it.from, it.to) }
            }
        }

    private fun normalise(text: String): String =
        text.lowercase()
            .replace(Regex("[‘’ʼ`]"), "'")
            .replace(Regex("[–—]"), "-")
            .trim()

    private fun isApproximate(text: String): Boolean {
        if (text.contains('~') || text.contains('?')) return true
        return text.split(Regex("\\s+")).any { it in approxWords }
    }

    /** Two-digit decades without a century: 00s and 10s are this century, the rest the last. */
    private fun centuryDecade(tens: Int): Int = if (tens < 2) 2000 + tens * 10 else 1900 + tens * 10

    private fun readCalendar(text: String): DateReading? {
        Regex("""\b(\d{3})0s\b""").find(text)?.let {
            val from = it.groupValues[1].toInt() * 10
            return DateReading(DateReadingKind.YEARS, from, from + 9, approx = true)
        }
        val years = Regex("""\b\d{4}\b""").findAll(text).map { it.value.toInt() }.toList()
        if (years.isEmpty()) return null
        val from = years[0]
        val to = if (years.size > 1 && years[1] >= from) years[1] else from
        return DateReading(DateReadingKind.YEARS, from, to, approx = isApproximate(text))
    }

    private fun readDecadeWords(text: String): DateReading? {
        val numeric = Regex("""\b(?:the|jaren)\s+'?(\d)0'?s?\b""").find(text)
        val word = Regex("""\b(?:the|jaren)\s+($decadeWord)\b""").find(text)
        val tens = when {
            numeric != null -> numeric.groupValues[1].toInt()
            word != null -> decadeWords.getValue(word.groupValues[1]) / 10
            else -> return null
        }
        val from = centuryDecade(tens)
        return DateReading(DateReadingKind.YEARS, from, from + 9, approx = true)
    }

    private fun ageSpan(from: Int, to: Int = from): DateReading? =
        if (from > MAX_AGE || to > MAX_AGE || to < from) null else DateReading(DateReadingKind.AGES, from, to)

    private fun readAges(text: String): DateReading? {
        ageRange.find(text)?.let { return ageSpan(it.groupValues[1].toInt(), it.groupValues[2].toInt()) }
        for (pattern in agePatterns) {
            pattern.find(text)?.let { return ageSpan(it.groupValues[1].toInt()) }
        }
        return null
    }

    private fun readLifeStage(text: String): DateReading? {
        val decadeOfLife =
            Regex("""\b(?:in|during) $POSSESSIVE_EN\s+($decadeWord|\d0s)\b""").find(text)
                ?: Regex("""\bin de ($decadeWord)\b""").find(text)
                ?: Regex("""\b($decadeWord)er\b""").find(text)
        if (decadeOfLife != null) {
            val key = decadeOfLife.groupValues[1]
            val from = decadeWords[key] ?: key.take(2).toInt()
            return ageSpan(from, from + 9)
        }
        for ((pattern, from, to) in lifeStages) {
            if (pattern.containsMatchIn(text)) return ageSpan(from, to)
        }
        return null
    }

    private fun readShortYears(text: String): DateReading? {
        val match = Regex("""'(\d{2})\b(?:\s*-\s*'?(\d{2})\b)?""").find(text) ?: return null
        val from = match.groupValues[1].toInt()
        val to = match.groupValues[2].takeIf { it.isNotEmpty() }?.toInt() ?: from
        return DateReading(DateReadingKind.SHORT, from, to)
    }

    /** The first year at or after [from] that ends in the two digits [yy]. */
    private fun yearEnding(yy: Int, from: Int): Int {
        val year = from / 100 * 100 + yy
        return if (year < from) year + 100 else year
    }
}
