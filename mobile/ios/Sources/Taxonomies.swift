import Foundation

/// The category taxonomies and the DSM-5 catalogue, ported from the web
/// (frontend/src/lib/dsmCategories.ts and the locale files). Each Term carries
/// its stable storage key plus the EN and NL labels, so pickers store the key
/// and display in the active language without touching the general Loc dict.
/// Generated content; keep in step with the web sources.
struct Term: Identifiable, Hashable {
    let key: String
    let en: String
    let nl: String
    init(_ key: String, _ en: String, _ nl: String) { self.key = key; self.en = en; self.nl = nl }
    var id: String { key }
    func label(_ language: String) -> String { language == "nl" ? nl : en }
}

struct DsmGroup: Identifiable {
    let term: Term
    let code: String
    let subcategories: [Term]
    var id: String { term.key }
}

enum Taxonomies {
    static let trauma: [Term] = [
        Term("loss", "Loss", "Verlies"),
        Term("abuse", "Abuse", "Misbruik"),
        Term("addiction", "Addiction", "Verslaving"),
        Term("war", "War", "Oorlog"),
        Term("displacement", "Displacement", "Ontheemding"),
        Term("illness", "Illness", "Ziekte"),
        Term("poverty", "Poverty", "Armoede")
    ]
    static let life: [Term] = [
        Term("family", "Family", "Familie"),
        Term("education", "Education", "Opleiding"),
        Term("career", "Career", "Carriere"),
        Term("relocation", "Relocation", "Verhuizing"),
        Term("health", "Health", "Gezondheid"),
        Term("medication", "Medication", "Medicatie"),
        Term("other", "Other", "Overig")
    ]
    static let turning: [Term] = [
        Term("cycle_breaking", "Cycle-breaking", "Doorbreken van patronen"),
        Term("protective_relationship", "Protective relationship", "Beschermende relatie"),
        Term("recovery", "Recovery", "Herstel"),
        Term("achievement", "Achievement", "Prestatie"),
        Term("positive_change", "Positive change", "Positieve verandering")
    ]

