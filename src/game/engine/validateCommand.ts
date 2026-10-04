import type { ValidatedRuleset, RuleKey } from '../content/ruleset.ts';
import type { GameState } from '../domain/state.ts';
import { canonicalJson, unique } from '../domain/validation.ts';
import { openEconomy, postTransaction } from '../economy/transactions.ts';
import type { EconomyError } from '../economy/transactions.ts';
import type { GameCommand, CommandRejection, CommandRejectionCode } from './contracts.ts';

// Operational work budget, not a physical-game dice limit. Changing it changes engine acceptance semantics.
export const MAX_DICE_PER_COMMAND = 4096;
export const reject = (code: Exclude<CommandRejectionCode, 'ECONOMY_REJECTED'>, ...details: string[]): CommandRejection => ({ code, details });
const rejectEconomy = (economyError: EconomyError): CommandRejection => ({ code: 'ECONOMY_REJECTED', economyError, details: [economyError] });

/** Shared by command resolution and replay. No sampling, mutation or platform work. */
export function validateCommand(state: GameState, command: GameCommand, ruleset: ValidatedRuleset): CommandRejection | null {
  if (command.matchId !== state.matchId) return reject('MATCH_MISMATCH');
  if (canonicalJson(ruleset) !== state.rulesetSignature) return reject('RULESET_MISMATCH');
  const previous = state.commandReceipts.find((receipt) => receipt.commandId === command.id);
  if (previous) return reject(previous.signature === canonicalJson(command) ? 'DUPLICATE_COMMAND' : 'COMMAND_ID_CONFLICT');
  if (command.expectedRevision !== state.revision) return reject('REVISION_MISMATCH');
  if (state.revision === Number.MAX_SAFE_INTEGER) return reject('ENGINE_LIMIT', 'Revision exhausted');
  const actor = command.actor;
  const playerIds = state.players.map((player) => player.id);
  if (actor.kind === 'player' && !playerIds.includes(actor.playerId)) return reject('INVALID_ACTOR');
  if (state.completion.status === 'completed') return reject('WRONG_STAGE', 'Match completed');
  const c = ruleset.configuration;
  const missing = (keys: readonly RuleKey[]) => keys.filter((key) => c[key].status === 'unknown');
  if (command.kind === 'InitializeMatch') {
    if (state.stage !== 'draft') return reject('WRONG_STAGE');
    if (actor.kind !== 'system') return reject('INVALID_ACTOR', 'Initialization requires the trusted application actor');
    const absent = missing(['moneyUnit', 'startingCash', 'playerLimits', 'board', 'startingLocationId', 'turnOrder']);
    if (absent.length) return reject('RULES_UNCONFIGURED', ...absent);
    if (c.playerLimits.status !== 'confirmed' || c.moneyUnit.status !== 'confirmed' || c.startingCash.status !== 'confirmed') return reject('RULES_UNCONFIGURED');
    if (playerIds.length < c.playerLimits.value.minimum || playerIds.length > c.playerLimits.value.maximum ||
        command.playerOrder.length !== playerIds.length || !unique(command.playerOrder) || command.playerOrder.some((id) => !playerIds.includes(id))) return reject('INVALID_PLAYER_ORDER');
    const opened = openEconomy(c.moneyUnit.value, playerIds, c.startingCash.value, c.negativeBalancePolicy);
    return opened.ok ? null : rejectEconomy(opened.error);
  }
  if (state.stage !== 'initialized') return reject('WRONG_STAGE');
  if (command.kind === 'AcknowledgeHandoff') {
    if (!state.handoff.acknowledgementRequired) return reject('NO_HANDOFF_PENDING');
    return actor.kind === 'player' && actor.playerId === state.handoff.incomingPlayerId ? null : reject('WRONG_INCOMING_PLAYER');
  }
  if (command.kind === 'PrepareHandoff') {
    if (actor.kind !== 'system') return reject('INVALID_ACTOR', 'Turn completion is not a player-authorized free action');
    if (state.handoff.acknowledgementRequired) return reject('HANDOFF_PENDING');
    if (state.pendingDecision !== null) return reject('DECISION_PENDING');
    if (!playerIds.includes(command.nextPlayerId)) return reject('INVALID_ACTOR', 'Unknown incoming player');
    return state.turn.completedTurns === Number.MAX_SAFE_INTEGER ? reject('ENGINE_LIMIT', 'Turn counter exhausted') : null;
  }
  if (actor.kind === 'player') {
    if (state.handoff.inputLocked) return reject('INPUT_LOCKED');
    if (state.turn.ownerPlayerId !== actor.playerId) return reject('NOT_TURN_OWNER');
    if (state.pendingDecision !== null) return reject('DECISION_PENDING');
  }
  if (command.kind === 'PostTransaction') {
    if (state.economy === null) return reject('WRONG_STAGE');
    const posted = postTransaction(state.economy, command.transaction, actor);
    return posted.ok ? null : rejectEconomy(posted.error);
  }
  if (actor.kind !== 'player') return reject('INVALID_ACTOR');
  if (c.dice.status === 'unknown') return reject('RULES_UNCONFIGURED', 'dice');
  if (c.dice.value.count > MAX_DICE_PER_COMMAND || c.dice.value.sides > 0x100000000) return reject('ENGINE_LIMIT', 'Dice exceed the version-1 sampling work/range budget');
  return null;
}
