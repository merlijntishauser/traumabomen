import SwiftUI

@main
struct TraumatreesApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .modifier(PrivacyShieldModifier())
                .environmentObject(model)
                .preferredColorScheme(model.themeMode.colorScheme)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var model: AppModel
    // Observe the language so a switch re-renders the tree in place, rather
    // than rebuilding the root (which would dismiss the settings sheet).
    @ObservedObject private var loc = Loc.shared

    var body: some View {
        ZStack {
            Theme.bgPrimary.ignoresSafeArea()
            switch model.phase {
            case .welcome:
                WelcomeView { }
                    .environmentObject(model)
            case .login:
                LoginView()
            case .biometric:
                BiometricUnlockView()
            case .treeList:
                TreeListView()
            case .unlock(let hint):
                UnlockView(hint: hint)
            case .working(let message):
                VStack(spacing: 16) {
                    ProgressView().tint(Theme.textMuted)
                    Text(message)
                        .font(Theme.body(Theme.bodySize))
                        .foregroundStyle(Theme.textMuted)
                }
            case .journal(let entries):
                HomeView(entries: entries)
            }
        }
        #if DEBUG
        .task { await model.debugAutoFlow() }
        #endif
    }
}
