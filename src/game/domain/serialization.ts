import { isBoard, isDice, isKnowledge, isMoneyUnit, isRulesetRef, validateRuleset } from '../content/ruleset.ts';
import { isEconomy, isTransaction } from '../economy/transactions.ts';
import { isGameCommand } from '../engine/contracts.ts';
import type { GameCommand, GameEvent } from '../engine/contracts.ts';
import { isRngState } from '../random/rng.ts';
import type { GameState, PlayerState, BoardPosition, DeckState, PendingDecision, CompletionState, CommandReceipt, HandoffState } from './state.ts';
import { canonicalJson, hasKeys, isArrayOf, isId, isInteger, isNatural, isPositive, isRecord, isText, unique, type Validation } from './validation.ts';

function isPosition(value: unknown): value is BoardPosition {
  return isRecord(value) && hasKeys(value, ['boardId', 'boardVersion', 'locationId']) && isId(value.boardId) && isText(value.boardVersion) && isId(value.locationId);
}
function isPlayer(value: unknown): value is PlayerState {
  return isRecord(value) && hasKeys(value, ['id', 'name', 'characterId', 'position', 'status']) && isId(value.id) &&
    isText(value.name) && isId(value.characterId) && (value.position === null || isPosition(value.position)) &&
    (value.status === null || (isRecord(value.status) && hasKeys(value.status, ['kind', 'reference']) && isText(value.status.kind) && isText(value.status.reference)));
}
function isDeck(value: unknown): value is DeckState {
  return isRecord(value) && hasKeys(value, ['id', 'drawPile', 'discardPile', 'heldCards']) && isId(value.id) &&
    isArrayOf(value.drawPile, isId) && isArrayOf(value.discardPile, isId) &&
    isArrayOf(value.heldCards, (held): held is DeckState['heldCards'][number] => isRecord(held) && hasKeys(held, ['playerId', 'cardId']) && isId(held.playerId) && isId(held.cardId));
}
function isDecision(value: unknown): value is PendingDecision {
  return isRecord(value) && hasKeys(value, ['id', 'kind', 'playerId', 'faces', 'originatingEventId']) && isText(value.id) &&
    value.kind === 'dice-outcome' && isId(value.playerId) && isArrayOf(value.faces, isPositive) && value.faces.length > 0 && isText(value.originatingEventId);
}
function isCompletion(value: unknown): value is CompletionState {
  return isRecord(value) && (((value.status === 'unconfigured' || value.status === 'in-progress') && hasKeys(value, ['status'])) ||
    (value.status === 'completed' && hasKeys(value, ['status', 'winnerPlayerIds', 'reference']) && isArrayOf(value.winnerPlayerIds, isId) && unique(value.winnerPlayerIds) && isText(value.reference)));
}
function isReceipt(value: unknown): value is CommandReceipt {
  return isRecord(value) && hasKeys(value, ['commandId', 'signature', 'eventId', 'revision']) && isId(value.commandId) &&
    isText(value.signature) && isText(value.eventId) && isPositive(value.revision);
}
function isHandoff(value: unknown): value is HandoffState {
  return isRecord(value) && hasKeys(value, ['completedPlayerId', 'incomingPlayerId', 'acknowledgementRequired', 'inputLocked']) &&
    (value.completedPlayerId === null || isId(value.completedPlayerId)) && (value.incomingPlayerId === null || isId(value.incomingPlayerId)) &&
    typeof value.acknowledgementRequired === 'boolean' && typeof value.inputLocked === 'boolean';
}
export function eventId(matchId: string, revision: number): string { return `${matchId}:${revision}`; }

