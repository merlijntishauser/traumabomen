import Foundation
import SwiftUI

/// App language, switchable in Settings: follow the device, or pin English or
/// Dutch. Kept in lockstep with the web's EN/NL, in the same restrained voice.
enum AppLanguage: String, CaseIterable {
    case auto, en, nl

    var label: String {
        switch self {
        case .auto: t("Auto")
        case .en: "English"
        case .nl: "Nederlands"
        }
    }
}

/// Runtime localization. Views observe `Loc.shared`; the root keys itself on
/// the effective language so a switch rebuilds instantly, no restart.
final class Loc: ObservableObject {
    static let shared = Loc()
    private static let key = "app.language"

    @Published var language: AppLanguage {
        didSet { UserDefaults.standard.set(language.rawValue, forKey: Self.key) }
    }

    init() {
        language = AppLanguage(rawValue: UserDefaults.standard.string(forKey: Self.key) ?? "") ?? .auto
    }

    /// The resolved language code: "nl" or "en".
    var effective: String {
        switch language {
        case .en: "en"
        case .nl: "nl"
        case .auto:
            (Locale.preferredLanguages.first ?? "en").hasPrefix("nl") ? "nl" : "en"
        }
    }
}

/// Translate an English string to the active language. The English text is the
/// key, so wrapping a literal is enough; a missing Dutch entry falls back to
/// the English. Interpolation is done by the caller around `t(...)`.
func t(_ english: String) -> String {
    guard Loc.shared.effective == "nl" else { return english }
    return NL[english] ?? english
}

