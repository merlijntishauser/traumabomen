import SwiftUI

/// The companion's settings: the weekly reminder rhythm for now; auto-lock
/// timing, theme, and account management follow the web's settings panel in
/// later slices.
struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss

    @State private var confirmingLogout = false
    @ObservedObject private var loc = Loc.shared

    @State private var enabled = false
    @State private var weekday = 1
    @State private var hour = 20
    @State private var saving = false

    private let hours = Array(6...22)

    var body: some View {
        ZStack {
            Theme.bgPrimary.ignoresSafeArea()
            ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    Text(t("Settings"))
                        .font(Theme.heading(19))
                        .foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Button(t("Done")) { save() }
                        .font(Theme.body(Theme.bodySize, weight: .semibold))
                        .foregroundStyle(Theme.action)
                        .disabled(saving)
                }
                .padding(.top, 24)

                Text(t("Reminders"))
                    .font(Theme.body(13, weight: .semibold))
                    .foregroundStyle(Theme.textMuted)

                Toggle(isOn: $enabled) {
                    Text(t("A weekly reminder"))
                        .font(Theme.body(Theme.bodySize))
                        .foregroundStyle(Theme.textPrimary)
                }
                .tint(Theme.action)

                if enabled {
                    HStack {
                        Picker("Day", selection: $weekday) {
                            ForEach(1...7, id: \.self) { day in
                                Text(Reminders.weekdayName(day)).tag(day)
                            }
                        }
                        Picker("Hour", selection: $hour) {
                            ForEach(hours, id: \.self) { h in
                                Text(String(format: "%02d:00", h)).tag(h)
                            }
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(Theme.textPrimary)
                }

                Text(t("A gentle nudge, delivered on your device. The reminder never names what this app is for."))
                    .font(Theme.body(13))
                    .foregroundStyle(Theme.textMuted)

                Text(t("Appearance"))
                    .font(Theme.body(13, weight: .semibold))
                    .foregroundStyle(Theme.textMuted)
                    .padding(.top, 8)

                Picker(t("Theme"), selection: $model.themeMode) {
                    ForEach(ThemeMode.allCases, id: \.self) { mode in
                        Text(mode.label).tag(mode)
                    }
                }
                .pickerStyle(.segmented)

                Text(t("Language"))
                    .font(Theme.body(13, weight: .semibold))
                    .foregroundStyle(Theme.textMuted)
                    .padding(.top, 8)

                Picker(t("Language"), selection: $loc.language) {
                    ForEach(AppLanguage.allCases, id: \.self) { lang in
                        Text(lang.label).tag(lang)
                    }
                }
                .pickerStyle(.segmented)

                Text(t("Account"))
                    .font(Theme.body(13, weight: .semibold))
                    .foregroundStyle(Theme.textMuted)
                    .padding(.top, 8)

                Button {
                    if confirmingLogout {
                        Task { await model.logout(); dismiss() }
                    } else {
                        confirmingLogout = true
                    }
                } label: {
                    Text(t(confirmingLogout ? "Tap again to log out" : "Log out"))
                        .font(Theme.body(Theme.bodySize))
                        .foregroundStyle(Theme.danger)
                }

                Text(t("Logging out clears this device and returns to the sign-in screen, so you can use a different account."))
                    .font(Theme.body(13))
                    .foregroundStyle(Theme.textMuted)

                Text(t("About"))
                    .font(Theme.body(13, weight: .semibold))
                    .foregroundStyle(Theme.textMuted)
                    .padding(.top, 8)

                VStack(alignment: .leading, spacing: 6) {
                    Text(t("Traumatrees is a personal reflection tool, not therapy and not crisis support."))
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.textPrimary)
                    Text(t("Everything you write is encrypted on this device; the server only ever stores ciphertext. If you lose your passphrase, your data is unrecoverable. This is by design."))
                        .font(Theme.body(13))
                        .foregroundStyle(Theme.textMuted)
                    Text(t("Open source under AGPL-3.0. Bundled fonts (Playwrite NZ Basic, Lato, Fraunces) use the SIL Open Font License; icons are from Lucide (ISC License)."))
                        .font(Theme.body(12))
                        .foregroundStyle(Theme.textMuted)
                        .padding(.top, 4)
                    Text("\(t("Version")) \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? t("dev"))")
                        .font(Theme.body(12))
                        .foregroundStyle(Theme.textMuted)
                }

                Spacer(minLength: 24)
            }
            .padding(.horizontal, 24)
            }
        }
        .preferredColorScheme(model.themeMode.colorScheme)
        .onAppear {
            let s = Reminders.current
            enabled = s.enabled
            weekday = s.weekday
            hour = s.hour
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-enableReminder") {
                enabled = true; weekday = 3; hour = 20
                save()
            }
            #endif
        }
    }

    private func save() {
        saving = true
        let schedule = Reminders.Schedule(enabled: enabled, weekday: weekday, hour: hour)
        Task {
            let effective = await Reminders.apply(schedule)
            enabled = effective.enabled // reflect a declined authorization
            dismiss()
        }
    }
}
