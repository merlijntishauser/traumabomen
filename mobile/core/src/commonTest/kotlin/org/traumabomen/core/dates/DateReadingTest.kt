package org.traumabomen.core.dates

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** Mirrors frontend/src/lib/dateReading.unit.test.ts so both platforms read dates alike. */
class DateReadingTest {
    private fun years(from: Int, to: Int = from, approx: Boolean = false) =
        DateReading(DateReadingKind.YEARS, from, to, approx)

    private fun ages(from: Int, to: Int = from) = DateReading(DateReadingKind.AGES, from, to)

    private fun assertReads(cases: List<Pair<String, DateReading>>) {
        for ((text, expected) in cases) assertEquals(expected, DateReader.read(text), text)
    }

    @Test
    fun readsCalendarYears() = assertReads(
        listOf(
            "1997" to years(1997),
            "1963-1970" to years(1963, 1970),
            "1963 – 1970" to years(1963, 1970),
            "1970-1963" to years(1970),
            "about 1965" to years(1965, 1965, true),
            "rond 1965" to years(1965, 1965, true),
            "~1965" to years(1965, 1965, true),
            "1965?" to years(1965, 1965, true),
            "summer 1965" to years(1965),
            "1960s" to years(1960, 1969, true),
            "at 1997" to years(1997),
        ),
    )

    @Test
    fun readsDecadesInWords() = assertReads(
        listOf(
            "the sixties" to years(1960, 1969, true),
            "in the 60s" to years(1960, 1969, true),
            "the '60s" to years(1960, 1969, true),
            "jaren 60" to years(1960, 1969, true),
            "in de jaren '60" to years(1960, 1969, true),
            "jaren zestig" to years(1960, 1969, true),
            "the 10s" to years(2010, 2019, true),
        ),
    )

    @Test
    fun readsAges() = assertReads(
        listOf(
            "at 12" to ages(12),
            "at age 12" to ages(12),
            "at the age of 12" to ages(12),
            "aged 12-15" to ages(12, 15),
            "between 12 and 15" to ages(12, 15),
            "12 years old" to ages(12),
            "12 jaar oud" to ages(12),
            "op haar 12e" to ages(12),
            "op 12-jarige leeftijd" to ages(12),
            "toen ze 12 was" to ages(12),
            "toen hij 12 jaar was" to ages(12),
            "when she was 12" to ages(12),
        ),
    )

    @Test
    fun ignoresImpossibleAges() {
        assertNull(DateReader.read("at 140"))
        assertNull(DateReader.read("aged 15-12"))
    }

    @Test
    fun readsStagesOfLife() = assertReads(
        listOf(
            "as a baby" to ages(0, 1),
            "als peuter" to ages(1, 3),
            "kleutertijd" to ages(3, 6),
            "in primary school" to ages(4, 12),
            "op de basisschool" to ages(4, 12),
            "as a child" to ages(0, 12),
            "in her childhood" to ages(0, 12),
            "als kind" to ages(0, 12),
            "when he was little" to ages(0, 12),
            "toen ze klein was" to ages(0, 12),
            "in zijn jeugd" to ages(0, 18),
            "as a teenager" to ages(13, 19),
            "in his teens" to ages(13, 19),
            "puberteit" to ages(13, 19),
            "in high school" to ages(12, 18),
            "at university" to ages(18, 23),
            "studententijd" to ages(18, 23),
            "young adulthood" to ages(18, 25),
            "in her twenties" to ages(20, 29),
            "during their 30s" to ages(30, 39),
            "in de veertig" to ages(40, 49),
            "als dertiger" to ages(30, 39),
            "middle-aged" to ages(40, 60),
            "middelbare leeftijd" to ages(40, 60),
            "in old age" to ages(65, 110),
            "op oudere leeftijd" to ages(65, 110),
        ),
    )

    @Test
    fun doesNotReadSomeoneElsesBabyAsInfancy() {
        assertNull(DateReader.read("when she had a baby"))
    }

    @Test
    fun readsApostropheYears() {
        assertEquals(DateReading(DateReadingKind.SHORT, 85, 85), DateReader.read("summer of '85"))
        assertEquals(DateReading(DateReadingKind.SHORT, 63, 70), DateReader.read("’63–’70"))
    }

    @Test
    fun returnsNullWithNothingToPlace() {
        assertNull(DateReader.read(""))
        assertNull(DateReader.read("   "))
        assertNull(DateReader.read(null))
        assertNull(DateReader.read("after the war"))
    }

    @Test
    fun placesReadingsAgainstABirthYear() {
        assertEquals(YearSpan(1997, 1997, false), DateReader.yearsFor(years(1997), null))
        assertEquals(YearSpan(1958, 1970, true), DateReader.yearsFor(ages(0, 12), 1958))
        assertNull(DateReader.yearsFor(ages(12), null))
        val short = { from: Int, to: Int -> DateReading(DateReadingKind.SHORT, from, to) }
        assertEquals(YearSpan(1985, 1985, false), DateReader.yearsFor(short(85, 85), 1960))
        assertEquals(YearSpan(2005, 2005, false), DateReader.yearsFor(short(5, 5), 1960))
        assertEquals(YearSpan(1998, 2003, false), DateReader.yearsFor(short(98, 3), 1960))
        assertNull(DateReader.yearsFor(short(85, 85), null))
    }

    @Test
    fun placesForPeople() {
        val people = listOf(
            PersonBirth("Harold", 1932),
            PersonBirth("Emma", 2014),
            PersonBirth("Ada", null),
        )
        assertEquals(listOf(PlacedPerson("Harold", 12, 12)), DateReader.placeForPeople(years(1944), people))
        assertEquals(listOf(PlacedPerson("Harold", 0, 13)), DateReader.placeForPeople(years(1930, 1945), people))
        assertEquals(
            listOf(PlacedPerson("Harold", 1932, 1944), PlacedPerson("Emma", 2014, 2026)),
            DateReader.placeForPeople(ages(0, 12), people),
        )
    }
}
