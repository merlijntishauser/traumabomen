import Foundation

/// Lookup helpers over the generated taxonomies (kept separate so Taxonomies.swift
/// stays purely generated content).
extension Taxonomies {
    static func dsmGroup(_ categoryKey: String) -> DsmGroup? {
        dsm.first { $0.term.key == categoryKey }
    }

    /// The display label for a classification: the subcategory if set, else the
    /// category. Falls back to the raw key if the taxonomy has drifted.
    static func dsmLabel(category: String, subcategory: String?, language: String) -> String {
        guard let group = dsmGroup(category) else { return category }
        if let sub = subcategory, !sub.isEmpty,
           let subTerm = group.subcategories.first(where: { $0.key == sub }) {
            return subTerm.label(language)
        }
        return group.term.label(language)
    }

    /// The label for a key within a term list (trauma/life/turning categories).
    static func label(in terms: [Term], key: String, language: String) -> String {
        terms.first { $0.key == key }?.label(language) ?? key
    }
}
