# Phase 1 verification — 1 October 2026

## Status

The technical foundation is implemented. Automated checks and both native builds pass. The diagnostic has been rendered and visually inspected on iOS and Android, and its primary interactions exercised on Android. **Native acceptance remains qualified**: development reload failures were observed, and the remaining device checks below have not passed yet. This is not a gameplay release or a 60 FPS certification. Phase 2 has not begun.

## Implemented

- Git repository on main; Expo Router native project, strict TypeScript, ESLint, Node test runner, lockfile and CI check workflow.
- SDK-compatible Skia, Reanimated, Gesture Handler, haptics, SQLite and Zustand integration.
- Separate game, application, rendering, input, animation, audio, UI, state, persistence and diagnostic boundaries. AST import audit and an independent pure-game TypeScript compilation prevent platform imports into game code.
- Provenance-aware known/unknown content types. No invented rules or production content.
- Landscape-only native configuration, safe-area integration, iPad full-screen configuration and responsive world fitting.
- Removable development-only Skia lab: grid, axes, token, camera pan/pinch/button zoom, token animation, inverse-transform hit testing, haptic invocation and UI-thread frame sampling.
- Native SQLite connection initialization with WAL, synchronous FULL and foreign keys. Errors surface through the startup boundary without deleting data.
- Reproducible fixes for upstream iOS shell scripts mishandling this workspace's spaces; patch and CNG plugin covered by tests.

## Decisions and boundaries

See [ADR 0001](decisions/0001-foundation.md), [ADR 0002](decisions/0002-expo-constants-path-quoting.md), and [module boundaries](architecture/boundaries.md).

The approved command/event engine, BoardDefinition/BoardLayout split, versioned seeded RNG, separate visual randomness, central economy, commit-before-presentation journal/snapshots and durable Ready handoff remain the architecture. Their implementations are deliberately outside this phase. Reserved module READMEs are boundary documentation, not working implementations. No player limit or unverified financial value has been encoded.

Expo Continuous Native Generation owns the ignored native projects. Hermes and the New Architecture use the SDK defaults. React DOM is a Router peer dependency, not a supported web target. Worklets is required by Reanimated. Native runtime support packages and a development client are necessary for Router/native verification. patch-package carries one narrow build-path correction. No test framework, backend, networking SDK or audio playback library was added.

## Exact installed dependencies

Versions below are resolved from package-lock.json. Use npm ci for reproduction; Expo-compatible ranges in package.json do not replace the lockfile.

| Package | Exact version | Role |
| --- | --- | --- |
| `@shopify/react-native-skia` | 2.6.2 | runtime |
| `expo` | 57.0.26 | runtime |
| `expo-constants` | 57.0.20 | runtime |
| `expo-dev-client` | 57.0.19 | runtime |
| `expo-font` | 57.0.4 | runtime |
| `expo-haptics` | 57.0.3 | runtime |
| `expo-linking` | 57.0.11 | runtime |
| `expo-router` | 57.0.24 | runtime |
| `expo-sqlite` | 57.0.3 | runtime |
| `expo-status-bar` | 57.0.1 | runtime |
| `expo-system-ui` | 57.0.4 | runtime |
| `react` | 19.2.3 | runtime |
| `react-dom` | 19.2.3 | runtime |
| `react-native` | 0.86.3 | runtime |
| `react-native-gesture-handler` | 2.32.0 | runtime |
| `react-native-reanimated` | 4.5.1 | runtime |
| `react-native-safe-area-context` | 5.7.0 | runtime |
| `react-native-screens` | 4.26.2 | runtime |
| `react-native-worklets` | 0.10.1 | runtime |
| `zustand` | 5.0.15 | runtime |
| `@types/react` | 19.2.18 | development |
| `eslint` | 9.39.5 | development |
| `eslint-config-expo` | 57.0.2 | development |
| `expo-doctor` | 1.20.4 | development |
| `patch-package` | 8.0.1 | development |
| `typescript` | 6.0.3 | development |

Environment: Node 24.20.0, npm 11.19.0, Xcode 27 (27A266a), Java 17. Compatibility was checked against Expo's installed native version matrix and peer graph, not by installing every package's latest version.

## Verification results

