# ADR 0003: Pure deterministic domain foundation

Status: implemented in Phase 2; acceptance pending. No consumer gameplay or persistence implementation.

## Ownership and versions

`src/game` owns only serializable data, validation, deterministic transitions, financial invariants and controlled gameplay entropy. Every import stays inside this tree. No platform libraries, I/O, timers, presentation state or ambient randomness are present. The app does not invoke this engine yet. Existing native/runtime configuration is unchanged.

| Contract | Current version | Compatibility decision |
| --- | --- | --- |
| GameState | `schemaVersion: 1` | Decode exact shape/invariants; reject unsupported versions |
| Command | `schemaVersion: 1` | Identity, actor and expected revision are mandatory |
| Event | `schemaVersion: 1` | Contains originating command, pinned ruleset reference and resolved outcome |
| Ruleset shape | `schemaVersion: 1` | Separate from the content revision |
| Ruleset validation | `validationVersion: 1` | Shape/provenance validity; not an authenticity token |
| Production content draft | `one-chance` / `draft-1` | Unverified fields remain unknown |
| Economy projection | `schemaVersion: 1` | Integer units and explicit negative-balance policy |
| RNG | `xoshiro128ss-v1` | Algorithm, seed interpretation and sampling order are reproduction contracts |

RNG and content revisions can change independently of state/event schemas. Behaviour incompatible with a saved contract requires explicit versioning and migration/compatibility handling. Phase 2 provides no migrations and never resets unsupported data. Deserialization returns a typed failure; future storage must retain the original save for diagnosis/migration.

## Domain model

`GameState` contains match identity, exact ruleset identity/content, revision, roster, logical player positions/statuses, ordered roster/turn ownership, handoff gate, pending decision, economy, decks, RNG checkpoint, completion and command receipts. It contains no coordinates, camera, animation progress, visual randomness, audio, emotion/reaction animation or UI selection.

- A `draft` has identities and seeded RNG, with positions/statuses, economy, deck lifecycle and gameplay decisions unconfigured. Match revision/draw count start at zero as technical counters.
- `initialized` means the explicitly sourced generic setup has been applied. It does **not** mean a full One Chance match is playable.
- Setup requires money unit/scale, starting units, physical player limits, board identities, starting location and supplied ordering policy. The engine does not impose a six-player maximum. Draft rosters are not evidence of legal physical player counts.
- `BoardDefinition` contains logical IDs/version/location membership. Physical topology and movement remain unconfigured. BoardLayout stays in the rendering layer; diagnostic geometry has no domain role.
- Deck and completion shapes support future state representation. No production decks or victory states are created. A restored deck must refer to configured cards/deck evidence; completion requires configured victory evidence. This is structural validation, not execution of those rules.
- The only implemented pending decision is a recorded dice outcome. It remains unresolved until a future verified rule implementation can interpret it. Its originating event/actor, face count and bounds are validated on restoration.

The complete validated ruleset is stored as a canonical JSON signature alongside its ID/version in the pure state. This prevents silently changing content under an existing version, permits offline replay without external lookup, and makes reproduction self-contained. This signature is an exact content comparison, **not** a cryptographic authentication signature. A future SQLite ruleset table may deduplicate identical content while preserving this contract.

## Command and event flow

Public boundary:

```ts
resolveCommand(state, command, validatedRuleset)
applyEvent(state, event)
```

Both return discriminated success/rejection results and leave caller inputs untouched. Accepted engine state/events are detached from caller-owned objects. Commands/events/state are readonly in TypeScript. There are no hidden persistence, presentation or timing side effects.

Resolution validates envelope/state/ruleset, match, command identity, expected revision, actor, stage, handoff, ownership, pending decision, required configuration and operation invariants. Only an accepted dice command draws local RNG. The resulting event is applied through the same reducer used for replay. If local sampling exhausts the counter, its tentative progress is discarded and no event/state is returned.

The current five commands each produce one atomic event/revision; the result exposes an ordered event list. Event identity is `matchId:revision`. These implemented transitions need no partial-event-batch state. Multi-event gameplay command granularity, if required by verified physical rules, must define/version atomic replay and recovery before that command is added; no partial-batch policy is inferred here.

| Command | Event | Available generic transition |
| --- | --- | --- |
| InitializeMatch | MatchInitialized | Verified setup, centralized account opening, initial locked Ready handoff |
| PrepareHandoff | HandoffPrepared | Trusted application explicitly supplies incoming player; records completed player, increments completed-turn counter and locks input |
| AcknowledgeHandoff | HandoffAcknowledged | Incoming player acknowledges Ready; establishes turn owner and unlocks input |
| PostTransaction | TransactionPosted | Validated credit/debit/transfer through the sole economy subsystem |
| RollDice | DiceRolled | Configured dice produce recorded faces and before/after RNG checkpoints; creates unresolved decision |