export function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || !hasKeys(value, ['schemaVersion', 'matchId', 'ruleset', 'rulesetSignature', 'revision', 'stage', 'players',
      'turn', 'handoff', 'pendingDecision', 'economy', 'decks', 'rng', 'completion', 'commandReceipts']) ||
      value.schemaVersion !== 1 || !isId(value.matchId) || !isRulesetRef(value.ruleset) || !isText(value.rulesetSignature) ||
      !isNatural(value.revision) || (value.stage !== 'draft' && value.stage !== 'initialized') ||
      !isArrayOf(value.players, isPlayer) || value.players.length === 0 || !unique(value.players.map((p) => p.id)) ||
      !isRecord(value.turn) || !hasKeys(value.turn, ['ownerPlayerId', 'completedTurns', 'playerOrder']) ||
      !(value.turn.ownerPlayerId === null || isId(value.turn.ownerPlayerId)) || !isNatural(value.turn.completedTurns) || !(value.turn.playerOrder === null || isArrayOf(value.turn.playerOrder, isId)) ||
      !isHandoff(value.handoff) || !(value.pendingDecision === null || isDecision(value.pendingDecision)) ||
      !(value.economy === null || isEconomy(value.economy)) || !(value.decks === null || isArrayOf(value.decks, isDeck)) ||
      !isRngState(value.rng) || !isCompletion(value.completion) || !isArrayOf(value.commandReceipts, isReceipt)) return false;
  const ids = value.players.map((p) => p.id);
  const playerOrNull = (id: unknown) => id === null || (typeof id === 'string' && ids.includes(id));
  if (!playerOrNull(value.turn.ownerPlayerId) || !playerOrNull(value.handoff.completedPlayerId) || !playerOrNull(value.handoff.incomingPlayerId)) return false;
  if (value.handoff.acknowledgementRequired && (!value.handoff.inputLocked || value.handoff.incomingPlayerId === null || value.turn.ownerPlayerId !== null)) return false;
  if (!value.handoff.inputLocked && (value.handoff.acknowledgementRequired || value.turn.ownerPlayerId === null || value.turn.ownerPlayerId !== value.handoff.incomingPlayerId)) return false;
  if (!value.handoff.acknowledgementRequired && value.handoff.incomingPlayerId !== null && value.turn.ownerPlayerId !== value.handoff.incomingPlayerId) return false;
  if (value.economy !== null && (value.economy.accounts.length !== ids.length || value.economy.accounts.some((a) => !ids.includes(a.playerId)))) return false;
  if (value.pendingDecision !== null && (!ids.includes(value.pendingDecision.playerId) || value.turn.ownerPlayerId !== value.pendingDecision.playerId || value.handoff.inputLocked)) return false;
  if (value.stage === 'draft' && (value.revision !== 0 || value.economy !== null || value.players.some((p) => p.position !== null) ||
      value.turn.ownerPlayerId !== null || value.turn.completedTurns !== 0 || value.turn.playerOrder !== null || value.handoff.incomingPlayerId !== null ||
      value.handoff.completedPlayerId !== null || !value.handoff.inputLocked || value.pendingDecision !== null || value.decks !== null || value.rng.draws !== 0 ||
      value.players.some((p) => p.status !== null) || value.completion.status !== 'unconfigured')) return false;
  if (value.stage === 'initialized' && (value.economy === null || value.players.some((p) => p.position === null) || value.revision === 0 || value.handoff.incomingPlayerId === null || value.turn.playerOrder === null ||
      value.turn.playerOrder.length !== ids.length || !unique(value.turn.playerOrder) || value.turn.playerOrder.some((id) => !ids.includes(id)))) return false;
  if (value.completion.status === 'completed' && (!value.handoff.inputLocked || value.completion.winnerPlayerIds.some((id) => !ids.includes(id)))) return false;
  if (value.decks !== null && (!unique(value.decks.map((deck) => deck.id)) || value.decks.some((deck) =>
      deck.heldCards.some((held) => !ids.includes(held.playerId)) || !unique([...deck.drawPile, ...deck.discardPile, ...deck.heldCards.map((held) => held.cardId)])))) return false;
  if (value.commandReceipts.length !== value.revision || !unique(value.commandReceipts.map((receipt) => receipt.commandId))) return false;
  for (const [index, receipt] of value.commandReceipts.entries()) {
    if (receipt.revision !== index + 1 || receipt.eventId !== eventId(value.matchId, receipt.revision)) return false;
    try {
      const command: unknown = JSON.parse(receipt.signature);
      if (!isGameCommand(command) || command.id !== receipt.commandId || command.matchId !== value.matchId || command.expectedRevision !== index || canonicalJson(command) !== receipt.signature) return false;
    } catch { return false; }
  }
  try {
    const parsed: unknown = JSON.parse(value.rulesetSignature); const checked = validateRuleset(parsed);
    if (!checked.ok || canonicalJson(checked.value) !== value.rulesetSignature || checked.value.id !== value.ruleset.id || checked.value.version !== value.ruleset.version) return false;
    const c = checked.value.configuration;
    if (value.stage === 'initialized') {
      if (c.board.status !== 'confirmed' || c.startingLocationId.status !== 'confirmed' ||
          c.moneyUnit.status !== 'confirmed' || c.startingCash.status !== 'confirmed' ||
          c.playerLimits.status !== 'confirmed' || c.turnOrder.status !== 'confirmed' || value.economy === null) return false;
      const board = c.board.value;
      if (ids.length < c.playerLimits.value.minimum || ids.length > c.playerLimits.value.maximum ||
          canonicalJson(value.economy.unit) !== canonicalJson(c.moneyUnit.value) ||
          canonicalJson(value.economy.negativeBalancePolicy) !== canonicalJson(c.negativeBalancePolicy) ||
          value.players.some((p) => p.position?.boardId !== board.id || p.position?.boardVersion !== board.version ||
            !board.locationIds.includes(p.position?.locationId ?? ''))) return false;
      const first: unknown = JSON.parse(value.commandReceipts[0]?.signature ?? 'null');
      if (!isGameCommand(first) || first.kind !== 'InitializeMatch' || canonicalJson(first.playerOrder) !== canonicalJson(value.turn.playerOrder)) return false;
    }
    const decision = value.pendingDecision;
    if (decision !== null) {
      if (c.dice.status !== 'confirmed' || decision.faces.length !== c.dice.value.count ||
          decision.faces.some((face) => c.dice.status !== 'confirmed' || face > c.dice.value.sides) ||
          decision.id !== `${decision.originatingEventId}:dice`) return false;
      const origin = value.commandReceipts.find((receipt) => receipt.eventId === decision.originatingEventId);
      const input: unknown = JSON.parse(origin?.signature ?? 'null');
      if (!isGameCommand(input) || input.kind !== 'RollDice' || input.actor.kind !== 'player' || input.actor.playerId !== decision.playerId) return false;
    }
    if (value.decks !== null) {
      if (c.cards.status !== 'confirmed' || c.deckHandling.status !== 'confirmed') return false;
      const configured = c.cards.value.map((card) => card.id);
      const present = value.decks.flatMap((deck) => [...deck.drawPile, ...deck.discardPile, ...deck.heldCards.map((held) => held.cardId)]);
      if (!unique(present) || present.some((cardId) => !configured.includes(cardId))) return false;
    }
    if (value.completion.status !== 'unconfigured' && c.victory.status !== 'confirmed') return false;
  } catch { return false; }
  return true;
}
export function isGameEvent(value: unknown): value is GameEvent {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isId(value.matchId) || !isPositive(value.revision) ||
      value.id !== eventId(value.matchId, value.revision) || !isRulesetRef(value.ruleset) || !isGameCommand(value.command) ||
      value.command.matchId !== value.matchId || value.command.expectedRevision !== value.revision - 1) return false;
  const base = ['schemaVersion', 'id', 'matchId', 'revision', 'ruleset', 'command', 'kind'];
  switch (value.kind) {
    case 'MatchInitialized': return hasKeys(value, [...base, 'openingEconomy', 'board', 'startingLocationId', 'playerOrder']) &&
      value.command.kind === 'InitializeMatch' && isRecord(value.openingEconomy) &&
      hasKeys(value.openingEconomy, ['unit', 'startingUnits', 'negativeBalancePolicy']) && isMoneyUnit(value.openingEconomy.unit) &&
      isInteger(value.openingEconomy.startingUnits) && isKnowledge(value.openingEconomy.negativeBalancePolicy, (v): v is 'allow-negative' | 'reject-negative' => v === 'allow-negative' || v === 'reject-negative') &&
      isBoard(value.board) && isId(value.startingLocationId) && value.board.locationIds.includes(value.startingLocationId) && isArrayOf(value.playerOrder, isId);
    case 'HandoffPrepared': return hasKeys(value, [...base, 'completedPlayerId', 'incomingPlayerId']) && value.command.kind === 'PrepareHandoff' &&
      (value.completedPlayerId === null || isId(value.completedPlayerId)) && isId(value.incomingPlayerId);
    case 'HandoffAcknowledged': return hasKeys(value, [...base, 'playerId']) && value.command.kind === 'AcknowledgeHandoff' && isId(value.playerId);
    case 'TransactionPosted': return hasKeys(value, [...base, 'posting']) && value.command.kind === 'PostTransaction' && isRecord(value.posting) &&
      hasKeys(value.posting, ['transaction', 'commandId', 'eventId']) && isTransaction(value.posting.transaction) && value.posting.commandId === value.command.id && value.posting.eventId === value.id;
    case 'DiceRolled': {
      const definition = value.definition;
      return hasKeys(value, [...base, 'definition', 'playerId', 'faces', 'rngBefore', 'rngAfter']) && value.command.kind === 'RollDice' &&
      isDice(definition) && isId(value.playerId) && isArrayOf(value.faces, isPositive) && value.faces.length === definition.count &&
      value.faces.every((face) => face <= definition.sides) && isRngState(value.rngBefore) && isRngState(value.rngAfter) &&
      value.rngAfter.draws >= value.rngBefore.draws;
    }
    default: return false;
  }
}
function decode<T>(text: string, guard: (value: unknown) => value is T): Validation<T> {
  try { const value: unknown = JSON.parse(text); return guard(value) ? { ok: true, value } : { ok: false, issues: ['Invalid or unsupported serialized schema/invariants'] }; }
  catch { return { ok: false, issues: ['Invalid JSON'] }; }
}
function encode<T>(value: T, guard: (input: unknown) => input is T): string {
  if (!guard(value)) throw new TypeError('Cannot serialize invalid domain data');
  return canonicalJson(value);
}
export const serializeState = (state: GameState): string => encode(state, isGameState);
export const deserializeState = (text: string): Validation<GameState> => decode(text, isGameState);
export const serializeEvent = (event: GameEvent): string => encode(event, isGameEvent);
export const deserializeEvent = (text: string): Validation<GameEvent> => decode(text, isGameEvent);
export const serializeCommand = (command: GameCommand): string => encode(command, isGameCommand);
export const deserializeCommand = (text: string): Validation<GameCommand> => decode(text, isGameCommand);
