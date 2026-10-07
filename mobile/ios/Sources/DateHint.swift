import Foundation
import TraumabomenCore

/// The sentence under a date field: how the timeline will read what was typed
/// ("Reads as 1944, when Harold was 12."). Mirrors the web's
/// lib/dateReadingSentence.ts on top of the shared core reader.
enum DateHint {
    /// People named in the sentence; the rest are counted.
    private static let maxNamed = 3
    /// Ages from here up read as "from age 65" (a stage that runs to the end of life).
    private static let openEndedAge = 100

    private static func firstName(_ name: String) -> String {
        name.split(separator: " ").first.map(String.init) ?? name
    }

    private static func span(_ from: Int, _ to: Int) -> String {
        from == to ? String(from) : tf("{from} to {to}", ["from": String(from), "to": String(to)])
    }

    private static func named(_ placed: [PlacedPerson], _ item: (PlacedPerson) -> String) -> String {
        var items = placed.prefix(maxNamed).map(item)
        if placed.count > maxNamed {
            items.append(tf("{count} more", ["count": String(placed.count - maxNamed)]))
        }
        return listJoin(items)
    }

    private static func ages(_ reading: DateReading) -> String {
        let from = Int(reading.from), to = Int(reading.to)
        if from == to { return tf("age {age}", ["age": String(from)]) }
        if to >= openEndedAge { return tf("from age {age}", ["age": String(from)]) }
        return tf("ages {from} to {to}", ["from": String(from), "to": String(to)])
    }

    static func sentence(for text: String, people: [TreePerson]) -> String? {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        guard let reading = DateReader.shared.read(text: text) else {
            return t("No year to place yet, so this stays off the timeline. Try a year, an age (\"at 12\"), or a stage of life (\"as a child\").")
        }
        let births = people.map {
            PersonBirth(name: $0.name, birthYear: $0.birthYear.map { KotlinInt(int: Int32($0)) })
        }
        let placed = DateReader.shared.placeForPeople(reading: reading, people: births)

        if reading.kind == .years {
            var when = span(Int(reading.from), Int(reading.to))
            if reading.approx { when = tf("about {when}", ["when": when]) }
            guard !placed.isEmpty else { return tf("Reads as {when}.", ["when": when]) }
            let who = named(placed) {
                tf("{name} was {age}", ["name": firstName($0.name), "age": span(Int($0.from), Int($0.to))])
            }
            return tf("Reads as {when}, when {who}.", ["when": when, "who": who])
        }

        let what: String
        if reading.kind == .ages {
            what = ages(reading)
        } else {
            let from = String(format: "'%02d", Int(reading.from))
            what = reading.from == reading.to ? from : from + String(format: "-'%02d", Int(reading.to))
        }
        guard !placed.isEmpty else {
            return tf("Reads as {what}. Add a birth year to place it on the timeline.", ["what": what])
        }
        let openEnded = reading.kind == .ages && Int(reading.to) >= openEndedAge
        let whereText = named(placed) {
            let years = openEnded ? tf("from {year}", ["year": String($0.from)]) : span(Int($0.from), Int($0.to))
            return tf("{years} for {name}", ["years": years, "name": firstName($0.name)])
        }
        return tf("Reads as {what}: {where}.", ["what": what, "where": whereText])
    }
}
