# Phase 1B stabilization and acceptance — 3 October 2026

This pass adds native acceptance tooling and documentation only. Application TypeScript, physical-rule content, native configuration, architecture boundaries and resolved dependency versions remain unchanged. No gameplay or Phase 2 implementation was added. The historical Phase 1 failures remain recorded in [the original report](phase-1-verification.md).

## 1. Android development-client investigation

The best-supported explanation for the earlier `App react context shouldn't be created before.` exception is a development-launcher/ReactHost lifecycle race during warm reentry. This is an inference from the installed native implementation, not a conclusively reproduced fix:

- `expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/DevLauncherController.kt`, `ensureHostWasCleared` / `clearHost`, calls `host.destroy(...)` before launching another session. It does not wait for the returned destruction task.
- `react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactHostImpl.kt` explicitly defines destruction as asynchronous. Context teardown happens later in that operation.
- `DevLauncherAppLoader.kt:49` requires `currentReactContext == null` when the next activity delegate is created. A surviving context violates this invariant before the new application's JS is evaluated.
- Application source contains no ReactHost creation/destruction or Dev Launcher control calls. There is no evidence here of a game-layer, SQLite, Skia, or Reanimated initialization defect causing this invariant violation. The New Architecture integration is part of the implicated native lifecycle; disabling it would not establish the root cause and was not attempted.

