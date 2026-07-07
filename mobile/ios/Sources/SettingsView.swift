import SwiftUI

/// The companion's settings: the weekly reminder rhythm for now; auto-lock
/// timing, theme, and account management follow the web's settings panel in
/// later slices.
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var enabled = false
    @State private var weekday = 1
    @State private var hour = 20
    @State private var saving = false

    private let hours = Array(6...22)

    var body: some View {
        ZStack {
            Theme.bgPrimary.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    Text("Settings")
                        .font(.system(size: 26, weight: .light))
                        .foregroundStyle(Theme.textPrimary)
                    Spacer()
                    Button("Done") { save() }
                        .font(.system(size: Theme.bodySize, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                        .disabled(saving)
                }
                .padding(.top, 24)

                Text("Reminders")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.textMuted)

                Toggle(isOn: $enabled) {
                    Text("A weekly reminder")
                        .font(.system(size: Theme.bodySize))
                        .foregroundStyle(Theme.textPrimary)
                }
                .tint(Theme.accent)

                if enabled {
                    HStack {
                        Picker("Day", selection: $weekday) {
                            ForEach(1...7, id: \.self) { day in
                                Text(Reminders.weekdayNames[day] ?? "").tag(day)
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

                Text("A gentle nudge, delivered on your device. The reminder never names what this app is for.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.textMuted)

                Spacer()
            }
            .padding(.horizontal, 24)
        }
        .preferredColorScheme(.dark)
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