/// The Dutch strings, matching the web's terminology (Encryptiesleutel,
/// Dagboek, Boomweergave) and its restrained voice.
private let NL: [String: String] = [
    // Brand: the site is Traumabomen on the Dutch domain.
    "Traumatrees": "Traumabomen",

    // Login / unlock
    "A quiet place to see what repeats, and to write about it.":
        "Een rustige plek om te zien wat zich herhaalt, en om erover te schrijven.",
    "Email": "E-mailadres",
    "Password": "Wachtwoord",
    "Log in": "Inloggen",
    "Login failed. Check your email and password.":
        "Inloggen mislukt. Controleer je e-mailadres en wachtwoord.",
    "Your encryption passphrase unlocks your data on this device. We can never read it.":
        "Je encryptiesleutel ontgrendelt je gegevens op dit apparaat. Wij kunnen ze nooit lezen.",
    "Encryption passphrase": "Encryptiesleutel",
    "Unlock": "Ontgrendelen",
    "Incorrect passphrase.": "Onjuiste encryptiesleutel.",
    "Welcome back.": "Welkom terug.",
    "Unlock with Face ID": "Ontgrendel met Face ID",
    "Use passphrase instead": "Gebruik je encryptiesleutel",

    // Welcome
    "A quiet place to see what repeats in a family, and to write about it.":
        "Een rustige plek om te zien wat zich in een familie herhaalt, en om erover te schrijven.",
    "Map your family": "Breng je familie in kaart",
    "Place the people, how they are connected, and what happened to them, across generations.":
        "Plaats de mensen, hoe ze verbonden zijn, en wat hen is overkomen, over generaties heen.",
    "Write, at your own pace": "Schrijf, in je eigen tempo",
    "Keep a private journal of what you notice. You set the pace; pause or stop whenever you want.":
        "Houd een privédagboek bij van wat je opmerkt. Jij bepaalt het tempo; pauzeer of stop wanneer je wilt.",
    "Only you can read it": "Alleen jij kunt het lezen",
    "Everything is encrypted on this device before it is stored. We can never see your family's story.":
        "Alles wordt op dit apparaat versleuteld voordat het wordt opgeslagen. Wij kunnen het verhaal van je familie nooit zien.",
    "A few honest things": "Een paar eerlijke dingen",
    "This is a personal reflection tool. It is not therapy, and not crisis support.":
        "Dit is een persoonlijk reflectie-instrument. Het is geen therapie en geen crisishulp.",
    "Building the tree itself happens at the desk, on the web. Here you look, and you write.":
        "De boom zelf bouw je aan het bureau, op het web. Hier kijk je, en schrijf je.",
    "If you lose your passphrase, your data is unrecoverable. This is by design.":
        "Als je je encryptiesleutel verliest, zijn je gegevens onherstelbaar. Dat is bewust zo ontworpen.",
    "Continue": "Doorgaan",
    "Hint": "Hint",
    "Version": "Versie",
    "dev": "dev",
    "Auto": "Automatisch",
    "Light": "Licht",
    "Dark": "Donker",

    // Trees
    "Your trees": "Jouw bomen",
    "Untitled tree": "Naamloze boom",
    "Each tree holds its own family, journal, and canvas.":
        "Elke boom heeft zijn eigen familie, dagboek en boomweergave.",

    // Home / nav
    "Journal": "Dagboek",
    "Tree": "Boom",
    "Settings": "Instellingen",
    "Lock": "Vergrendelen",
    "New entry": "Nieuw item",
    "Title": "Titel",
    "Body": "Tekst",
    "A title": "Een titel",
    "No tree yet. Trees grow at the desk; this canvas shows yours read-only.":
        "Nog geen boom. Bomen groeien aan het bureau; deze weergave toont die van jou alleen-lezen.",

    // Journal
    "Nothing here yet. Your first entry can be a single sentence.":
        "Hier staat nog niets. Je eerste item mag één zin zijn.",
    "waiting to sync": "wacht op synchronisatie",
    "What was never spoken about, but everyone knew?":
        "Waarover werd nooit gesproken, maar wist iedereen?",
    "Linked": "Gekoppeld",
    "Link an item": "Koppel een item",
    "Edit links": "Koppelingen bewerken",
    "This tree has nothing to link yet.": "Deze boom heeft nog niets om te koppelen.",
    "Tie this entry to a person, turning point, or event in the tree.":
        "Koppel dit item aan een persoon, keerpunt of gebeurtenis in de boom.",
    "People": "Personen",
    "Turning points": "Keerpunten",
    "Trauma events": "Trauma's",
    "Life events": "Levensgebeurtenissen",
    "Unknown": "Onbekend",
    "Cancel": "Annuleren",
    "Save": "Opslaan",
    "Saved": "Opgeslagen",
    "Saving": "Bezig met opslaan",
    "Delete": "Verwijderen",
    "Confirm delete": "Bevestig verwijderen",

    // Person page
    "Adopted": "Geadopteerd",
    "Editing happens at the desk; the phone is for looking and writing.":
        "Bewerken doe je aan het bureau; de telefoon is om te kijken en te schrijven.",
    "What happened": "Wat er gebeurde",
    "Life events section": "Levensgebeurtenissen",

    // Settings
    "Done": "Klaar",
    "Reminders": "Herinneringen",
    "A weekly reminder": "Een wekelijkse herinnering",
    "A gentle nudge, delivered on your device. The reminder never names what this app is for.":
        "Een zacht duwtje, bezorgd op je apparaat. De herinnering noemt nooit waar deze app voor is.",
    "Appearance": "Weergave",
    "Language": "Taal",
    "Account": "Account",
    "Log out": "Uitloggen",
    "Tap again to log out": "Tik nogmaals om uit te loggen",
    "Logging out clears this device and returns to the sign-in screen, so you can use a different account.":
        "Uitloggen wist dit apparaat en keert terug naar het inlogscherm, zodat je een ander account kunt gebruiken.",
    "About": "Over",
    "Traumatrees is a personal reflection tool, not therapy and not crisis support.":
        "Traumabomen is een persoonlijk reflectie-instrument, geen therapie en geen crisishulp.",
    "Everything you write is encrypted on this device; the server only ever stores ciphertext. If you lose your passphrase, your data is unrecoverable. This is by design.":
        "Alles wat je schrijft wordt op dit apparaat versleuteld; de server bewaart alleen versleutelde tekst. Als je je encryptiesleutel verliest, zijn je gegevens onherstelbaar. Dat is bewust zo ontworpen.",
    "Open source under AGPL-3.0. Bundled fonts (Playwrite NZ Basic, Lato, Fraunces) use the SIL Open Font License; icons are from Lucide (ISC License).":
        "Open source onder AGPL-3.0. De ingesloten lettertypen (Playwrite NZ Basic, Lato, Fraunces) gebruiken de SIL Open Font License; iconen komen van Lucide (ISC-licentie).",

    // Working states
    "Logging in": "Bezig met inloggen",
    "Unlocking": "Bezig met ontgrendelen",
    "Opening": "Bezig met openen",

    // Reminder notification (neutral)
    "A quiet moment": "Een rustig moment",
    "If you would like one, it is here.": "Als je er een wilt, hij is er.",

    // Person-page edit form fields
    "Choose": "Kies",
    "Add a tag": "Voeg een label toe",
    "Add": "Toevoegen",
    "Start": "Begin",
    "to": "tot",
    "Ongoing": "Lopend",
    "Add period": "Periode toevoegen",
    "Add milestone": "Mijlpaal toevoegen",
    "Edit milestone": "Mijlpaal bewerken",
    "Category": "Categorie",
    "When": "Wanneer",
    "Approximate date": "Ongeveer wanneer",
    "Significance": "Betekenis",
    "Description": "Beschrijving",
    "Tags": "Labels",
    "Attached to": "Gekoppeld aan",
    "None yet.": "Nog niets.",
    "Add trauma event": "Trauma toevoegen",
    "Edit trauma event": "Trauma bewerken",
    "Severity": "Ernst",
    "Add life event": "Levensgebeurtenis toevoegen",
    "Edit life event": "Levensgebeurtenis bewerken",
    "Impact": "Impact",
    "Classifications": "Classificaties",
    "Add classification": "Classificatie toevoegen",
    "Edit classification": "Classificatie bewerken",
    "DSM category": "DSM-categorie",
    "Subcategory": "Subcategorie",
    "Status": "Status",
    "Diagnosis year": "Jaar van diagnose",
    "Year": "Jaar",
    "Periods": "Periodes",
    "Notes": "Notities",
    "None": "Geen",
    "Suspected": "Vermoed",
    "Diagnosed": "Gediagnosticeerd",
    "on this device": "op dit apparaat",
]

/// Localized counts with Dutch plurals, matching the tree cards and status line.
enum Plural {
    static func people(_ n: Int) -> String {
        Loc.shared.effective == "nl"
            ? (n == 1 ? "1 persoon" : "\(n) personen")
            : (n == 1 ? "1 person" : "\(n) people")
    }

    static func moments(_ n: Int) -> String {
        Loc.shared.effective == "nl"
            ? (n == 1 ? "1 moment" : "\(n) momenten")
            : (n == 1 ? "1 moment" : "\(n) moments")
    }

    static func journalEntries(_ n: Int) -> String {
        Loc.shared.effective == "nl"
            ? (n == 1 ? "1 dagboekitem" : "\(n) dagboekitems")
            : (n == 1 ? "1 journal entry" : "\(n) journal entries")
    }

    static func entries(_ n: Int) -> String {
        Loc.shared.effective == "nl"
            ? (n == 1 ? "1 item" : "\(n) items")
            : (n == 1 ? "1 entry" : "\(n) entries")
    }
}
