# Phase 2 implementation and acceptance report

Date: 2026-10-04. Implementation complete; user acceptance and Phase 3 approval pending.

Scope: pure deterministic game/domain foundation only. No persistence implementation, consumer UI, production board/content, backend/online/audio/monetization or final visual design was added. The engine is not connected to the application UI. Native configuration and dependency files are unchanged.

## Implemented contracts

Version-1 GameState includes roster identities, logical positions/statuses, match revision, pinned ruleset reference and canonical content, turn order/ownership/completed turns, durable handoff, pending decision, economy, deck/completion contracts, RNG checkpoint and command receipts. All values are serializable data; presentation state stays outside the domain.

The public pure boundary is `resolveCommand(state, command, validatedRuleset)` and `applyEvent(state, event)`. Accepted events/state are detached from input objects; rejected commands return typed reasons without modifying state/revision/RNG. Accepted transitions and independent replay use the same reducer. Current commands each emit one atomic event; results expose an ordered event list.

| Commands implemented | Events implemented |
| --- | --- |
| InitializeMatch | MatchInitialized |
| PrepareHandoff | HandoffPrepared |
| AcknowledgeHandoff | HandoffAcknowledged |
| PostTransaction | TransactionPosted |
| RollDice | DiceRolled |

These are configuration-gated/internal generic domain operations, not complete physical-game gameplay. Dice recording creates an unresolved decision and applies no JAMB, movement, financial payout or victory rule. Further player actions/turn completion are blocked while that decision is unresolved.

Command contracts include schema version, stable ID, match ID, actor and expected revision. Exact retries are rejected as DUPLICATE_COMMAND; conflicting ID reuse is COMMAND_ID_CONFLICT, before stale-revision rejection. Canonical object encoding makes insertion order irrelevant. Economy rejections retain a typed economyError. Events retain originating command, event identity, revision, ruleset reference and resolved payload. Replay checks shape/current-state compatibility and applies stored randomness without drawing again.

## RNG and golden vectors

Algorithm: Blackman/Vigna xoshiro128** reference 1.1, persisted as `xoshiro128ss-v1`. Four uint32 words plus safe-integer consumed-word counter. Seed: 32 lowercase hexadecimal characters encoding four words; all-zero invalid. Inclusive integer ranges use unbiased rejection sampling, support up to 2^32 outcomes, and consume no word for a singleton. Shuffle is copying descending Fisher–Yates. Invalid inputs fail explicitly; serialized checkpoints restore exact continuation.

Independent C reference compiled with `clang -std=c11 -Wall -Wextra -Werror` and ran successfully. Both 12-word raw vectors and four-word final checkpoints match TypeScript. C range/shuffle outputs also match tests: seed 00000001000000020000000300000004 produces samples 1,1,1,1,6,1,1,2,2,3,2,6 and letter shuffle CBDEFA. These are artificial algorithm fixtures, not One Chance configuration.

An eight-command artificial scenario reproduces identical events/final state, including the fixed canonical SHA-256 test fingerprint:

`2c7c3c8aefb233c6b0a8e11a2f2ddd80b9d5fb938fb872d35a227b069f18946e`

The fingerprint is computed in Node tests only; no crypto/platform dependency enters the engine. After the final code change, the complete test run and two additional independent RNG/engine runs all passed unchanged (23 tests per targeted run).

## Rules and provenance

Draft and validated rulesets are separate from readiness. Validation enforces exact versioned fields, explicit null unknowns, typed configured values, nonempty sources, source identity consistency, board/start membership and card-count consistency. A validated tag is rechecked at trust boundaries and does not authenticate human evidence.

RuleSource records ID, kind, reference and nullable edition. Test-fixture sources are supported for synthetic tests and rejected in production-purpose configuration. The production `one-chance` / `draft-1` draft contains seven owner-confirmed fact fields only; all 22 physical configuration fields remain unknown. No fake card definitions, board locations, monetary units, amounts or policies were added to production content.