A [historical Expo issue reports the same exception](https://github.com/expo/expo/issues/35385). It concerns an older SDK and was closed without a sufficient reproduction; it does not establish a current SDK fix.

This pass did not reproduce that exception in three ordinary reloads, three warm deep-link trials, or three Metro restart sessions, including one deliberately warm reentry. Their saved crash buffers contain no application fatal exception. Therefore the original failure is **not declared fixed**.

The previous ANR cannot be conclusively diagnosed: its original thread trace was not retained. Current emulator `dumpsys activity lastanr` reports no ANR since boot. Later failures in this pass have direct environment evidence: software Vulkan ColorBuffer allocation failures, stalled input/accessibility commands, repeated ENOSPC, and a refused emulator boot for insufficient disk space. These explain those later unreliable trials; they do not prove the historical ANR had the same cause.

## 2. iOS Refreshing investigation

The banner belongs to development loading tooling. Expo's installed `src/async-require/hmr.ts` shows a loading message on noninitial HMR `update-start` and hides it on `update-done` or connection close. React Native's `RCTDevLoadingView.mm` handles the native overlay on the main queue. Application code neither creates nor hides it.

The original persistent banner's exact missing/delayed event was not captured, and it did not recur in this pass's three native Metro reload tests or three Metro restart observations. Fresh launches and packaged Release launches were unobstructed. The evidence supports development HMR/loading lifecycle behaviour rather than an application lifecycle defect, but the historical cause remains unconfirmed. No synchronous-import experiment, banner dismissal hack, warning filter, or native overlay patch was retained.

## 3. Clean-start test matrix

All results below are simulator/emulator results. A process cold start is distinct from a whole-device reboot. Force-stop/termination trials necessarily also perform cold process launches; those observations are not counted twice as independent evidence.

| Operation | iOS | Android |
| --- | --- | --- |
| Initial launch after simulator/emulator boot | PASS; large phone, small phone and iPad | PASS; Pixel 8 Pro cold AVD boot |
| Terminate/force-stop → fresh launch | 3/3 on each of the three configurations | 3/3 explicit lifecycle trials |
| Background → foreground | 3/3 on each iOS configuration | 3/3 explicit lifecycle trials |
| Actual Metro app reload | 3/3 XCTest reload commands | 3/3 reload commands |
| Metro restart → launch | 3/3; first warm reentry, two terminated-client sessions | 3/3, same restart sessions |
| Additional warm deep-link reentry | Not separately counted beyond warm Metro trial | 3/3 |
| Background while animating | PASS on all three iOS configurations | PASS in complete interaction suite |
| Packaged Release process cold launch | 3/3 with Metro stopped | 3/3 with Metro stopped and airplane mode enabled |
| Packaged Release background/resume | 3/3 | 3/3 |

Repeated sessions were recorded independently. Evidence: `artifacts/phase-1b/ios-large-tests.log` (launch test passed), `ios-large-final.log`, `ios-small-final.log`, `ios-tablet-final.log`, `ios-reload.log`, `android-lifecycle-final.jsonl`, and `metro-sessions.jsonl`. Screenshot attachments accompany the native results. The first large-phone result container suffered disk exhaustion; its launch log is retained and the interaction test was rerun successfully.

### Failed trials retained separately

| Failure | Classification and follow-up |
| --- | --- |
| Historical Android exception and ANR; historical iOS stuck banner | Still unresolved historical observations. Fresh successes do not erase them. |
| Initial large iOS image-coordinate test found no gold pixels | Test harness failed to normalize UIImage landscape orientation. Corrected; rerun passed. |
| Initial small iOS launch did not reach the lab | First-use system “Open in OneChance?” confirmation was still displayed. XCTest now acknowledges the real alert. Rerun passed. |
| First iPad result failed/could not be finalized | ENOSPC disrupted result recording. After project-owned cleanup, both tests passed with valid screenshots and result metadata. |
| Narrow Android pinch delivered events without visible zoom | 180 px span enlarged by 1.3 did not activate the gesture. A larger genuine pinch passes a visible-size assertion. Event delivery alone was never counted as zoom success. |
| A token hit after an early Android rotation missed | Retained failed trial during the unreliable software-renderer session. Stable hardware-backed rotation tests now clear prior hit status and pass in actual rotations 1 and 3. Exact cause of that individual earlier mismatch is not independently proven. |
| Android input and accessibility commands stalled | Software GPU logged ColorBuffer allocation failures; emulator was restarted using host graphics and 2 GB RAM. No app architecture changed. |
| Android readiness checks briefly reused stale accessibility XML | `uiautomator` can return a null root without deleting its previous file. Harness now deletes stale XML and requires a successful fresh dump. |
| Strengthened empty-space tap opened Expo's dev menu | Test tapped the floating dev button over the upper canvas. Empty-space points now stay in the lower canvas. The actual menu was inspected and dismissed before rerunning. |
| Initial native Release builds failed | ENOSPC on both platforms. Only project-generated build outputs were cleaned; failed logs preserved. |
| Later Android Release attempt failed | Maven `groovy-3.0.22.jar` and `error_prone_annotations-2.28.0.jar` downloads returned `No route to host`. A fresh Java process with IPv4 enabled completed the unchanged build, including Release lint. |

Some readiness retries logged a transient null accessibility root during app startup. These are host automation observations, not suppressed application runtime errors. No fresh launch is accepted without the real lab and SQLite policy being visible.

## 4. iOS diagnostic interactions

XCTest performed native pan, two-finger pinch, zoom in/out buttons, token taps before and after movement, transformed token taps, an empty-space miss, haptic API invocation, and background/resume during a 1.2 second token animation. It exercised both landscape directions on iPhone 17 Pro Max, iPhone 16e and iPad mini. Token tap coordinates came from the rendered gold pixels rather than assumed camera coordinates. Status and screenshot evidence show hits around the diagnostic origin (240, 240) and destination (720, 240). These are temporary diagnostic coordinates, not game locations.

Backgrounding cancels the active frame capture and token animation; screenshots show the token at its interrupted position after resume. Haptic promises resolve; physical sensation is not established. No unsupported simulator gesture was substituted with a button press.

## 5. Android diagnostic interactions

Native adb pan and taps plus an isolated instrumentation APK injected a real two-pointer pinch. The test APK targets its own package, avoiding a restart of One Chance's process. The final strengthened suite clears the prior hit using an actual miss before each token tap. It passes baseline, pan, pinch, button zoom in/out, movement, destination hit, haptic API enabled/disabled, and background/resume cancellation.

At the baseline the rendered token width is 75 px; the accepted native pinch grows it to approximately 115 px and button zoom to 143 px. Origin hits resolve near (239.9, 239.6); destination hits near (719.9, 239.6). Actual accelerometer rotation produced UI rotation values 1 and 3, swapped the cutout safe inset, and passed current-position hits both at fit and after button zoom. Evidence: `android-final-hits.log`, `android-orientations.log`, and their matching image/XML directories.

## 6–8. Small phone, large phones and tablet

Screenshots were visually inspected; compilation alone was not used as visual evidence.

| Configuration | Logical landscape size | Observed safe insets | Result |
| --- | --- | --- | --- |
| iPhone 16e / iOS 26.1 | 844 × 390 | L47 R47 B20 | PASS: full world at fit, controls readable and unclipped, native interaction/launch suites |
| iPhone 17 Pro Max / iOS 26.1 | 956 × 440 | L62 R62 B20 | PASS: same coverage, reload and Release tests |
| Pixel 8 Pro / Android API 36, ARM64 16 KB image | 997 × 448 | Cutout ≈50.3 on left or right; B24 | PASS: both landscape directions, full strengthened interaction suite |
| iPad mini A17 Pro / iOS 26.1 | 1133 × 744 | L0 R0 T0 B25 | PASS: world fits and scales, controls/readability, interaction and launch suites |

The diagnostic keeps the world centered with its 90% fit margin and clamps zoom to 0.15–4. Pan is intentionally unbounded for camera inspection; production board camera constraints are not implemented or silently chosen. Gesture zoom can clip/enlarge the world by design; Fit restores the complete world. There is no separate tablet UI. Font-scale/accessibility acceptance beyond this diagnostic and additional Android form factors remain future checks.

## 9. Packaged offline launches

**iOS:** ARM64 Release for the Apple Silicon simulator built successfully. The local command used `ONLY_ACTIVE_ARCH=YES`, omitted generated native debug symbols to reduce disk use, and disabled simulator code signing. Three process cold launches and three resumes passed with Metro stopped. The foundation screen rendered and the lab was absent. This verifies Metro independence; total network isolation was not enforced on the iOS simulator, so physical iOS airplane-mode verification remains pending. No device signing, distribution archive, TestFlight or store readiness is claimed.

**Android:** ARM64 Release APK built successfully with all normal Release tasks, including lint. Its signature was verified as the generated **Android Debug** certificate: this is a local release-mode acceptance package, not production signing. Three process cold launches and three resumes passed with airplane mode enabled, no adb reverse forwarding, and Metro port 8082 unavailable. Native Activity Manager reports `LaunchState: COLD`. The reusable release test additionally verifies that the app PID is absent after force-stop. No runtime error or ANR was observed.

Both generated Hermes bundles were checked for diagnostic text markers; none were present. Both independent production JS exports also passed the release-exclusion check. Neither package implements gameplay, so offline launch-to-victory and durable match recovery are not claimed.

Artifacts: `artifacts/phase-1b/OneChance-Release.app`, `android/app/build/outputs/apk/release/app-release.apk`, `ios-offline-release.log`, and `android-offline-final.log`. Native output directories remain generated and ignored.

## 10. Performance observations

No physical iOS or Android device was available. The earlier 15 callbacks/s result came from a debug software-GPU emulator under host resource pressure. It is not a gameplay GPU FPS measurement and was not used to optimize or reduce architecture.

After native builds completed, one hardware-backed Pixel emulator Debug sample returned **250 callbacks over approximately 10 seconds, 25.0 callbacks/s, worst 133.3 ms, 128 intervals over 20 ms**. Workload: temporary grid (17 vertical and 9 horizontal lines), axes, two rings and one token, with one 1.2 second movement followed largely by idle rendering. This is small synthetic geometry, not representative Lagos artwork. Emulator hardware graphics still virtualizes rendering and scheduling; debug instrumentation, host memory/disk pressure and refresh behaviour remain confounders. The two samples are not a controlled benchmark comparison.

The sampler measures Reanimated UI callback intervals, not GPU presents or exact dropped frames. Shared values collect per-frame data; React receives only completion/cancellation summaries. No Zustand or React update was introduced per frame. The packaged Release app excludes the diagnostic, so this pass cannot make a debug-versus-optimized diagnostic rendering comparison. Release startup succeeds without Metro, but that says nothing about future board FPS.

Meaningful physical-device certification requires an approved optimized diagnostic profiling build, Xcode Instruments hitch/animation traces and Android System Trace/Perfetto frame/GPU data, then representative production workload and thermal testing. **60 FPS remains a target.** See [the profiling procedure](architecture/device-verification.md).

## 11. Dependency advisories

The final saved audit (`artifacts/phase-1b/audit-final.json`) reports **32 affected package entries: 22 high, 10 moderate, zero critical**. These are propagation through dependency paths, not 32 distinct root advisories. Earlier audit snapshots in this pass differ as the advisory database changed; the four root issues below are the relevant classification. No incompatible override or audit suppression was introduced.

| Installed root | Exposure classification | Required path forward |
| --- | --- | --- |
| `decode-uri-component` 0.2.2, via `query-string` 7.1.3 → Router 57.0.24 | Transitive **runtime** decoder exposure. Router's native path/query parsing reaches it. Malformed external custom-scheme query input can cause excessive CPU usage; offline operation does not eliminate inter-app deep links. | **Release blocker.** Fixed decoder is 0.5.0, but it is ESM while the installed query-string path expects a CommonJS function. Prefer a compatible Router 57 parser backport/update; otherwise a separately reviewed adapter/backport needs actual Router malformed-input/roundtrip tests, both native builds/exports and deep-link acceptance. Do not blindly override the major decoder. [Advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr). |
| `uuid` 7.0.3 → `xcode` 3.0.1 → Expo config/build tooling | Transitive **development/build-only** exposure. The affected v3/v5/v6 caller-supplied buffer operations are not used by our installed xcode path; it calls v4 without a supplied buffer. Currently non-exploitable through that inspected call site. | Track a compatible xcode/Expo update. Fixed supported lines start at 11.1.1 / 12.0.1 / 13.0.1; do not force an untested major into CNG. Recheck before release. [Advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq). |
| `braces` 3.0.3 → micromatch / Metro file-map and build tools | Transitive **development/build-only** pattern-parser stack exhaustion. Our runtime UI does not accept glob patterns. Trusted local project patterns reduce current exposure; untrusted glob/config input could affect tooling. | No patched version was published at this check. Track upstream and reevaluate before release/CI accepts untrusted configuration. This does not justify downgrading Expo to npm audit's unrelated proposed SDK. [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). |
| `node-forge` 1.4.0 → Expo CLI / `@expo/code-signing-certificates` | Transitive **development/tooling** RSA certificate/signature validation exposure. Certificate tooling does call verification, so this is conditionally exploitable with hostile signing input. The app has no configured OTA/update signing pipeline or forge runtime import. No current app runtime attack path was identified. | No patched version published at this check. Avoid accepting untrusted certificates in tooling; track the upstream fix and reassess before any update-signing workflow or distribution pipeline uses it. [Advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv). |

Registry checks found Router 57.0.24 and Dev Client 57.0.19 are the latest published patch versions in their compatible major lines. npm suggests Router 58.0.13 for the decoder path, but its dependencies/peers require Expo 58 modules, newer screens and metro runtime. It is not a safe single-package replacement for this locked SDK 57 project. A coordinated SDK upgrade is an alternative remediation project requiring its own compatibility/native regression review. `npm update braces node-forge` found no compatible patched release and changed no resolved package versions.

## 12. Changes made

- `.gitignore`: anchor the generated `/ios/` and `/android/` exclusions at the project root so host acceptance scripts in similarly named subdirectories are tracked; ignore Python bytecode caches.
- `scripts/acceptance/ios/Acceptance.swift` and `project.rb`: isolated native XCTest generation and actual launch/gesture/reload/release checks.
- `scripts/acceptance/android/Acceptance.java`, `AndroidManifest.xml`, `build.sh`, `run.py`, `lifecycle.py`, `orientation.py`, `release.py`: isolated multi-pointer instrumentation and native observation scripts.
- `scripts/acceptance/metro-sessions.py` and `reload.mjs`: local Metro restart/reload acceptance tooling.
- `scripts/acceptance/README.md`, this report, root README and device-verification notes: reproducible procedures, source investigation, failures, limitations and security tracking.

The root lockfile's install-script metadata was refreshed earlier in this pass; dependency versions did not change. No new runtime or npm test dependencies were added. Pillow is an optional host image-analysis tool already available in this environment; CocoaPods' existing xcodeproj gem generates the test project. Test projects/APKs, screenshots, native builds and logs are ignored artifacts, not production content.

## 13. Regression results

| Check | Result |
| --- | --- |
| Strict app TypeScript and separate pure-game TypeScript | PASS |
| ESLint, zero warning allowance | PASS |
| AST architecture audit | PASS |
| Unit/contract tests | PASS, 14/14 |
| Expo Doctor | PASS, 21/21 |
| Expo native dependency compatibility | PASS |
| npm complete dependency/peer tree | PASS |
| iOS and Android production JS exports | PASS |
| Diagnostic exclusion in both exports | PASS |
| Diagnostic marker exclusion in native Hermes bundles | PASS |
| iOS native Release build | PASS after environment cleanup |
| Android native Release build and Release lint | PASS after environment/download remediation |
| Swift XCTest and Android harness compilation | PASS |
| Host Python/Ruby/shell syntax checks | PASS |
| Git whitespace checks | PASS |

Native builds retain upstream warnings: Kotlin/API deprecations, manifest package warnings, Gradle 10 future-compatibility notices, iOS Hermes/Dev Launcher script phases without declared outputs, and Hermes undeclared-global warnings from bundled dependency code. Host NO_COLOR/FORCE_COLOR warnings also remain. These were not filtered or disabled. The successful native interaction and packaged launch trials show no application JS exception, fatal native application error, or ANR; this is bounded observed coverage, not proof every dependency path is error-free.

## 14. Unresolved problems and safe workflow

The historical Android loader exception/ANR and iOS banner have not been conclusively reproduced or fixed. Keep their observations open. On recurrence, save logcat crash/main/system buffers, `dumpsys activity lastanr`, available system ANR traces, Metro logs and an iOS native log/HMR timeline before resetting the process. A future upstream fix should be verified against this exact SDK/client/RN combination.

For ordinary development, use one Metro process per project, wait for its ready status, then open the client. Prefer ordinary Metro reload to repeated external deep-link launch commands. During a Metro restart, terminate the client, stop the server, start and verify the server, then launch a new client process; the separately tested warm trial is not a reliability guarantee. Rebuild after native dependency/config changes and fresh-launch after changes to native module import/loading strategies. Do not disable the New Architecture or remove lifecycle assertions to make a failing session appear healthy.

On this machine use IPv4 localhost binding for Node (`NODE_OPTIONS=--dns-result-order=ipv4first`). The successful Android build retry used local `JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true` with `--no-daemon`; no application networking setting changed. Keep adequate disk headroom for native downloads, transforms and result recording; this pass repeatedly reached ENOSPC despite selective project-only cleanup. Hardware-backed emulator graphics restored interaction testing after software-renderer allocation failures, but neither mode certifies physical performance.

Still pending: physical-device performance and tactile acceptance, physical iOS total-network-loss launch, production signing and publisher namespace confirmation, and the Router decoder remediation before public distribution. Match journaling, recovery, durable Ready handoff, economy and gameplay do not exist in Phase 1 and were not added or claimed tested.

## 15. Readiness recommendation

I consider the foundation suitable for a **separately approved Phase 2 development phase**, with the documented historical tooling issues remaining open. Evidence: both packaged native Release builds, repeated native process launches/reloads/Metro sessions, genuine interactions on both platforms, small/large/iPad visual acceptance, Android airplane-mode startup, release diagnostic exclusion, and clean strict/architecture/contract checks. No active application defect was reproduced in the final acceptance trials.

This is not consumer-release readiness or a promise that development tooling can never fail. The runtime decoder exposure blocks public distribution, and physical performance/network/tactile/signing acceptance remains outstanding. Phase 2 has not started. Further implementation requires explicit approval.
