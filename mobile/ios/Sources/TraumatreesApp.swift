import SwiftUI

@main
struct TraumatreesApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .preferredColorScheme(.dark)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            Theme.bgPrimary.ignoresSafeArea()
            switch model.phase {
            case .login:
                LoginView()
            case .biometric:
                BiometricUnlockView()
            case .unlock(let hint):
                UnlockView(hint: hint)
            case .working(let message):
                VStack(spacing: 16) {
                    ProgressView().tint(Theme.textMuted)
                    Text(message)
                        .font(.system(size: Theme.bodySize))
                        .foregroundStyle(Theme.textMuted)
                }
            case .journal(let entries):
                JournalListView(entries: entries)
            }
        }
        #if DEBUG
        .task { await model.debugAutoFlow() }
        #endif
    }
}
