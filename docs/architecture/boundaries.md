# Module boundaries

| Area | Owns | Must not own |
| --- | --- | --- |
| `game/domain` | Serializable gameplay models and invariants | UI state, camera, platform services |
| `game/engine` | Command validation/resolution and event application | Rendering, storage, timers |
| `game/economy` | Financial transactions and balance invariants | UI financial animation |
| `game/random` | Versioned deterministic gameplay entropy | Visual randomness |
| `game/content` | Evidence, rule definitions, explicit unknowns | Guessed playable defaults |
| `application` | Command serialization, sessions, service ports | Frame animation or duplicated rules |
| `persistence` | SQLite repositories, journal, snapshots, migrations | Rule decisions |
| `rendering` | Skia scenes, BoardLayout, asset references, camera | Rule resolution and balance mutation |
| `animation` | Presentation sequencing and reactions | Authority to commit a game action |
| `input` | Gestures, hit testing, intent mapping | Rule validity decisions |
| `ui` / `app` | Accessible contextual controls / route composition | Game rules |
| `state` | Focused UI stores and read-only match projections | A second persistence system |
| `audio` / `haptics` | Platform output adapters | Gameplay side effects |
| `diagnostics` | Development verification scene | Production content |

Phase 1 creates working modules where there is actual functionality. Reserved boundaries have responsibility READMEs, not fake adapters or speculative interfaces. Further implementation remains gated by phase review.

`scripts/architecture.mjs` audits import declarations, re-exports, dynamic imports, import types, and CommonJS module references. Pure modules can only refer to other files inside `src/game`; computed module references are rejected. Presentation cannot import engine/economy implementations or persistence directly. Only the explicit development entry can reach diagnostics from outside the diagnostic tree.

The test suite includes negative fixtures to prove forbidden imports fail. `tsconfig.game.json` supplies no DOM, Node, React, or React Native globals. ESLint rejects `any`, `Math.random`, and game-layer wall clocks. These checks support code review; they are not a security sandbox or a proof that all possible business-logic violations are detectable automatically.

Phase 2 adds pure domain/command/event/ruleset/economy/RNG implementations within these existing boundaries; see [ADR 0003](../decisions/0003-deterministic-domain.md). The AST audit also rejects ambient clocks/platform globals, Math aliases/computed access that could hide randomness, and balance object construction outside the central economy subsystem. Pure TypeScript checking remains separate, without platform globals; the engine is not connected to presentation or storage.