`system` is the trusted local application actor, not a backend or authenticated account. Initialization/turn completion are internal application operations. The engine does not decide when a physical turn is finished or which player follows next. The configured order is retained, but no unsupported turn-rotation rule is executed. Generic financial commands do not establish that players may freely transfer money in the physical game; future gameplay commands must validate eligibility before originating transactions. No consumer interface exposes these primitives.

Typed rejection codes distinguish malformed data, invalid actor/stage, mismatched ruleset/match/revision, duplicate command, conflicting identity, locked input, wrong owner/incoming player, pending decision, unconfigured rules, operational limit, economy error and exhausted RNG. Economy rejections retain a typed `economyError` in addition to diagnostic text.

Receipts store command ID, canonical request, event ID and accepted revision. An exact retry is `DUPLICATE_COMMAND`; reuse of the same ID with different content is `COMMAND_ID_CONFLICT`, even if the expected revision is stale. Object key insertion order is irrelevant; array order is meaningful. Rejections provide no new state/events and do not advance revision or RNG. Replay rejects duplicate/out-of-order events rather than silently ignoring them.

Receipts grow with match length and restoring/resolving validates their history. This is deliberate, auditable version-1 behaviour; measure long-match cost before introducing journal-backed compaction. Such compaction must retain durable duplicate detection and use a versioned contract.

## Event replay and integrity

Dice events store faces and RNG checkpoints. Replay verifies bounds, configured dice, turn ownership, originating command, previous RNG checkpoint and counter progress, then applies the recorded outcome. It never rerolls or samples. Events also carry resolved setup data and transaction origins for inspection.

Decoding validates schema/shape/cross-references and rejects sparse lists, hidden/accessor properties and metadata JSON would discard; application validates legal transition and current revision. Neither claims to authenticate a deliberately forged valid journal or prove a snapshot's entire history. Phase 3 must compare snapshot/journal lineage and handle damaged/unsupported data without resetting it. Replaying a legitimate recorded outcome must not depend on the current random draw implementation.

No platform clock, timestamp or device/frame timing enters command identity, event identity or game outcome. The caller supplies stable command IDs and the initial seed.

## RNG algorithm and reproduction