Readiness reports missing facts/rules and unsupported engine systems. Full `playable` remains false in Phase 2, including for fully transcribed artificial fixtures. Text-backed mechanic contracts store evidence without implementing that behaviour. State pins the exact validated content and ID/version so changed content cannot silently replace an existing version.

## Economy and handoff

The economy module alone initializes/modifies balances. Amounts are positive safe-integer units; balances are safe integers. No floating money, coercion or rounding. It supports credits, debits and transfers, system/player origin, reason/reference and posted command/event origins. Transfers conserve units and reject self-transfer; unknown account/origin mismatch/duplicates/overflow reject atomically. System actors can post generic system operations; player-originated debit/transfer must debit that player's account. These technical restrictions do not establish physical-game eligibility.

One Chance negative-balance/debt/overdraft/bankruptcy policy is unknown. A transaction crossing below zero with unknown policy rejects explicitly; it does not guess a policy. Generic allow-negative/reject-negative values occur only in artificial tests. Salary, tax, investment, Ajo and card amounts/effects remain unimplemented.

Ready handoff records completed player, expected incoming player, acknowledgement requirement and input lock. Preparation clears turn ownership and locks both players out of gameplay. Only the incoming player can acknowledge and unlock. Roundtrip tests retain this gate; wrong-player/duplicate acknowledgement and actions while locked reject without RNG changes. Turn completion and next-player choice are explicit trusted application inputs; no turn-rotation rule is inferred.

## Verification results

Environment: Node 24.20.0; npm 11.19.0; macOS host. No device/simulator engine test was claimed.

| Check | Actual result |
| --- | --- |
| Strict application TypeScript (`tsc --noEmit`) | Passed |
| Isolated pure-game TypeScript (`tsc --project tsconfig.game.json --noEmit`) | Passed; ES2022 only, no platform type libraries |
| ESLint (`--max-warnings 0`) | Passed, zero warnings |
| Architecture audit | Passed |
| Full Node unit/contract/regression suite | 68/68 passed, no skipped/cancelled/todo tests |
| Repeated RNG/engine fixtures | Two additional final runs, 23/23 each; vectors/fingerprint unchanged |
| C golden reference build/run | Passed with warnings treated as errors |
| Expo Doctor | 21/21 passed, no issues detected |
| Expo dependency compatibility | Dependencies are up to date; passed |
| Git whitespace check | Passed |
| Native config/package/lockfile diff | Unchanged |

Test inventory:

| Suite | Tests | Coverage |
| --- | ---: | --- |
| Engine/replay | 15 | Deterministic headless sequence, fixed outcomes, independently serialized replay, recorded outcomes, revisions, duplicates/conflicts, immutability, unconfigured rules, sampling limits/exhaustion, >6-player support, financial origins and corrupted events |
| RNG | 8 | Two C-backed raw/checkpoint golden vectors, range/shuffle vectors, rejection sampling, restoration, endpoints, no-draw cases and invalid data |
| Rules/provenance | 7 | Production unknowns, content completeness vs playability, evidence, source conflicts, invalid contracts and canonical roundtrips |
| Economy | 6 | System credit/debit, player debit/transfer, conservation, origin/account/identity failures, integer money, overflow and unknown policy |
| Handoff | 5 | Initial Ready, incoming acknowledgement, ownership transfer/recovery, locked/pending decisions and system transaction preserving lock |
| Serialization | 10 | Draft/initialized/pending roundtrips, versions, exact shapes, cross-references, receipts/content pins, future deck/completion shapes, money/RNG invalidity, sparse/hidden data and unevaluated accessors |
| Architecture | 9 | Whole-repo imports, negative platform/type/dynamic imports, JSX/ambient escape, presentation boundaries, ambient time/randomness/aliases and central balance construction |
| Existing camera regression | 4 | Camera inversion, focal zoom, phone/tablet fit and transformed hit testing |
| Existing native configuration regression | 2 | Generated iOS/iPad and Android landscape contracts |
| Existing native path quoting regression | 2 | Actual script invocation from path containing spaces and plugin behaviour |
| Total | 68 | All passed |