    static let dsm: [DsmGroup] = [
        DsmGroup(term: Term("neurodevelopmental", "Neurodevelopmental Disorders", "Neurobiologische ontwikkelingsstoornissen"), code: "F70-F98", subcategories: [
            Term("adhd", "ADHD", "ADHD"),
            Term("autism", "Autism Spectrum Disorder", "Autismespectrumstoornis (ASS)"),
            Term("intellectual_disability", "Intellectual Disability", "Verstandelijke beperking"),
            Term("learning", "Specific Learning Disorder", "Specifieke leerstoornis"),
            Term("communication", "Communication Disorders", "Communicatiestoornissen"),
            Term("motor", "Motor Disorders", "Motorische stoornissen")
        ]),
        DsmGroup(term: Term("schizophrenia", "Schizophrenia Spectrum & Psychotic Disorders", "Schizofreniespectrum- en andere psychotische stoornissen"), code: "F20-F29", subcategories: [
            Term("schizophrenia_disorder", "Schizophrenia", "Schizofrenie"),
            Term("schizoaffective", "Schizoaffective Disorder", "Schizoaffectieve stoornis"),
            Term("brief_psychotic", "Brief Psychotic Disorder", "Kortdurende psychotische stoornis"),
            Term("delusional", "Delusional Disorder", "Waanstoornis")
        ]),
        DsmGroup(term: Term("bipolar", "Bipolar and Related Disorders", "Bipolaire-stemmingsstoornissen"), code: "F30-F31", subcategories: [
            Term("bipolar_i", "Bipolar I Disorder", "Bipolaire I stoornis"),
            Term("bipolar_ii", "Bipolar II Disorder", "Bipolaire II stoornis"),
            Term("cyclothymia", "Cyclothymic Disorder", "Cyclothyme stoornis")
        ]),
        DsmGroup(term: Term("depressive", "Depressive Disorders", "Depressieve-stemmingsstoornissen"), code: "F32-F33", subcategories: [
            Term("major_depression", "Major Depressive Disorder", "Depressieve stoornis"),
            Term("persistent_depressive", "Persistent Depressive Disorder (Dysthymia)", "Persisterende depressieve stoornis (dysthymie)"),
            Term("premenstrual_dysphoric", "Premenstrual Dysphoric Disorder (PMDD)", "Premenstruele stemmingsstoornis (PMDD)"),
            Term("seasonal_depression", "Seasonal Affective Disorder (SAD)", "Seizoensgebonden depressie (SAD)")
        ]),
        DsmGroup(term: Term("anxiety", "Anxiety Disorders", "Angststoornissen"), code: "F40-F41", subcategories: [
            Term("generalized_anxiety", "Generalized Anxiety Disorder (GAD)", "Gegeneraliseerde angststoornis (GAS)"),
            Term("panic_disorder", "Panic Disorder", "Paniekstoornis"),
            Term("social_anxiety", "Social Anxiety Disorder", "Sociale-angststoornis"),
            Term("specific_phobia", "Specific Phobia", "Specifieke fobie"),
            Term("agoraphobia", "Agoraphobia", "Agorafobie"),
            Term("separation_anxiety", "Separation Anxiety Disorder", "Separatieangststoornis")
        ]),
        DsmGroup(term: Term("ocd", "Obsessive-Compulsive and Related Disorders", "Obsessieve-compulsieve en verwante stoornissen"), code: "F42-F45", subcategories: [
            Term("ocd_disorder", "Obsessive-Compulsive Disorder (OCD)", "Obsessieve-compulsieve stoornis (OCS)"),
            Term("hoarding", "Hoarding Disorder", "Verzamelstoornis"),
            Term("body_dysmorphic", "Body Dysmorphic Disorder (BDD)", "Morfodysfore stoornis"),
            Term("hair_pulling", "Trichotillomania (Hair-Pulling Disorder)", "Trichotillomanie (haartrekstoornis)"),
            Term("skin_picking", "Excoriation (Skin-Picking Disorder)", "Excoriatiestoornis (huidpulkstoornis)")
        ]),
        DsmGroup(term: Term("trauma_stressor", "Trauma- and Stressor-Related Disorders", "Trauma- en stressorgerelateerde stoornissen"), code: "F43", subcategories: [
            Term("ptsd", "PTSD", "PTSS"),
            Term("acute_stress", "Acute Stress Disorder", "Acute stressstoornis"),
            Term("adjustment_disorder", "Adjustment Disorder", "Aanpassingsstoornis"),
            Term("reactive_attachment", "Reactive Attachment Disorder", "Reactieve hechtingsstoornis")
        ]),
        DsmGroup(term: Term("dissociative", "Dissociative Disorders", "Dissociatieve stoornissen"), code: "F44", subcategories: [
            Term("dissociative_identity", "Dissociative Identity Disorder (DID)", "Dissociatieve identiteitsstoornis (DIS)"),
            Term("dissociative_amnesia", "Dissociative Amnesia", "Dissociatieve amnesie"),
            Term("depersonalization", "Depersonalization/Derealization Disorder", "Depersonalisatie-/derealisatiestoornis")
        ]),
        DsmGroup(term: Term("somatic", "Somatic Symptom and Related Disorders", "Somatische-symptoomstoornis en verwante stoornissen"), code: "F45", subcategories: [
            Term("somatic_symptom", "Somatic Symptom Disorder", "Somatische-symptoomstoornis"),
            Term("illness_anxiety", "Illness Anxiety Disorder", "Ziektevreesstoornis"),
            Term("conversion", "Conversion Disorder", "Conversiestoornis"),
            Term("factitious", "Factitious Disorder", "Nagebootste stoornis")
        ]),
        DsmGroup(term: Term("eating", "Feeding and Eating Disorders", "Voedings- en eetstoornissen"), code: "F50", subcategories: [
            Term("anorexia", "Anorexia Nervosa", "Anorexia nervosa"),
            Term("bulimia", "Bulimia Nervosa", "Boulimia nervosa"),
            Term("binge_eating", "Binge-Eating Disorder", "Eetbuistoornis"),
            Term("avoidant_restrictive", "Avoidant/Restrictive Food Intake Disorder (ARFID)", "Vermijdende/restrictieve voedselinnamestoornis (ARFID)")
        ]),
        DsmGroup(term: Term("elimination", "Elimination Disorders", "Stoornissen in de zindelijkheid"), code: "F98", subcategories: [

        ]),
        DsmGroup(term: Term("sleep", "Sleep-Wake Disorders", "Slaap-waakstoornissen"), code: "F51", subcategories: [
            Term("insomnia", "Insomnia Disorder", "Insomniestoornis"),
            Term("hypersomnia", "Hypersomnolence Disorder", "Hypersomniestoornis"),
            Term("nightmare_disorder", "Nightmare Disorder", "Nachtmerriestoornis"),
            Term("sleepwalking", "Sleepwalking Disorder", "Slaapwandelstoornis")
        ]),
        DsmGroup(term: Term("sexual_dysfunction", "Sexual Dysfunctions", "Seksuele disfuncties"), code: "F52", subcategories: [

        ]),
        DsmGroup(term: Term("gender_dysphoria", "Gender Dysphoria", "Genderdysforie"), code: "F64", subcategories: [

        ]),
        DsmGroup(term: Term("impulse_control", "Disruptive, Impulse-Control, and Conduct Disorders", "Disruptieve, impulsbeheersings- en andere gedragsstoornissen"), code: "F91-F63", subcategories: [
            Term("oppositional_defiant", "Oppositional Defiant Disorder (ODD)", "Oppositioneel-opstandige stoornis (ODD)"),
            Term("conduct_disorder", "Conduct Disorder", "Normoverschrijdend-gedragsstoornis"),
            Term("intermittent_explosive", "Intermittent Explosive Disorder", "Periodieke explosieve stoornis"),
            Term("pyromania", "Pyromania", "Pyromanie"),
            Term("kleptomania", "Kleptomania", "Kleptomanie")
        ]),
        DsmGroup(term: Term("substance", "Substance-Related and Addictive Disorders", "Middelgerelateerde en verslavingsstoornissen"), code: "F10-F19", subcategories: [
            Term("alcohol_use", "Alcohol Use Disorder", "Stoornis in alcoholgebruik"),
            Term("cannabis_use", "Cannabis Use Disorder", "Stoornis in cannabisgebruik"),
            Term("stimulant_use", "Stimulant Use Disorder", "Stoornis in stimulantiagebruik"),
            Term("opioid_use", "Opioid Use Disorder", "Stoornis in opioïdengebruik"),
            Term("tobacco_use", "Tobacco Use Disorder", "Stoornis in tabaksgebruik"),
            Term("gambling", "Gambling Disorder", "Gokstoornis")
        ]),
        DsmGroup(term: Term("neurocognitive", "Neurocognitive Disorders", "Neurocognitieve stoornissen"), code: "F01-F09", subcategories: [
            Term("alzheimers", "Alzheimer's Disease", "Ziekte van Alzheimer"),
            Term("vascular_dementia", "Vascular Dementia", "Vasculaire dementie"),
            Term("mild_cognitive", "Mild Cognitive Impairment", "Lichte cognitieve stoornis"),
            Term("delirium", "Delirium", "Delirium")
        ]),
        DsmGroup(term: Term("personality", "Personality Disorders", "Persoonlijkheidsstoornissen"), code: "F60-F69", subcategories: [
            Term("borderline_pd", "Borderline Personality Disorder (BPD)", "Borderline-persoonlijkheidsstoornis (BPS)"),
            Term("narcissistic_pd", "Narcissistic Personality Disorder", "Narcistische persoonlijkheidsstoornis"),
            Term("antisocial_pd", "Antisocial Personality Disorder (ASPD)", "Antisociale persoonlijkheidsstoornis (ASPS)"),
            Term("avoidant_pd", "Avoidant Personality Disorder", "Ontwijkende persoonlijkheidsstoornis"),
            Term("dependent_pd", "Dependent Personality Disorder", "Afhankelijke persoonlijkheidsstoornis"),
            Term("obsessive_compulsive_pd", "Obsessive-Compulsive Personality Disorder (OCPD)", "Dwangmatige persoonlijkheidsstoornis (OCPS)"),
            Term("paranoid_pd", "Paranoid Personality Disorder", "Paranoïde persoonlijkheidsstoornis"),
            Term("schizotypal_pd", "Schizotypal Personality Disorder", "Schizotypische persoonlijkheidsstoornis")
        ]),
        DsmGroup(term: Term("paraphilic", "Paraphilic Disorders", "Parafiele stoornissen"), code: "F65", subcategories: [

        ]),
        DsmGroup(term: Term("other_mental", "Other Mental Disorders", "Overige psychische stoornissen"), code: "F99", subcategories: [

        ]),
        DsmGroup(term: Term("medication_induced", "Medication-Induced Movement Disorders", "Bewegingsstoornissen en andere bijwerkingen van medicatie"), code: "G25", subcategories: [

        ]),
        DsmGroup(term: Term("other_conditions", "Other Conditions", "Andere problemen die een reden voor zorg kunnen zijn"), code: "Z", subcategories: [

        ])
    ]
}
