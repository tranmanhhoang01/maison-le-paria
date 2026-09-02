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

// Where this app was built. Only a starting guess: the app may well be
// running on a different Mac, under a different user, from a different folder.
let builtAt = PROJECT_ROOT
let studioPort = STUDIO_PORT

/// Resolved at launch — see `locateProject()`.
var projectRoot = builtAt

// MARK: - Finding the project

private let savedRootKey = "projectRoot"

private func isProject(_ path: String) -> Bool {
    let fm = FileManager.default
    return fm.fileExists(atPath: path + "/studio/server.mjs")
        && fm.fileExists(atPath: path + "/package.json")
}

/**
 Three places to look, in order of how much they can be trusted:

 1. the folder the app is sitting in — copy the whole project to another Mac
    with the app inside it and everything simply works;
 2. a folder chosen previously and remembered;
 3. where the app happened to be built.

 If none of them hold a project, the app asks.
 */
func locateProject() -> String? {
    let parent = (Bundle.main.bundlePath as NSString).deletingLastPathComponent
    if isProject(parent) { return parent }
    if let saved = UserDefaults.standard.string(forKey: savedRootKey), isProject(saved) { return saved }
    if isProject(builtAt) { return builtAt }
    return nil
}

@discardableResult
func askForProject() -> String? {
    let panel = NSOpenPanel()
    panel.canChooseDirectories = true
    panel.canChooseFiles = false
    panel.allowsMultipleSelection = false
    panel.message = "Chọn thư mục dự án Maison Le Paria"
    panel.prompt = "Chọn"

    while panel.runModal() == .OK {
        guard let picked = panel.url?.path else { break }
        if isProject(picked) {
            UserDefaults.standard.set(picked, forKey: savedRootKey)
            return picked
        }
        let wrong = NSAlert()
        wrong.messageText = "Không phải thư mục dự án"
        wrong.informativeText = "Thư mục cần chứa package.json và studio/server.mjs.\nHãy chọn thư mục maison-le-paria."
        wrong.addButton(withTitle: "Chọn lại")
        wrong.runModal()
    }
    return nil
}

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
        guard let root = locateProject() ?? askForProject() else {
            fail("Không tìm thấy thư mục dự án Maison Le Paria.\n\nĐặt app vào bên trong thư mục dự án, hoặc mở lại và chọn thư mục đó.")
            return
        }
        projectRoot = root

        buildMenu()
        buildWindow()

        // If a Studio is already answering on this port — another window, or a
        // server left over from a previous run — use it rather than starting a
        // second one that would fight for the port and lose in silence.
        probe { [weak self] alive in
            if !alive { self?.startServer() }
            self?.waitForServer()
        }
    }

    /// One quick knock on the door, to see whether anyone is home.
    private func probe(_ done: @escaping (Bool) -> Void) {
        var request = URLRequest(url: URL(string: "http://localhost:\(studioPort)/api/state")!)
        request.timeoutInterval = 1.5
        URLSession.shared.dataTask(with: request) { _, response, _ in
            let alive = (response as? HTTPURLResponse)?.statusCode == 200
            DispatchQueue.main.async { done(alive) }
        }.resume()
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
        viewMenu.addItem(.separator())
        viewMenu.addItem(withTitle: "Đổi thư mục dự án…", action: #selector(changeProject), keyEquivalent: "")
        viewItem.submenu = viewMenu
        main.addItem(viewItem)

        NSApp.mainMenu = main
    }

    @objc private func reload() { webView.reload() }
    /// For when the project moves, or this Mac holds more than one copy.
    @objc private func changeProject() {
        guard let picked = askForProject() else { return }
        let alert = NSAlert()
        alert.messageText = "Đã đổi thư mục dự án"
        alert.informativeText = "\(picked)\n\nStudio sẽ khởi động lại để dùng thư mục mới."
        alert.addButton(withTitle: "Khởi động lại")
        alert.runModal()

        // Hand over to a fresh copy of ourselves, then step aside.
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        task.arguments = ["-n", Bundle.main.bundlePath]
        try? task.run()
        NSApp.terminate(nil)
    }

    @objc private func openSite() {
        NSWorkspace.shared.open(URL(string: "http://localhost:5173")!)
    }

    // MARK: Server

    private func startServer() {
        guard let node = findNode() else {
            fail("""
                Không tìm thấy Node trên máy này.

                Studio cần Node để chạy. Cài từ nodejs.org (bản LTS), mở lại app là xong.
                """)
            return
        }
        let task = Process()
        task.executableURL = URL(fileURLWithPath: node)
        task.arguments = ["studio/server.mjs"]
        task.currentDirectoryURL = URL(fileURLWithPath: projectRoot)
        var env = ProcessInfo.processInfo.environment
        env["STUDIO_PORT"] = String(studioPort)
        task.environment = env
        let output = Pipe()
        task.standardError = output
        do { try task.run(); server = task } catch {
            fail("Không khởi động được Studio.\n\n\(error.localizedDescription)")
            return
        }

        // A server that exits immediately has something to say; say it, rather
        // than leaving the window blank for thirty seconds.
        task.terminationHandler = { [weak self] finished in
            guard finished.terminationStatus != 0 else { return }
            let text = String(data: output.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            DispatchQueue.main.async {
                guard self?.webView.url == nil else { return }   // page already loaded; nothing to report
                self?.fail(text.isEmpty ? "Studio dừng ngay khi khởi động." : text)
            }
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
        /// Mở một địa chỉ ngoài bằng trình duyệt mặc định. Trong WKWebView,
        /// target="_blank" không làm gì cả, nên nút "Xem trang thật" phải nhờ
        /// tới đây.
        case "openUrl":
            if let raw = dict?["url"] as? String,
               let url = URL(string: raw),
               url.scheme == "https" || url.scheme == "http" {
                NSWorkspace.shared.open(url)
            }
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
