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

/// Translate an English template, then fill its `{name}` placeholders. The
/// template (with placeholders) is the key, so Dutch can reorder words.
func tf(_ english: String, _ values: [String: String]) -> String {
    var text = t(english)
    for (key, value) in values {
        text = text.replacingOccurrences(of: "{\(key)}", with: value)
    }
    return text
}

/// "A, B and C" in the active language.
func listJoin(_ items: [String]) -> String {
    let locale = Locale(identifier: Loc.shared.effective)
    return items.formatted(.list(type: .and).locale(locale))
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

    // Trees
    "Create your first tree": "Maak je eerste boom",
    "New tree": "Nieuwe boom",
    "Tree name": "Naam van de boom",
    "Create tree": "Boom aanmaken",
    "Creating your tree": "Je boom aanmaken",
    "Could not create the tree. Please try again.":
        "Kon de boom niet aanmaken. Probeer het opnieuw.",

    // Registration
    "Create an account": "Een account aanmaken",
    "Create account": "Account aanmaken",
    "Creating your account": "Je account aanmaken",
    "I already have an account": "Ik heb al een account",
    "Repeat encryption passphrase": "Herhaal encryptiesleutel",
    "Your encryption passphrase is separate from your password. It unlocks your writing on this device, and we never receive it.":
        "Je encryptiesleutel staat los van je wachtwoord. Hij ontgrendelt wat je schrijft op dit apparaat, en wij ontvangen hem nooit.",
    "The two passphrases do not match.": "De twee encryptiesleutels komen niet overeen.",
    "Sign-ups are paused right now. You can join the waitlist on traumatrees.org.":
        "Aanmelden is nu tijdelijk gesloten. Je kunt je op traumabomen.nl op de wachtlijst zetten.",
    "That email already has an account. Try logging in instead.":
        "Dit e-mailadres heeft al een account. Probeer in te loggen.",
    "That password is too weak. Use a longer one.":
        "Dit wachtwoord is te zwak. Kies een langer wachtwoord.",
    "Could not create the account. Please try again.":
        "Kon het account niet aanmaken. Probeer het opnieuw.",
    "Check your email": "Controleer je e-mail",
    "We sent a link to": "We hebben een link gestuurd naar",
    "Open it to confirm your address, then come back here and log in.":
        "Open die om je adres te bevestigen, kom dan hier terug en log in.",
    "I have confirmed, log in": "Ik heb bevestigd, inloggen",
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
    "Delete account": "Account verwijderen",
    "Delete my account": "Verwijder mijn account",
    "Deleting": "Bezig met verwijderen",
    "Deleting your account": "Je account verwijderen",
    "Enter your password to confirm. Everything you have written is deleted from the server and from this device. This cannot be undone.":
        "Voer je wachtwoord in ter bevestiging. Alles wat je hebt geschreven wordt van de server en van dit apparaat verwijderd. Dit kan niet ongedaan worden gemaakt.",
    "Could not delete the account. Check your password.":
        "Kon het account niet verwijderen. Controleer je wachtwoord.",
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

    // Synced with the web's newer design: person page, journal desk, tree list threshold,
    // family stripes timeline, and date reading.
    "1 entry has no year yet, so it is not on the stripes.": "1 gebeurtenis heeft nog geen jaartal en staat daarom niet op de strepen.",
    "1 without a year": "1 zonder jaartal",
    "Add a birth year to someone in the tree to see the family here.": "Geef iemand in de stamboom een geboortejaar om de familie hier te zien.",
    "Add something": "Iets toevoegen",
    "Add to {name}'s life": "Toevoegen aan het leven van {name}",
    "Age": "Leeftijd",
    "Age being read": "Gekozen leeftijd",
    "Age {age}": "Leeftijd {age}",
    "Another question": "Andere vraag",
    "Answer this question": "Deze vraag beantwoorden",
    "Born": "Geboren",
    "Born {year}": "Geboren in {year}",
    "Classification": "Classificatie",
    "Details": "Gegevens",
    "Did not reach {age}: {names}.": "Werd geen {age}: {names}.",
    "Died": "Overleden",
    "Died {year}": "Overleden in {year}",
    "Earlier entries": "Eerdere items",
    "Former partner of": "Voormalig partner van",
    "Friend of": "Vriend van",
    "Generation {number}": "Generatie {number}",
    "Had died: {names}.": "Overleden: {names}.",
    "Life": "Leven",
    "Life event": "Mijlpaal",
    "Lights up every entry with the same title": "Licht elke vermelding met dezelfde titel op",
    "Lights up everything it describes": "Licht alles op wat het beschrijft",
    "Line lives up by": "Levens uitlijnen op",
    "Lives start together at birth. Tap an age.": "Levens beginnen samen bij de geboorte. Tik op een leeftijd.",
    "Marks": "Tekens",
    "Married to": "Getrouwd met",
    "Names, relationships, and the canvas are edited at the desk.": "Namen, relaties en de boomweergave bewerk je aan je bureau.",
    "Next age": "Volgende leeftijd",
    "Next year": "Volgend jaar",
    "No year to place yet, so this stays off the timeline. Try a year, an age (\"at 12\"), or a stage of life (\"as a child\").": "Nog geen jaar om te plaatsen, dus dit staat niet op de tijdlijn. Probeer een jaartal, een leeftijd (\"op 12-jarige leeftijd\") of een levensfase (\"als kind\").",
    "Nobody is in this tree yet. You could begin with yourself, then the people you grew up with.": "Er staat nog niemand in deze boom. Je kunt met jezelf beginnen, en daarna de mensen met wie je opgroeide.",
    "Not connected to anyone yet.": "Nog met niemand verbonden.",
    "Not on the timeline yet, no birth year: {names}.": "Nog niet op de tijdlijn, geen geboortejaar: {names}.",
    "Not yet born: {names}.": "Nog niet geboren: {names}.",
    "Not yet {age}: {names}.": "Nog geen {age}: {names}.",
    "Nothing recorded for {count} year.": "{count} jaar niets vastgelegd.",
    "Nothing recorded for {count} years.": "{count} jaar niets vastgelegd.",
    "Nothing recorded yet": "Nog niets vastgelegd",
    "Nothing recorded: {names}.": "Niets vastgelegd: {names}.",
    "Open tree": "Boom openen",
    "Open {name}": "{name} openen",
    "Opens this entry": "Opent deze vermelding",
    "Other trees": "Andere bomen",
    "Partner of": "Partner van",
    "Previous age": "Vorige leeftijd",
    "Previous year": "Vorig jaar",
    "Reads as {what}. Add a birth year to place it on the timeline.": "Gelezen als {what}. Voeg een geboortejaar toe om het op de tijdlijn te zetten.",
    "Reads as {what}: {where}.": "Gelezen als {what}: {where}.",
    "Reads as {when}, when {who}.": "Gelezen als {when}, toen {who}.",
    "Reads as {when}.": "Gelezen als {when}.",
    "Start a new tree": "Nieuwe boom beginnen",
    "Start with yourself": "Begin met jezelf",
    "Tap a year in the stripes.": "Tik op een jaar in de strepen.",
    "Timeline": "Tijdlijn",
    "Trauma event": "Trauma",
    "Trauma fills the year": "Trauma vult het jaar",
    "Turning point": "Keerpunt",
    "Untitled": "Zonder titel",
    "What did each of them need at {age}, and who could give it?": "Wat had ieder van hen nodig op hun {age}e, en wie kon dat geven?",
    "What did the youngest in the family understand about this year?": "Wat begreep de jongste in de familie van dit jaar?",
    "What do you remember of being {age} yourself?": "Wat herinner je je van toen je zelf {age} was?",
    "What was it like to be {age} in each of these homes?": "Hoe was het om {age} te zijn in elk van deze huizen?",
    "What was said at the table that year, and what was not?": "Wat werd er dat jaar aan tafel gezegd, en wat niet?",
    "What you write appears here, newest first. Only you can read it.": "Wat je schrijft verschijnt hier, het nieuwste bovenaan. Alleen jij kunt het lezen.",
    "Who carried this year, and who was kept outside it?": "Wie droeg dit jaar, en wie werd erbuiten gehouden?",
    "Who could anyone turn to that year?": "Bij wie kon iemand dat jaar terecht?",
    "Without a year": "Zonder jaartal",
    "Write about it": "Schrijf erover",
    "Write in your journal": "Schrijf in je dagboek",
    "Write your reflection here…": "Schrijf hier je reflectie…",
    "Year being read": "Gekozen jaar",
    "Years": "Jaren",
    "about {when}": "rond {when}",
    "age {age}": "{age} jaar",
    "ages {ages}": "{ages} jaar",
    "ages {from} to {to}": "{from} tot {to} jaar",
    "and": "en",
    "at {age}": "op {age}-jarige leeftijd",
    "born this year": "dit jaar geboren",
    "e.g. 1985, the sixties, as a child": "bijv. 1985, jaren zestig, als kind",
    "from age {age}": "vanaf {age} jaar",
    "from {year}": "vanaf {year}",
    "in {year}": "in {year}",
    "in {year}, this year": "in {year}, dit jaar",
    "with {names}": "met {names}",
    "{born}, living": "{born}, in leven",
    "{count} entries have no year yet, so they are not on the stripes.": "{count} gebeurtenissen hebben nog geen jaartal en staan daarom niet op de strepen.",
    "{count} more": "nog {count}",
    "{count} without a year": "{count} zonder jaartal",
    "{from} to {to}": "{from} tot {to}",
    "{names} has entries without a year, so there may be more here than the stripes show.": "{names} heeft gebeurtenissen zonder jaartal, dus er kan hier meer zijn dan de strepen laten zien.",
    "{names} have entries without a year, so there may be more here than the stripes show.": "{names} hebben gebeurtenissen zonder jaartal, dus er kan hier meer zijn dan de strepen laten zien.",
    "{name} was {age}": "{name} {age} was",
    "{years} for {name}": "{years} voor {name}",
    "{year} onwards": "vanaf {year}",
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
