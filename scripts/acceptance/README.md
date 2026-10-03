# Native diagnostic acceptance

Host-side test tooling only. No application imports these files. Outputs go under ignored `artifacts/phase-1b`. Run suites sequentially on each device; do not send other input while a suite is running. Preserve failed logs separately when retrying.

Prerequisites: the locked app's native Debug install, Metro on localhost port 8082, Java 17, Android SDK, Xcode, and CocoaPods' existing `xcodeproj` Ruby gem. The Android screenshot checks additionally use host Python with Pillow. These are optional host tools, not new application dependencies. This machine used the bundled Codex Python runtime; another machine may supply its own Pillow installation.

## Android

Set `ANDROID_SDK_ROOT` to the SDK containing the AVD. On this machine it is `/Users/InhouseHQ/Library/Android/sdk`; the alternate `/Library/android` value is incorrect. `build.sh` uses installed build tools 37.0.0 and the API 36 test-platform jar; adjust those host paths if the installed toolchain differs.

```sh
sh scripts/acceptance/android/build.sh
"$ANDROID_SDK_ROOT/platform-tools/adb" install -r artifacts/phase-1b/android-tests/acceptance.apk
"$ANDROID_SDK_ROOT/platform-tools/adb" reverse tcp:8082 tcp:8082
python3 scripts/acceptance/android/run.py
python3 scripts/acceptance/android/lifecycle.py
python3 scripts/acceptance/android/orientation.py
```

For packaged offline acceptance, install the generated Release APK, stop Metro, remove adb reverse forwarding, enable airplane mode on the test emulator, and run `python3 scripts/acceptance/android/release.py`. This test checks actual PID absence before cold launches. Restore the emulator's connectivity afterwards. The locally generated Release APK uses the CNG debug signing key and is not a store package.

Start the actual lab before the interaction suite. `ANDROID_SERIAL` selects a device; `ONE_CHANCE_ACCEPTANCE_OUTPUT` selects a fresh evidence directory. The helper test APK targets its own package, so instrumentation does not restart the game process. It injects real multi-pointer MotionEvents and refuses injection unless One Chance is foreground. Pixel detection locates the rendered sprite, then native taps test its actual hit region. A 400 px starting span expanding by 1.8 exceeds the emulator's pinch threshold; event delivery alone does not count as successful zoom. The suite asserts visible token growth.

The floating Expo dev-menu button can overlap the top of the canvas. Empty-space test taps use lower canvas corners clear of that button. Fresh accessibility dumps are required; a `null root` response must not reuse a stale XML file. API completion does not establish physical haptic sensation.

## iOS

```sh
ruby scripts/acceptance/ios/project.rb
xcodebuild -project artifacts/phase-1b/ios-tests/Acceptance.xcodeproj \
  -scheme Acceptance -destination 'platform=iOS Simulator,id=SIMULATOR_UUID' \
  -derivedDataPath artifacts/phase-1b/ios-test-build \
  -resultBundlePath artifacts/phase-1b/UNIQUE_RESULT.xcresult \
  -only-testing:Acceptance/Acceptance/testLaunchCycles \
  -only-testing:Acceptance/Acceptance/testInteractions \
  CODE_SIGNING_ALLOWED=NO test
```

Install and open the actual Debug client first. `testDevelopmentReloads` sends real Metro reload messages. `testObserveCurrentSession` verifies the already-running app without relaunching a failed session. `testPackagedRelease` is for an installed Release app with Metro stopped. Select those tests separately; do not run every test against the same build configuration.

XCTest handles the first-use system scheme confirmation, performs genuine pan/pinch/taps, captures the rendered gold sprite, and attaches screenshots plus native accessibility hierarchies. Simulator screenshot orientation metadata is normalized before image-coordinate taps. Export result attachments with `xcrun xcresulttool export attachments`; visually inspect them.

## Repeated Metro sessions

Stop this project's existing server before running `python3 scripts/acceptance/metro-sessions.py`. Set the Android SDK/Pillow environment as above and optionally `ONE_CHANCE_IOS_SIMULATOR`. The script owns port 8082 only, starts/stops three Metro processes, and records Android and iOS outcomes separately. Cycle 1 deliberately keeps warm clients; later cycles terminate them first. Port 8081 belonging to another project is not touched.

Maintain sufficient free disk space and test one simulator at a time when memory is tight. The ordinary safe workflow and observed limitations are in the [acceptance report](../../docs/phase-1b-verification.md).
