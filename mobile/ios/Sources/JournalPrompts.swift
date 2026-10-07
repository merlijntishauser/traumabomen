import Foundation

/// The open questions the journal offers, word for word the web's
/// (prompt.journal.* and prompt.person.* in the locales), in both languages.
/// Open questions, never imperatives.
enum JournalPrompts {
    private static let journalEN = [
        "Who in your family tree do you most identify with, and why?",
        "What event had the most ripple effects across generations?",
        "Are there strengths or resilience patterns, not just trauma?",
        "What patterns do you notice repeating?",
        "What would you like future generations to know about your family?",
        "What was never spoken about, but everyone knew?",
        "Which relationship in your tree surprises you the most?",
        "If you could ask one ancestor a question, who and what would it be?",
        "What did your family teach you about handling difficult emotions?",
        "Where do you see yourself in this tree?",
    ]
    private static let journalNL = [
        "Met wie in je stamboom identificeer je je het meest, en waarom?",
        "Welke gebeurtenis had de meeste impact over generaties heen?",
        "Zijn er veerkracht of sterke patronen, niet alleen trauma?",
        "Welke patronen zie je steeds terugkomen?",
        "Wat zou je willen dat toekomstige generaties weten over je familie?",
        "Waarover werd nooit gesproken, maar wist iedereen?",
        "Welke relatie in je stamboom verrast je het meest?",
        "Als je een voorouder een vraag kon stellen, wie en wat zou dat zijn?",
        "Wat leerde je familie je over het omgaan met moeilijke emoties?",
        "Waar zie je jezelf in deze stamboom?",
    ]
    private static let personEN = [
        "What strengths did {{name}} carry despite these experiences?",
        "How did {{name}}'s turning point affect the next generation?",
        "How has {{name}}'s diagnosis shaped the family's understanding?",
        "What role did {{name}} play in holding the family together?",
        "What do you wish {{name}} had known about themselves?",
        "What did {{name}} pass on that you're grateful for?",
        "How might {{name}}'s story have been different with more support?",
        "What would you say to {{name}} if you could?",
    ]
    private static let personNL = [
        "Welke krachten droeg {{name}} ondanks deze ervaringen?",
        "Hoe heeft het keerpunt van {{name}} de volgende generatie beinvloed?",
        "Hoe heeft de diagnose van {{name}} het begrip binnen de familie gevormd?",
        "Welke rol speelde {{name}} in het bijeenhouden van de familie?",
        "Wat zou je willen dat {{name}} over zichzelf had geweten?",
        "Wat heeft {{name}} doorgegeven waar je dankbaar voor bent?",
        "Hoe zou het verhaal van {{name}} anders zijn geweest met meer steun?",
        "Wat zou je tegen {{name}} zeggen als je kon?",
    ]

    static var count: Int { journalEN.count }

    /// A journal question by index, in the active language.
    static func journal(_ index: Int) -> String {
        let list = Loc.shared.effective == "nl" ? journalNL : journalEN
        return list[((index % list.count) + list.count) % list.count]
    }

    /// A question about one person, with their name filled in.
    static func person(_ index: Int, name: String) -> String {
        let list = Loc.shared.effective == "nl" ? personNL : personEN
        let template = list[((index % list.count) + list.count) % list.count]
        return template.replacingOccurrences(of: "{{name}}", with: name)
    }

    /// A different random index than `current`.
    static func another(after current: Int, count: Int) -> Int {
        guard count > 1 else { return current }
        var next = Int.random(in: 0..<count)
        while next == current { next = Int.random(in: 0..<count) }
        return next
    }
}
