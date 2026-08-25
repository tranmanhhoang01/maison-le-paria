//  Maison Le Paria — Studio
//
//  A real Mac application, not a browser tab. It owns its window, its Dock
//  icon and its own lifetime: it starts the local studio server when it opens
//  and stops it when it quits, so there is never a stray process left behind.
//
//  The interface itself is the same HTML the server already serves — but file
//  handling is native, because that is the part a web page cannot do well:
//  dropping photographs from Finder onto the window, and the Open panel.

import AppKit
import WebKit

// Written into the binary at build time by studio/mac/build.mjs
let projectRoot = PROJECT_ROOT
let studioPort = STUDIO_PORT

// MARK: - Finding node

func findNode() -> String? {
    let candidates = [
        NSHomeDirectory() + "/.local/node/bin/node",
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
    ]
    for path in candidates where FileManager.default.isExecutableFile(atPath: path) {
        return path
    }
    // Last resort: ask a login shell, which knows about nvm and friends.
    let shell = Process()
    shell.executableURL = URL(fileURLWithPath: "/bin/zsh")
    shell.arguments = ["-lc", "command -v node"]
    let pipe = Pipe()
    shell.standardOutput = pipe
    try? shell.run()
    shell.waitUntilExit()
    let found = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
        .trimmingCharacters(in: .whitespacesAndNewlines)
    return (found?.isEmpty == false) ? found : nil
}

// MARK: - A view that accepts photographs from Finder

final class DropView: NSView {
    var onDrop: (([String]) -> Void)?

    override init(frame: NSRect) {
        super.init(frame: frame)
        registerForDraggedTypes([.fileURL])
    }
    required init?(coder: NSCoder) { fatalError() }

