import { rulesetRef, validateRuleset } from '../content/ruleset.ts';
import type { ValidatedRuleset, RulesetRef } from '../content/ruleset.ts';
import type { EconomyState } from '../economy/transactions.ts';
import type { RngState } from '../random/rng.ts';
import { seedRng } from '../random/rng.ts';
import { canonicalJson, hasKeys, isArrayOf, isId, isRecord, isText, unique } from './validation.ts';

export interface PlayerIdentity { readonly id: string; readonly name: string; readonly characterId: string }
export interface BoardPosition { readonly boardId: string; readonly boardVersion: string; readonly locationId: string }
export interface PlayerState extends PlayerIdentity {
  readonly position: BoardPosition | null;
  readonly status: { readonly kind: string; readonly reference: string } | null;
}
export interface DeckState {
  readonly id: string;
  readonly drawPile: readonly string[];
  readonly discardPile: readonly string[];
  readonly heldCards: readonly { readonly playerId: string; readonly cardId: string }[];
}
export interface PendingDecision {
  readonly id: string;
  readonly kind: 'dice-outcome';
  readonly playerId: string;
  readonly faces: readonly number[];
  readonly originatingEventId: string;
}
export interface HandoffState {
  readonly completedPlayerId: string | null;
  readonly incomingPlayerId: string | null;
  readonly acknowledgementRequired: boolean;
  readonly inputLocked: boolean;
}
export type CompletionState = { readonly status: 'unconfigured' } | { readonly status: 'in-progress' } |
  { readonly status: 'completed'; readonly winnerPlayerIds: readonly string[]; readonly reference: string };
export interface CommandReceipt {
  readonly commandId: string;
  readonly signature: string;
  readonly eventId: string;
  readonly revision: number;
}
export interface GameState {
  readonly schemaVersion: 1;
  readonly matchId: string;
  readonly ruleset: RulesetRef;
  readonly rulesetSignature: string;
  readonly revision: number;
  readonly stage: 'draft' | 'initialized';
  readonly players: readonly PlayerState[];
  readonly turn: { readonly ownerPlayerId: string | null; readonly completedTurns: number; readonly playerOrder: readonly string[] | null };
  readonly handoff: HandoffState;
  readonly pendingDecision: PendingDecision | null;
  readonly economy: EconomyState | null;
  readonly decks: readonly DeckState[] | null;
  readonly rng: RngState;
  readonly completion: CompletionState;
  // ponytail: receipts grow with match length; external journal dedup may replace them only with a versioned recovery contract.
  readonly commandReceipts: readonly CommandReceipt[];
}
export function createGameState(matchId: string, players: readonly PlayerIdentity[], ruleset: ValidatedRuleset, seed: string): GameState {
  const checked = validateRuleset(ruleset);
  if (!checked.ok) throw new TypeError(checked.issues.join('; '));
  if (!isId(matchId) || !isArrayOf(players, (player): player is PlayerIdentity => isRecord(player) &&
        hasKeys(player, ['id', 'name', 'characterId']) && isId(player.id) && isText(player.name) && isId(player.characterId)) || players.length === 0 || !unique(players.map((player) => player.id))) {
    throw new TypeError('Invalid match identities; player count legality awaits verified setup rules');
  }
  return { schemaVersion: 1, matchId, ruleset: rulesetRef(checked.value), rulesetSignature: canonicalJson(checked.value), revision: 0, stage: 'draft',
    players: players.map((player) => ({ id: player.id, name: player.name, characterId: player.characterId, position: null, status: null })),
    turn: { ownerPlayerId: null, completedTurns: 0, playerOrder: null },
    handoff: { completedPlayerId: null, incomingPlayerId: null, acknowledgementRequired: false, inputLocked: true },
    pendingDecision: null, economy: null, decks: null, rng: seedRng(seed), completion: { status: 'unconfigured' }, commandReceipts: [] };
}
