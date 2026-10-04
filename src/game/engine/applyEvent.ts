import { validateRuleset } from '../content/ruleset.ts';
import type { GameState } from '../domain/state.ts';
import { isGameEvent, isGameState } from '../domain/serialization.ts';
import { canonicalJson } from '../domain/validation.ts';
import { openEconomy, postTransaction } from '../economy/transactions.ts';
import type { EventRejection, GameEvent } from './contracts.ts';
import { validateCommand } from './validateCommand.ts';

export type ApplyResult = { readonly ok: true; readonly state: GameState } | { readonly ok: false; readonly rejection: EventRejection };
const conflict = (...details: string[]): ApplyResult => ({ ok: false, rejection: { code: 'EVENT_CONFLICT', details } });
const equal = (left: unknown, right: unknown) => canonicalJson(left) === canonicalJson(right);

/** Recorded outcomes are applied without drawing RNG or consulting time. Duplicate replay is a conflict. */
export function applyEvent(state: GameState, event: GameEvent): ApplyResult {
  if (!isGameState(state)) return { ok: false, rejection: { code: 'INVALID_STATE', details: [] } };
  if (!isGameEvent(event)) return { ok: false, rejection: { code: 'INVALID_EVENT', details: [] } };
  if (!equal(state.ruleset, event.ruleset) || event.revision !== state.revision + 1) return conflict('Ruleset or revision mismatch');
  const pinned = validateRuleset(JSON.parse(state.rulesetSignature));
  if (!pinned.ok) return conflict('Invalid pinned ruleset');
  const invalid = validateCommand(state, event.command, pinned.value);
  if (invalid) return conflict(invalid.code, ...invalid.details);
  const c = pinned.value.configuration;
  let changed: GameState = state;
  switch (event.kind) {
    case 'MatchInitialized': {
      if (c.moneyUnit.status !== 'confirmed' || c.startingCash.status !== 'confirmed' || c.board.status !== 'confirmed' || c.startingLocationId.status !== 'confirmed' || event.command.kind !== 'InitializeMatch') return conflict('Missing setup configuration');
      if (!equal(event.openingEconomy, { unit: c.moneyUnit.value, startingUnits: c.startingCash.value, negativeBalancePolicy: c.negativeBalancePolicy }) ||
          !equal(event.board, c.board.value) || event.startingLocationId !== c.startingLocationId.value || !equal(event.playerOrder, event.command.playerOrder)) return conflict('Initialization differs from pinned configuration/command');
      const opened = openEconomy(event.openingEconomy.unit, state.players.map((player) => player.id), event.openingEconomy.startingUnits, event.openingEconomy.negativeBalancePolicy);
      if (!opened.ok) return conflict(opened.error);
      const incoming = event.playerOrder[0];
      if (incoming === undefined) return conflict('Missing incoming player');
      changed = { ...state, stage: 'initialized', economy: opened.economy, turn: { ...state.turn, playerOrder: event.playerOrder },
        players: state.players.map((player) => ({ ...player, position: { boardId: event.board.id, boardVersion: event.board.version, locationId: event.startingLocationId } })),
        handoff: { completedPlayerId: null, incomingPlayerId: incoming, acknowledgementRequired: true, inputLocked: true } };
      break;
    }
    case 'HandoffPrepared': {
      if (event.command.kind !== 'PrepareHandoff' || event.incomingPlayerId !== event.command.nextPlayerId || event.completedPlayerId !== state.turn.ownerPlayerId) return conflict('Handoff payload differs from ownership/command');
      changed = { ...state, turn: { ...state.turn, ownerPlayerId: null, completedTurns: state.turn.completedTurns + 1 },
        handoff: { completedPlayerId: event.completedPlayerId, incomingPlayerId: event.incomingPlayerId, acknowledgementRequired: true, inputLocked: true } };
      break;
    }
    case 'HandoffAcknowledged': {
      if (event.playerId !== state.handoff.incomingPlayerId) return conflict('Acknowledging player differs from incoming player');
      changed = { ...state, turn: { ...state.turn, ownerPlayerId: event.playerId }, handoff: { ...state.handoff, acknowledgementRequired: false, inputLocked: false } };
      break;
    }
    case 'TransactionPosted': {
      if (event.command.kind !== 'PostTransaction' || !equal(event.posting.transaction, event.command.transaction) || state.economy === null) return conflict('Transaction differs from command');
      const posted = postTransaction(state.economy, event.posting.transaction, event.command.actor);
      if (!posted.ok) return conflict(posted.error);
      changed = { ...state, economy: posted.economy }; break;
    }
    case 'DiceRolled': {
      if (c.dice.status !== 'confirmed' || !equal(event.definition, c.dice.value) || event.playerId !== state.turn.ownerPlayerId ||
          !equal(event.rngBefore, state.rng) || (event.definition.sides === 1 ? !equal(event.rngAfter, event.rngBefore) : event.rngAfter.draws - event.rngBefore.draws < event.definition.count)) return conflict('Dice configuration, owner or RNG checkpoint mismatch');
      changed = { ...state, rng: event.rngAfter, pendingDecision: { id: `${event.id}:dice`, kind: 'dice-outcome', playerId: event.playerId, faces: event.faces, originatingEventId: event.id } }; break;
    }
  }
  const next: GameState = { ...changed, revision: event.revision, commandReceipts: [...state.commandReceipts,
    { commandId: event.command.id, signature: canonicalJson(event.command), eventId: event.id, revision: event.revision }] };
  if (!isGameState(next)) return conflict('Resulting state violates invariants');
  // Detach all accepted state from caller-owned state/event objects, not only changed branches.
  return { ok: true, state: JSON.parse(canonicalJson(next)) as GameState };
}