    /// Photographs and music both arrive this way. Which one a file *means*
    /// depends on which section is open, so that decision belongs to the page,
    /// not here.
    private func acceptedURLs(_ sender: NSDraggingInfo) -> [String] {
        let types = ["jpg", "jpeg", "png", "tif", "tiff", "webp",
                     "m4a", "mp3", "wav", "aif", "aiff", "aac", "flac"]
        let items = sender.draggingPasteboard.readObjects(forClasses: [NSURL.self]) as? [URL] ?? []
        return items
            .filter { types.contains($0.pathExtension.lowercased()) }
            .map { $0.path }
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        acceptedURLs(sender).isEmpty ? [] : .copy
    }
    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        let paths = acceptedURLs(sender)
        guard !paths.isEmpty else { return false }
        onDrop?(paths)
        return true
    }
}

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandlerWithReply {
    var window: NSWindow!
    var webView: WKWebView!
    var server: Process?

    func applicationDidFinishLaunching(_ note: Notification) {
        buildMenu()
        buildWindow()
        startServer()
        waitForServer()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ note: Notification) {
        // The server is ours; it does not outlive the window.
        server?.terminate()
    }

    // MARK: Window

    private func buildWindow() {
        let frame = NSRect(x: 0, y: 0, width: 1180, height: 800)
        window = NSWindow(
            contentRect: frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered, defer: false
        )
        window.title = "Studio — Maison Le Paria"
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(red: 0.043, green: 0.047, blue: 0.051, alpha: 1)
        window.setFrameAutosaveName("StudioWindow")
        window.minSize = NSSize(width: 900, height: 600)

        let config = WKWebViewConfiguration()
        // This is a control room, not a website: pressing play on a preview
        // should play it, without a separate "user gesture" dance.
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "studio")

        webView = WKWebView(frame: frame, configuration: config)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")
        // The page fills the window; the title bar floats over its top edge.
        webView.frame = frame

        let drop = DropView(frame: frame)
        drop.autoresizingMask = [.width, .height]
        drop.addSubview(webView)
        drop.onDrop = { [weak self] paths in self?.handoff(paths) }

        window.contentView = drop
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func buildMenu() {
        let main = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Về Studio", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Ẩn", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Thoát", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)

        // Without this menu the standard keyboard shortcuts do not exist, and
        // ⌘V does nothing anywhere in the app — including in the box that asks
        // for a GitHub address, which is the one place it is needed most.
        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Sửa")
        editMenu.addItem(withTitle: "Hoàn tác", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Làm lại", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cắt", action: Selector(("cut:")), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Sao chép", action: Selector(("copy:")), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Dán", action: Selector(("paste:")), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Chọn tất cả", action: Selector(("selectAll:")), keyEquivalent: "a")
        editItem.submenu = editMenu
        main.addItem(editItem)

        let viewItem = NSMenuItem()
        let viewMenu = NSMenu(title: "Hiển thị")
        viewMenu.addItem(withTitle: "Tải lại", action: #selector(reload), keyEquivalent: "r")
        viewMenu.addItem(withTitle: "Mở website", action: #selector(openSite), keyEquivalent: "p")
        viewItem.submenu = viewMenu
        main.addItem(viewItem)

        NSApp.mainMenu = main
    }

    @objc private func reload() { webView.reload() }
    @objc private func openSite() {
        NSWorkspace.shared.open(URL(string: "http://localhost:5173")!)
    }

    // MARK: Server

    private func startServer() {
        guard let node = findNode() else {
            fail("Không tìm thấy Node trên máy.\n\nStudio cần Node để chạy. Bản đã cài nằm ở ~/.local/node.")
            return
        }
        let task = Process()
        task.executableURL = URL(fileURLWithPath: node)
        task.arguments = ["studio/server.mjs"]
        task.currentDirectoryURL = URL(fileURLWithPath: projectRoot)
        var env = ProcessInfo.processInfo.environment
        env["STUDIO_PORT"] = String(studioPort)
        task.environment = env
        do { try task.run(); server = task } catch {
            fail("Không khởi động được Studio.\n\n\(error.localizedDescription)")
        }
    }

    /// Polls the port rather than guessing at a delay, then loads the page.
    private func waitForServer(attempt: Int = 0) {
        let url = URL(string: "http://localhost:\(studioPort)/api/state")!
        var request = URLRequest(url: url)
        request.timeoutInterval = 1

        URLSession.shared.dataTask(with: request) { [weak self] _, response, _ in
            guard let self else { return }
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                DispatchQueue.main.async {
                    self.webView.load(URLRequest(url: URL(string: "http://localhost:\(self.studioPortValue)/")!))
                }
                return
            }
            if attempt > 60 {
                DispatchQueue.main.async { self.fail("Studio không phản hồi sau 30 giây.") }
                return
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.waitForServer(attempt: attempt + 1)
            }
        }.resume()
    }

    private var studioPortValue: Int { studioPort }

    private func fail(_ text: String) {
        let alert = NSAlert()
        alert.messageText = "Studio"
        alert.informativeText = text
        alert.alertStyle = .critical
        alert.addButton(withTitle: "Đóng")
        alert.runModal()
        NSApp.terminate(nil)
    }

    // MARK: Files

    /// Dropped or chosen files are handed to the page, which asks the local
    /// server to import them by path — no bytes travel through HTTP, because
    /// both ends are already on this machine.
    private func handoff(_ paths: [String]) {
        guard let data = try? JSONSerialization.data(withJSONObject: paths),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.__nativeImport && window.__nativeImport(\(json))")
    }

    func userContentController(
        _ controller: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        // The page sends either a bare name or { action, kind }.
        let dict = message.body as? [String: Any]
        let action = (message.body as? String) ?? (dict?["action"] as? String) ?? ""
        let kind = dict?["kind"] as? String ?? "image"

        switch action {
        case "pickFiles", "pick":
            let audio = kind == "audio"
            let panel = NSOpenPanel()
            panel.allowsMultipleSelection = !audio
            panel.canChooseDirectories = false
            panel.allowedContentTypes = audio
                ? [.mpeg4Audio, .mp3, .wav, .aiff, .audio]
                : [.jpeg, .png, .tiff, .webP]
            panel.message = audio ? "Chọn tệp nhạc nền" : "Chọn ảnh để thêm vào bộ"
            panel.begin { result in
                replyHandler(result == .OK ? panel.urls.map(\.path) : [], nil)
            }
        case "revealOriginals":
            NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: projectRoot)
            replyHandler(nil, nil)
        default:
            replyHandler(nil, nil)
        }
    }

    // A window that fails to load should say so, not sit there black.
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        note("Không mở được giao diện Studio.\n\n\(error.localizedDescription)")
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        note("Giao diện Studio gặp lỗi.\n\n\(error.localizedDescription)")
    }
    private func note(_ text: String) {
        let alert = NSAlert()
        alert.messageText = "Studio"
        alert.informativeText = text
        alert.addButton(withTitle: "Đóng")
        alert.runModal()
    }

    // A page-driven <input type="file"> still needs a panel of its own.
    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = false
        panel.begin { completionHandler($0 == .OK ? panel.urls : nil) }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = "Studio"
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.runModal()
        completionHandler()
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = "Studio"
        alert.informativeText = message
        alert.addButton(withTitle: "Đồng ý")
        alert.addButton(withTitle: "Huỷ")
        completionHandler(alert.runModal() == .alertFirstButtonReturn)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = "Studio"
        alert.informativeText = prompt
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Huỷ")

        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 420, height: 24))
        field.stringValue = defaultText ?? ""
        field.isEditable = true
        field.isSelectable = true
        alert.accessoryView = field
        alert.window.initialFirstResponder = field

        completionHandler(alert.runModal() == .alertFirstButtonReturn ? field.stringValue : nil)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