Use Blackman and Vigna's **xoshiro128\*\*** reference algorithm 1.1, with the `s[1]` star-star scrambler. Our persisted identifier is `xoshiro128ss-v1`. It uses four unsigned 32-bit words and explicit JavaScript wraparound (`Math.imul`, bitwise operations, unsigned shifts). This small implementation needs no dependency and was checked against the [authors' C reference](https://prng.di.unimi.it/xoshiro128starstar.c) and [algorithm notes](https://prng.di.unimi.it/).

It is a reproduction generator, not cryptographic randomness. No online fairness/security protocol is claimed.

- **Seed:** exactly 32 lowercase hexadecimal characters, encoding four consecutive big-endian uint32 words; all-zero is invalid. No text hash, clock-derived seed or implicit platform seed exists. Initial seed acquisition belongs outside the pure game layer and is not implemented here.
- **State:** exact algorithm ID, four uint32 words with at least one nonzero word, and a nonnegative safe-integer consumed-word counter. Restoration validates and copies the state. Serialization is canonical JSON; unsupported algorithm IDs fail explicitly.
- **Word draw:** uint32 output and new state. Draw counter exhaustion throws before progress is produced.
- **Integer range:** inclusive ordered safe-integer endpoints, with at most 2^32 possible outcomes. Reject the high incomplete remainder of the uint32 domain before modulo reduction, avoiding bias. Negative offsets and full uint32 ranges are supported. A singleton range consumes no word.
- **Shuffle:** copying descending Fisher–Yates, drawing uniformly from `[0, i]` at each step. Empty and singleton inputs consume no words. This is an algorithm contract, not a physical deck/discard/reshuffle policy.
- **Invalid input:** seed/draw/range/shuffle APIs throw RangeError; invalid serialization throws TypeError; restore/deserialize return typed validation failures. Fractions, unsafe integers, nonfinite numbers, negative zero and invalid/all-zero state words are rejected.
- **Operational dice budget:** at most 4096 configured dice per resolution and at most 2^32 faces per die. Larger configured definitions remain structurally representable but the command rejects before drawing. This is a version-1 execution/sampling budget, not a physical rule or player limit.

Golden tests contain two independent 12-word uint32 vectors and final word checkpoints, a range vector, an explicit three-rejection sample and a shuffle vector. `tests/fixtures/xoshiro-reference.c` retains the authors' licensed core and an independent C sampling/shuffle harness. It is test-only and is not bundled into the app. Node tests require no C compiler; the optional reference check is:

```sh
clang -std=c11 -Wall -Wextra -Werror tests/fixtures/xoshiro-reference.c -o /tmp/onechance-rng-vectors
/tmp/onechance-rng-vectors
```

Seed `00000001000000020000000300000004` begins `11520, 0, 5927040, 70819200`; its first twelve `[1,6]` samples are `1,1,1,1,6,1,1,2,2,3,2,6`. Shuffling the six artificial letters `ABCDEF` yields `CBDEFA`. These are algorithm fixtures, not One Chance dice/deck configuration. Changing sampling, seeding, shuffle order or stream algorithm requires a new reproduction contract, not merely updating expected tests.

Visual entropy remains outside `src/game`. No visual generator or animation is added in this phase.

## Ruleset validity, readiness and evidence

A draft retains every required knowledge field as either `{ status: 'unknown', value: null }` or a typed confirmed value with at least one source. Missing fields, unknown values disguised as zero/false/empty collections, and confirmed fields without evidence fail validation. Explicit, sourced zero/false is distinguishable and may be valid for the applicable field.

Sources have stable ID, kind, reference and nullable edition. Supported kinds are product brief, rulebook, board, card, owner clarification and test fixture. A repeated source ID must describe the same evidence. Test-fixture evidence cannot configure a production-purpose ruleset. This prevents accidental fixture promotion; human review still has to authenticate and interpret the source material.

The production draft records only the owner-confirmed facts: begins with JAMB; passing faces 4/5/6; named mechanics; 32 physical cards; multiple players; financial decisions/wealth; positive/negative card outcomes. It creates no board locations, card definitions, currency units, payouts, dice definition or gameplay rules. All 22 configuration entries remain unknown.

`validateRuleset` establishes structural/provenance validity, including board/start membership and card count consistency when both values exist. `assessReadiness` separately exposes missing facts/rules and unsupported engine systems. `contentComplete` is not `playable`: even a fully transcribed artificial ruleset is not a complete match implementation. Full playability is explicitly false throughout Phase 2. Text-backed mechanic contracts record evidence without pretending to execute the physical rulebook.

## Economy invariants

`openEconomy` and `postTransaction` are the only balance initialization/change implementations. No reducer independently changes a player's numeric balance. Amounts use positive safe-integer monetary units, balances use signed safe integers, and the scale is explicit sourced data. Negative zero/fractions/nonfinite/unsafe values fail; nothing is rounded or coerced.

Credit adds system-originated units; debit removes them; transfer conserves exact units between distinct known accounts. Transactions require unique ID, origin, amount, reason and reference. Posted events additionally retain originating command/event IDs. IDs are deduplicated independently from command IDs.

The application actor can originate system transactions. A player-originated generic transaction may debit or transfer from that same player's account; this is a technical authority restriction, not proof of a physical-game debit/transfer permission. Unknown accounts/origin mismatch/self-transfers/duplicates/overflow reject atomically.

Negative-balance policy is sourced knowledge, with generic representable outcomes allow-negative/reject-negative. Neither is selected for One Chance. An action that would cross below zero with unknown policy rejects as `NEGATIVE_BALANCE_POLICY_UNKNOWN`; ordinary nonnegative transitions can still be represented without guessing that policy. There is no salary, tax, investment return, Ajo amount, card payout, debt, bankruptcy or rounding implementation.

## Durable Ready handoff

The gate records completed player, expected incoming player, acknowledgement requirement and gameplay-input lock. Before the first acknowledgement there is no turn owner. A prepared handoff clears ownership and stays locked; previous and incoming players both cannot issue gameplay commands. Only the incoming player may acknowledge it. Ownership then moves to that player and input unlocks.

State serialization retains the gate and validates registered identities and coherent ownership/lock combinations. A trusted system transaction during handoff does not acknowledge or unlock it. A pending dice outcome blocks further player actions and turn completion. No UI or storage recovery implementation is implied by these domain tests.

## Deferred work

SQLite journal/snapshots/migrations/coordinator, consumer screens, real game commands/rules, board topology/layout/assets, audio and online work are outside this phase. Commit-before-presentation remains the approved application integration rule: atomically persist accepted command identity/events/snapshot before publishing returned state or presenting outcomes. Phase 2 provides data/results for that integration and performs no commit. Recovery needs the revision-zero baseline (roster, ruleset and initial RNG) together with subsequent events; events alone are not claimed to recreate an absent initial state.

Authoritative physical materials remain required as listed in [known unknowns](../rules/unknowns.md). Native development-tool issues, signing/namespace, Router decoder release remediation and physical-device FPS certification remain tracked in the [Phase 1B report](../phase-1b-verification.md).
