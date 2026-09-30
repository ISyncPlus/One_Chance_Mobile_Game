# ADR 0001: Production foundation and phase boundaries

Status: architecture approved; Phase 1 implementation.

## Dependency and build baseline

Use stable Expo SDK 57 and its supported React / React Native / native module versions. Verify with the installed `expo/bundledNativeModules.json`, `expo install --check`, Expo Doctor, dependency peer validation, and actual native builds. Commit the lockfile. Do not resolve incompatibilities using `--force`, `--legacy-peer-deps`, error suppression, or unrelated package upgrades.

Use Hermes and the React Native New Architecture provided by the SDK. Expo CNG owns generated iOS/Android projects. Build locally; EAS, a backend, cloud services, and runtime downloads are not requirements. Expo Router routes are composition only.

React DOM is pinned to the SDK's React version because Router's dependency graph includes web peer requirements, even though this product targets native platforms only. This does not add web as a supported target. Worklets is required by Reanimated. Safe Area Context, Screens, Linking, Constants, Font, Status Bar, and System UI support the native Router/runtime integration. The development client is for native verification. No sound playback dependency is installed yet.

## Domain ownership

The `src/game` tree is pure TypeScript. No React, React Native, Expo, Zustand, SQLite, I/O, wall-clock decisions, or frame clocks belong here. It has a separate TypeScript check without platform type libraries and an import audit that permits only relative dependencies remaining within the tree.

Future commands carry actor identity, command ID, and expected match revision. Resolution produces ordered events; one event reducer path drives both resolution and replay. Commands and state are serializable. Rejections do not mutate state or consume gameplay randomness. No command resolver or game rules are implemented in Phase 1.

Gameplay state and presentation state are separate. BoardDefinition will represent logical topology; BoardLayout belongs to rendering and maps logical IDs to coordinates. No physical topology is inferred from the diagnostic grid.

Gameplay randomness will use one seeded, versioned implementation and stored generator state. Visual randomness uses a separate stream. No randomness implementation is needed or supplied in this phase; `Math.random` is prohibited in application sources.

The economy subsystem will be the only balance-change authority. Financial events carry transactions and audit reasons. Integer money scale, rounding, negative balances, and bankruptcy remain unconfigured.

## Persistence contract

SQLite will store an append-only event journal plus snapshots. A serialized application command coordinator will atomically commit command identity, events, economy projections, and snapshot before publishing state or revealing outcomes. Pending decisions are complete durable states. Retry must be idempotent; an ambiguous result must be queried by command ID.

Version rulesets, state, events, RNG, and database schemas independently. Retain the exact ruleset required by each saved match. Migrations and compatibility policy must preserve unsupported saves instead of resetting them.

Phase 1 opens the native database and establishes WAL, synchronous FULL, and foreign-key enforcement. It deliberately creates no match tables or pretend persistence adapter. Autosave, journal, snapshots, schema migrations, and recovery are later phases.

## Rendering and input

Skia owns custom rendering. Reanimated shared values own frame-level transforms and token positions; use `get`/`set` APIs compatible with React's immutability lint checks. Gesture Handler interprets input. Shared coordinate helpers implement `screen = world * scale + translation`; hit testing applies the inverse to input in canvas-local coordinates.

Presentation never advances domain state through animation completion. Animations are reconstructible or skippable after a committed action. Audio and haptics are adapters; their success cannot determine game outcomes.

Zustand is limited to small UI/session stores. Currently it holds only an explicitly non-persistent haptic preference. It is not a second match authority.

## Orientation and local multiplayer

Landscape is the only currently supported orientation, for iOS and Android. Phones are primary; layouts use available space and safe areas so tablets remain possible. iPad uses full screen because enforcing this orientation is incompatible with unrestricted multitasking. No separate tablet UI exists.

Initial local multiplayer UI should accommodate 2–6 players. This is not an engine maximum; verified rules will define legal player counts. Incoming players must acknowledge Ready before gameplay input unlocks. Recovery must reinstate a safe handoff gate. No handoff flow or recovery implementation exists in Phase 1.

## Diagnostic isolation

All temporary geometry, controls, sampling, and labels live in `src/diagnostics`. Only `bootstrap/DevelopmentEntry.tsx` may import that tree. The entry uses a `__DEV__`-guarded lazy import. Release exports must be checked for the absence of the diagnostic marker. Removing the diagnostic requires changing the entry, then deleting its directory; no domain changes are required.

UI frame sampling occurs on the UI thread, with one summary callback per capture. It measures callback intervals, not GPU completion or certified gameplay FPS. Real-device profiling remains necessary.