The 14 original Phase 1/1B tests remain; 54 additional tests were added. Pure tests use Node's existing built-in runner, not a new framework. Artificial fixture values/IDs/evidence are clearly labeled and live under tests, with no imports from app/game sources into those fixtures.

Architecture inspection confirms no platform package imports, Math.random, clocks, I/O or presentation dependencies entered src/game. The audit also rejects Math aliases/computed access, ambient platform globals and balance construction outside economy. Strict readonly contracts and runtime shape/transition checks complement the audit; it is not a security sandbox.

## Decisions, assumptions and remaining questions

Engineering decisions are documented in [ADR 0003](decisions/0003-deterministic-domain.md): explicit four-word seed rather than implicit hashing, immutable data/results, content pinning without a crypto dependency, integer money, durable Ready gate, exact schemas, typed failures, and current atomic command/event granularity. The 4096-dice work budget is an execution limit, not a physical rule. No gameplay value was assumed.

Outstanding physical information: rulebook/board edition and topology; legal player limits/setup/order; money scale/starting cash; dice definition and JAMB continuation/failure/retry rules; every named mechanic's conditions/amounts/interactions; all 32 card definitions and deck lifecycle; insufficient funds/debt/overdraft/bank supply/rounding; victory/valuation/ties/elimination/conflict precedence. The known unknown list remains [tracked explicitly](rules/unknowns.md).

Before future complex gameplay commands, review whether their authoritative rules require several separately journaled events per command. Version and define atomic batch/recovery semantics if so; current generic commands need only one event. Receipts/content validation grow with match length; future compaction requires measurement and a versioned durable duplicate/recovery contract.

Serialization and replay validate supported data/transition structure, not cryptographic journal authenticity or the truth of source citations. Unsupported/corrupt data fails explicitly. SQLite recovery, crash consistency, snapshot/journal lineage and migrations are not tested or implemented in this phase. Dice resolution, deck lifecycle and victory remain intentionally unavailable.

No native UI/launch/build was rerun for this pure phase. Existing native configuration regression, Expo Doctor and dependency compatibility passed. No physical-device performance claim is made. Historical Android Dev Launcher race, iOS HMR banner, publisher namespace/signing, Router decoder release blocker and device FPS certification remain unchanged in the [Phase 1B qualification report](phase-1b-verification.md).

Recommendation: the pure foundation is ready for an approved Phase 3 focused on SQLite journal/snapshots, serialized command coordination, commit-before-presentation, idempotent retry, recovery and failure-injection tests against these contracts. Authoritative rules remain required before a complete playable match can be built. Phase 3 has not begun; wait for explicit approval.

## File inventory

No dependencies were added or upgraded. package.json, package-lock.json, app.config.ts and native/runtime modules are unchanged.

New files (21):

- `docs/decisions/0003-deterministic-domain.md`
- `docs/phase-2-verification.md`
- `src/game/content/oneChanceDraft.ts`
- `src/game/content/ruleset.ts`
- `src/game/domain/serialization.ts`
- `src/game/domain/state.ts`
- `src/game/domain/validation.ts`
- `src/game/economy/transactions.ts`
- `src/game/engine/applyEvent.ts`
- `src/game/engine/contracts.ts`
- `src/game/engine/resolveCommand.ts`
- `src/game/engine/validateCommand.ts`
- `src/game/random/rng.ts`
- `tests/economy.test.mjs`
- `tests/engine.test.mjs`
- `tests/fixtures/artificial-domain.mjs`
- `tests/fixtures/xoshiro-reference.c`
- `tests/handoff.test.mjs`
- `tests/rng.test.mjs`
- `tests/ruleset.test.mjs`
- `tests/serialization.test.mjs`

Modified files (12):

- `README.md`
- `docs/architecture/boundaries.md`
- `docs/rules/unknowns.md`
- `scripts/architecture.mjs`
- `src/game/content/README.md`
- `src/game/content/provenance.ts`
- `src/game/domain/README.md`
- `src/game/economy/README.md`
- `src/game/engine/README.md`
- `src/game/random/README.md`
- `tests/architecture.test.mjs`
- `tsconfig.game.json`
