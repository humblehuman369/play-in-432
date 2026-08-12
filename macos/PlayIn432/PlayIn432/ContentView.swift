import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        WebView()
            .ignoresSafeArea()
    }
}

/// Loads the same Vite/Capacitor web UI from the app bundle `public/` folder.
struct WebView: NSViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        // Bridge for future native IAP if needed
        let userContent = config.userContentController
        userContent.add(context.coordinator, name: "playin432")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.setValue(false, forKey: "drawsBackground")
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsMagnification = true

        if let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "public") {
            webView.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        } else if let index = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        } else {
            let html = """
            <html><body style="font-family:-apple-system;background:#070b0f;color:#e8f7f3;padding:40px">
            <h1>Play In 432</h1>
            <p>Web assets missing. Run <code>npm run mobile:sync</code> then rebuild the Mac target.</p>
            </body></html>
            """
            webView.loadHTMLString(html, baseURL: nil)
        }
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            // Reserved for native purchase / share bridges.
            _ = message.body
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            // Keep app navigations in-web; open external http(s) in browser
            if navigationAction.navigationType == .linkActivated,
               let scheme = url.scheme?.lowercased(),
               scheme == "http" || scheme == "https",
               url.host != nil,
               !url.isFileURL
            {
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
