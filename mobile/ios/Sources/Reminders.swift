import Foundation
import UserNotifications

/// Optional weekly reminders, delivered as local notifications: no push
/// infrastructure, nothing leaves the device. The copy is deliberately
/// neutral, never naming the app's subject, so a lock-screen glance reveals
/// nothing. The preference persists in UserDefaults (a weekday + hour, or
/// off); the encryption key is never involved.
enum Reminders {
    private static let enabledKey = "reminders.enabled"
    private static let weekdayKey = "reminders.weekday" // 1 = Sunday ... 7 = Saturday
    private static let hourKey = "reminders.hour"
    private static let requestId = "org.traumabomen.companion.weekly-reminder"

    // Neutral by design: an invitation, not an instruction, and no subject.


    struct Schedule: Equatable {
        var enabled: Bool
        var weekday: Int
        var hour: Int
    }

    static var current: Schedule {
        let d = UserDefaults.standard
        return Schedule(
            enabled: d.bool(forKey: enabledKey),
            weekday: d.object(forKey: weekdayKey) as? Int ?? 1, // Sunday
            hour: d.object(forKey: hourKey) as? Int ?? 20 // 20:00
        )
    }

    /// Apply a schedule: request authorization if needed, then (re)install or
    /// cancel the single repeating request. Returns the effective schedule
    /// (enabled is forced off if the user declined authorization).
    @discardableResult
    static func apply(_ schedule: Schedule) async -> Schedule {
        let center = UNUserNotificationCenter.current()

        var effective = schedule
        if schedule.enabled {
            #if DEBUG
            // Headless tests cannot answer the permission dialog; this flag
            // exercises the scheduling path without it. Never set in release.
            let bypass = ProcessInfo.processInfo.arguments.contains("-skipNotificationAuth")
            effective.enabled = bypass ? true : await ensureAuthorized(center)
            #else
            effective.enabled = await ensureAuthorized(center)
            #endif
        }

        let d = UserDefaults.standard
        d.set(effective.enabled, forKey: enabledKey)
        d.set(effective.weekday, forKey: weekdayKey)
        d.set(effective.hour, forKey: hourKey)

        center.removePendingNotificationRequests(withIdentifiers: [requestId])
        guard effective.enabled else { return effective }

        let content = UNMutableNotificationContent()
        content.title = t("A quiet moment")
        content.body = t("If you would like one, it is here.")

        var components = DateComponents()
        components.weekday = effective.weekday
        components.hour = effective.hour
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        try? await center.add(
            UNNotificationRequest(identifier: requestId, content: content, trigger: trigger)
        )
        return effective
    }

    /// Only request authorization when the user has not yet decided; if they
    /// already granted (or provisionally) we skip straight to scheduling, and
    /// a prior denial is respected without nagging.
    private static func ensureAuthorized(_ center: UNUserNotificationCenter) async -> Bool {
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return true
        case .denied:
            return false
        default:
            return (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
        }
    }

    static func weekdayName(_ day: Int) -> String {
        let en = [1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday",
                  5: "Thursday", 6: "Friday", 7: "Saturday"]
        let nl = [1: "zondag", 2: "maandag", 3: "dinsdag", 4: "woensdag",
                  5: "donderdag", 6: "vrijdag", 7: "zaterdag"]
        return (Loc.shared.effective == "nl" ? nl : en)[day] ?? ""
    }
}