| Check | Result |
| --- | --- |
| Strict TypeScript: app + pure game | PASS |
| ESLint with zero warning allowance | PASS |
| AST architecture audit | PASS |
| All unit/contract tests | PASS: 14/14 |
| Expo dependency compatibility | PASS: dependencies up to date |
| Expo Doctor | PASS: 21/21 |
| npm peer/dependency tree | PASS |
| iOS + Android production JS export | PASS |
| Diagnostic exclusion in both release bundles | PASS |
| Git whitespace check | PASS |
| Expo/Metro startup | PASS on local port 8082 |
| iOS native build/install/launch | PASS, with development tooling caveats below |
| Android native build/install/launch | PASS, with development tooling caveats below |
| Native packaged Release/offline cold launch | NOT RUN |
| Physical-device performance and haptic sensation | NOT RUN |

Tests cover forbidden architecture imports and bypasses, diagnostic isolation, presentation boundaries, coordinate inversion, focal zoom, phone/tablet world fitting, transformed current-position hit testing, generated native landscape settings, and executable/idempotent path quoting. No journal/recovery tests exist because match persistence is not implemented. SQLite policy was queried in the real native apps.

The CI workflow is committed; no remote CI run is claimed. Release JS exports used --no-bytecode solely so isolation could be inspected; native Hermes settings remain unchanged.

### iOS

Built and installed on iPhone 17 Pro Max simulator, iOS 26.1. Xcode reported BUILD SUCCEEDED, zero errors and one script-phase warning. Expo CLI's subsequent Device Hub activation failed through AppleScript; manual simctl launch succeeded. No signing or physical-device build was attempted.

Observed 956 × 440 landscape layout, left/right safe insets 62, bottom 20. Skia grid, token and controls render, and SQLite reports 3.50.3 / WAL / FULL / FK on. Screenshots were inspected directly. A persistent/intermittent Expo “Refreshing…” banner obscured part of the header during reload tests; it was absent in one inspected launch but returned later. Changing the diagnostic to synchronous loading did not reliably resolve it, so that experimental change was reverted. Eager Metro development bundling was also tried; it is not a confirmed fix. Full iOS touch and two-finger interaction acceptance remains unverified.

### Android

Built with Gradle and installed on Pixel 8 Pro API 36 emulator (ARM64, 16 KB system image). BUILD SUCCESSFUL. The SDK containing this AVD is /Users/InhouseHQ/Library/Android/sdk; the machine's alternate /Library/android setting lacked its system image.

Observed 997 × 448 landscape layout, left safe inset about 50.3, bottom 24, and visible controls. Skia grid, axes and token render. SQLite reports 3.50.3 / WAL / FULL / FK on.

Using authorized adb inputs, verified:

- Baseline token hit at world (240.1, 240.1), plus empty-space misses.
- Pan changes the camera; a hit at the moved screen location resolves to world (240.1, 239.6).
- Zoom + changes scale; the visible token still hits at world (240.0, 240.3).
- Move token changes its rendered position to the second ring; destination hit resolves to world (719.4, 240.3).
- Haptic API resolves successfully on token selection. Physical sensation cannot be established in an emulator.
- Frame capture completes and reports a summary. One 10-second debug/emulator sample returned 151 callbacks, 15.0 callbacks/s, worst interval 1000 ms and 85 intervals over 20 ms. These poor emulator results are not gameplay FPS measurements. Software GPU mode and host memory pressure were reported by the emulator.

A later warm deep-link reload after restarting Metro crashed in expo-dev-launcher's DevLauncherAppLoader with “App react context shouldn't be created before.” An Android not-responding dialog was also observed during a subsequent reload sequence. Force-stopping and opening a fresh session restored the rendered lab. These observations remain unresolved development-client reliability issues; successful earlier interactions do not erase them.

### Runtime review and remaining manual checks

No application JavaScript error was observed during the successful interaction sequence. Broader reload testing was not clean: it included the Android failures above, the iOS banner, transient Metro disconnections, and duplicate Skia view registration while changing import strategy during Fast Refresh. The import experiments were reverted; a fresh process is required after changes to native module loading. No error or warning filter was added to hide these failures.

Still required: actual two-finger pinch, iOS interaction suite, in-flight animated-token hit testing on a device, background/resume cancellation acceptance, both landscape directions, a smaller phone and tablet visual pass, physical haptic feedback, and optimized physical-device profiling. The frame callback sampler is available now; see [the device procedure](architecture/device-verification.md). No React/Zustand updates occur on every animation frame.

## Known dependency/build warnings

