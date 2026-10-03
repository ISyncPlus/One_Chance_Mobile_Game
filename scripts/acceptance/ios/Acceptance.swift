import XCTest
import UIKit

final class Acceptance: XCTestCase {
  let app = XCUIApplication(bundleIdentifier: "com.onechance.mobile")
  let worldLabel = "Diagnostic world. Gold token on a coordinate grid. Use the controls below as alternatives to gestures."

  override func setUp() {
    continueAfterFailure = false
    app.launchArguments = ["-EXDevMenuIsOnboardingFinished", "YES", "-EXDevMenuShowsAtLaunch", "NO", "-EXDevMenuShowFloatingActionButton", "NO"]
    XCUIDevice.shared.orientation = .landscapeLeft
  }

  func ready() {
    // First-use iOS scheme confirmation is a real setup step on a new simulator.
    for owner in [app, XCUIApplication(bundleIdentifier: "com.apple.springboard")] {
      let open = owner.alerts.buttons["Open"].firstMatch
      if open.exists { open.tap() }
    }
    XCTAssertTrue(app.buttons["Fit world"].waitForExistence(timeout: 60), app.debugDescription)
    XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", "SQLite 3.50.3 · WAL / FULL / FK on")).firstMatch.exists)
  }

  func capture(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    print("ACCEPTANCE \(name)\n\(app.debugDescription)")
  }

  func testLaunchCycles() {
    for cycle in 1...3 {
      app.terminate()
      app.launch()
      ready()
      capture("clean-launch-\(cycle)")
      XCUIDevice.shared.press(.home)
      app.activate()
      ready()
      capture("foreground-\(cycle)")
    }
  }

  func testObserveCurrentSession() {
    XCTAssertEqual(app.state, .runningForeground, "Verification must not relaunch a failed session")
    ready()
    capture("observed-session")
  }

  func testPackagedRelease() {
    for cycle in 1...3 {
      app.terminate(); app.launch()
      XCTAssertTrue(app.staticTexts["Technical foundation · Gameplay is not available in this build."].waitForExistence(timeout: 30))
      XCTAssertFalse(app.buttons["Fit world"].exists, "Development lab leaked into Release")
      XCTAssertGreaterThan(app.frame.width, app.frame.height)
      capture("offline-release-launch-\(cycle)")
      XCUIDevice.shared.press(.home); app.activate()
      XCTAssertTrue(app.staticTexts["One Chance"].exists)
    }
  }

  func testDevelopmentReloads() {
    app.launch(); ready()
    for cycle in 1...3 {
      var request = URLRequest(url: URL(string: "ws://127.0.0.1:8082/message")!)
      request.setValue("http://localhost:8082", forHTTPHeaderField: "Origin")
      let socket = URLSession.shared.webSocketTask(with: request)
      socket.resume()
      let sent = expectation(description: "Metro reload command delivered")
      socket.send(.string("{\"version\":2,\"method\":\"reload\"}")) { error in
        XCTAssertNil(error)
        sent.fulfill()
      }
      wait(for: [sent], timeout: 10)
      Thread.sleep(forTimeInterval: 3)
      socket.cancel(with: .normalClosure, reason: nil)
      XCTAssertEqual(app.state, .runningForeground)
      ready(); capture("development-reload-\(cycle)")
    }
  }

  // Locate the rendered token in a real screenshot, confined to the canvas.
  // The next tap therefore tests the visible sprite rather than assumed camera state.
  func tokenCoordinate() throws -> XCUICoordinate {
    let canvas = app.otherElements[worldLabel].firstMatch
    XCTAssertTrue(canvas.exists, app.debugDescription)
    let frame = canvas.frame
    let original = XCUIScreen.main.screenshot().image
    // UIImage may carry landscape orientation over portrait-backed pixels.
    let screenshot = UIGraphicsImageRenderer(size: original.size).image { _ in
      original.draw(at: .zero)
    }
    let cg = try XCTUnwrap(screenshot.cgImage)
    let width = cg.width, height = cg.height
    var rgba = [UInt8](repeating: 0, count: width * height * 4)
    let context = try XCTUnwrap(CGContext(data: &rgba, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue))
    context.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
    let scale = CGFloat(width) / screenshot.size.width
    var sx = 0, sy = 0, count = 0
    for y in max(0, Int(frame.minY * scale))..<min(height, Int(frame.maxY * scale)) {
      for x in max(0, Int(frame.minX * scale))..<min(width, Int(frame.maxX * scale)) {
        let i = (y * width + x) * 4
        if rgba[i] > 220 && rgba[i + 1] > 165 && rgba[i + 1] < 225 && rgba[i + 2] < 125 {
          sx += x; sy += y; count += 1
        }
      }
    }
    XCTAssertGreaterThan(count, 10, "Gold token absent from screenshot")
    guard count > 0 else { throw NSError(domain: "Acceptance", code: 1) }
    let p = CGPoint(x: CGFloat(sx) / CGFloat(count) / scale, y: CGFloat(sy) / CGFloat(count) / scale)
    return app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: p.x, dy: p.y))
  }

  func hit(_ name: String) throws {
    try tokenCoordinate().tap()
    let status = app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", "TOKEN HIT")).firstMatch
    XCTAssertTrue(status.waitForExistence(timeout: 10), app.debugDescription)
    capture(name)
  }

  func testInteractions() throws {
    app.launch(); ready()
    app.buttons["Fit world"].tap()
    try hit("baseline-hit")
    let canvas = app.otherElements[worldLabel].firstMatch
    canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.55, dy: 0.5)).press(forDuration: 0.05, thenDragTo: canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.65, dy: 0.55)))
    try hit("pan-hit")
    canvas.pinch(withScale: 1.3, velocity: 1)
    try hit("pinch-hit")
    app.buttons["Zoom +"].tap(); try hit("button-zoom-hit")
    app.buttons["Zoom −"].tap(); try hit("button-zoom-out-hit")
    app.buttons["Fit world"].tap()
    canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.8)).tap()
    XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", "Miss")).firstMatch.waitForExistence(timeout: 10))
    capture("empty-miss")
    app.buttons["Move token"].tap()
    Thread.sleep(forTimeInterval: 2)
    try hit("moved-hit")
    app.buttons["Haptic"].tap()
    XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "Haptic API resolved")).firstMatch.waitForExistence(timeout: 10))
    capture("haptic-api")
    app.buttons["Capture 10s"].tap()
    app.buttons["Move token"].tap()
    XCUIDevice.shared.press(.home)
    app.activate(); ready()
    XCTAssertTrue(app.staticTexts["Capture cancelled: app left foreground"].waitForExistence(timeout: 10))
    capture("background-animation")
    XCUIDevice.shared.orientation = .landscapeRight
    ready(); capture("landscape-right")
    XCUIDevice.shared.orientation = .landscapeLeft
    ready(); capture("landscape-left")
  }
}
