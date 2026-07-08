import SwiftUI

/// Centers its content vertically when the screen is tall enough, and lets it
/// scroll when space is tight (landscape, keyboard visible). Portrait looks
/// unchanged, but nothing clips in landscape.
struct CenteredScroll<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                content
                    .frame(maxWidth: .infinity, minHeight: proxy.size.height)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }
}