- npm audit reports **13 moderate, zero high, zero critical** advisories in the resolved graph. Root advisories are decode-uri-component malformed-input denial of service (GHSA-vcc3-ghjq-m6fr), reached through Router/query-string, and uuid buffer bounds (GHSA-w5hq-g745-h8pq), reached through native build tooling. Resolve the Router decoder exposure before public distribution. Forced incompatible Expo/Router downgrades and unverified overrides were not applied.
- The Expo Dev Launcher iOS “Strip Local Network Keys for Release” script warns about ambiguous dependencies and running every build.
- Android dependencies emit upstream Kotlin/API deprecations, ignored manifest package attributes and Gradle future-compatibility warnings. They did not fail the native build.
- ESLint 9 has an npm deprecation notice; it is retained with the verified Expo/plugin peer set.
- The host sets both NO_COLOR and FORCE_COLOR, causing a tooling warning.
- Runtime dev-server connectivity initially failed because Node bound localhost to ::1 while the bundle URL used 127.0.0.1. NODE_OPTIONS=--dns-result-order=ipv4first fixed that binding. Port 8081 belongs to another local project and was left untouched.

## Known product limitations

No gameplay engine, seeded RNG implementation, board topology, card content, economy execution, pass-and-play Ready UI, match creation, journal, snapshots, migrations, autosave or recovery exists yet. No production illustrations, characters, audio or branded launcher artwork exists. The volatile haptic preference is not persisted. Airplane-mode launch-to-victory cannot be tested until gameplay exists. Release bundle generation is not equivalent to a packaged offline release test.

## Decisions needed and next phase

Confirm the publisher-owned bundle/package namespace before signing; com.onechance.mobile is a local development identifier. Identify physical baseline iOS/Android phones for performance and tactile acceptance. Supply the physical rulebook, board and all 32 cards, or an authoritative transcription, before rule-dependent implementation. See [unknown rules](rules/unknowns.md).

Recommended Phase 2 after Phase 1 acceptance: implement pure versioned domain/command/event contracts, deterministic seeded RNG with golden-vector tests, ruleset validation/provenance, and the central transaction contract. Unknown rules must prevent unsupported play. Define durable Ready state and coordinator/persistence contracts before any consumer gameplay flow. Implement only verified mechanics in a separately reviewed slice. Do not begin Phase 2 automatically.

## Files created

The repository began empty. This inventory lists authored, tracked foundation files; native projects, node_modules, Expo cache, exports and local test artifacts are generated and ignored.

```text
.github/workflows/checks.yml
.gitignore
.npmrc
.nvmrc
README.md
app.config.ts
assets/audio/README.md
assets/characters/README.md
assets/fonts/README.md
assets/illustrations/README.md
docs/architecture/boundaries.md
docs/architecture/device-verification.md
docs/decisions/0001-foundation.md
docs/decisions/0002-expo-constants-path-quoting.md
docs/phase-1-verification.md
docs/rules/unknowns.md
eslint.config.cjs
package-lock.json
package.json
patches/expo-constants+57.0.20.patch
plugins/withQuotedBundleScript.cjs
scripts/architecture.mjs
scripts/check-release.mjs
src/animation/README.md
src/app/_layout.tsx
src/app/index.tsx
src/application/commands/README.md
src/application/ports/README.md
src/application/session/README.md
src/audio/README.md
src/bootstrap/DevelopmentEntry.tsx
src/bootstrap/StartupBoundary.tsx
src/diagnostics/DiagnosticButton.tsx
src/diagnostics/DiagnosticScene.tsx
src/diagnostics/RenderingDiagnostic.tsx
src/diagnostics/geometry.ts
src/diagnostics/useDatabaseStatus.ts
src/diagnostics/useDiagnosticCamera.ts
src/diagnostics/useFrameCapture.ts
src/game/content/README.md
src/game/content/provenance.ts
src/game/domain/README.md
src/game/economy/README.md
src/game/engine/README.md
src/game/random/README.md
src/haptics/selection.ts
src/input/hitTesting.ts
src/persistence/initializeDatabase.ts
src/rendering/assets/README.md
src/rendering/board/README.md
src/rendering/camera/coordinates.ts
src/rendering/characters/README.md
src/state/preferences.ts
src/ui/FoundationScreen.tsx
tests/architecture.test.mjs
tests/camera.test.mjs
tests/configuration.test.mjs
tests/native-build-paths.test.mjs
tsconfig.game.json
tsconfig.json
```

Local visual evidence and runtime logs are in the ignored artifacts directory. Useful captures: android-verified.png (transformed destination hit and frame summary), android-eager.png (fresh running lab), ios-entry-check.png (unobstructed layout), and ios-eager.png (reload banner visible). Keep the caveats above when interpreting any individual screenshot.
