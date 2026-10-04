import type { BoardDefinition, DiceDefinition, MoneyUnit, RulesetRef } from '../content/ruleset.ts';
import type { RuleKnowledge } from '../content/provenance.ts';
import type { Actor, EconomyError, PostedTransaction, Transaction } from '../economy/transactions.ts';
import { isActor, isTransaction } from '../economy/transactions.ts';
import type { RngState } from '../random/rng.ts';
import { hasKeys, isArrayOf, isId, isNatural, isRecord } from '../domain/validation.ts';

interface CommandEnvelope {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly matchId: string;
  readonly expectedRevision: number;
  readonly actor: Actor;
}
export type GameCommand = CommandEnvelope & (
  | { readonly kind: 'InitializeMatch'; readonly playerOrder: readonly string[] }
  | { readonly kind: 'PrepareHandoff'; readonly nextPlayerId: string }
  | { readonly kind: 'AcknowledgeHandoff' }
  | { readonly kind: 'PostTransaction'; readonly transaction: Transaction }
  | { readonly kind: 'RollDice' }
);
interface EventEnvelope {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly matchId: string;
  readonly revision: number;
  readonly ruleset: RulesetRef;
  readonly command: GameCommand;
}
export type GameEvent = EventEnvelope & (
  | { readonly kind: 'MatchInitialized'; readonly openingEconomy: {
    readonly unit: MoneyUnit; readonly startingUnits: number;
    readonly negativeBalancePolicy: RuleKnowledge<'allow-negative' | 'reject-negative'>;
  }; readonly board: BoardDefinition; readonly startingLocationId: string; readonly playerOrder: readonly string[] }
  | { readonly kind: 'HandoffPrepared'; readonly completedPlayerId: string | null; readonly incomingPlayerId: string }
  | { readonly kind: 'HandoffAcknowledged'; readonly playerId: string }
  | { readonly kind: 'TransactionPosted'; readonly posting: PostedTransaction }
  | { readonly kind: 'DiceRolled'; readonly definition: DiceDefinition; readonly playerId: string;
    readonly faces: readonly number[]; readonly rngBefore: RngState; readonly rngAfter: RngState }
);
export type CommandRejectionCode = 'INVALID_COMMAND' | 'INVALID_STATE' | 'INVALID_RULESET' | 'MATCH_MISMATCH' |
  'RULESET_MISMATCH' | 'REVISION_MISMATCH' | 'DUPLICATE_COMMAND' | 'COMMAND_ID_CONFLICT' | 'INVALID_ACTOR' |
  'WRONG_STAGE' | 'RULES_UNCONFIGURED' | 'INVALID_PLAYER_ORDER' | 'INPUT_LOCKED' | 'NOT_TURN_OWNER' |
  'HANDOFF_PENDING' | 'NO_HANDOFF_PENDING' | 'WRONG_INCOMING_PLAYER' | 'DECISION_PENDING' |
  'ECONOMY_REJECTED' | 'ENGINE_LIMIT' | 'RNG_EXHAUSTED';
export type CommandRejection =
  | { readonly code: Exclude<CommandRejectionCode, 'ECONOMY_REJECTED'>; readonly details: readonly string[] }
  | { readonly code: 'ECONOMY_REJECTED'; readonly economyError: EconomyError; readonly details: readonly string[] };
export interface EventRejection { readonly code: 'INVALID_EVENT' | 'INVALID_STATE' | 'EVENT_CONFLICT'; readonly details: readonly string[] }

export function isGameCommand(value: unknown): value is GameCommand {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isId(value.id) || !isId(value.matchId) ||
      !isNatural(value.expectedRevision) || !isActor(value.actor)) return false;
  const base = ['schemaVersion', 'id', 'matchId', 'expectedRevision', 'actor', 'kind'];
  switch (value.kind) {
    case 'InitializeMatch': return hasKeys(value, [...base, 'playerOrder']) && isArrayOf(value.playerOrder, isId);
    case 'PrepareHandoff': return hasKeys(value, [...base, 'nextPlayerId']) && isId(value.nextPlayerId);
    case 'AcknowledgeHandoff': case 'RollDice': return hasKeys(value, base);
    case 'PostTransaction': return hasKeys(value, [...base, 'transaction']) && isTransaction(value.transaction);
    default: return false;
  }
}
