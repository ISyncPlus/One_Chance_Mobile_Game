import { rulesetRef, validateRuleset } from '../content/ruleset.ts';
import type { ValidatedRuleset } from '../content/ruleset.ts';
import type { GameState } from '../domain/state.ts';
import { eventId, isGameState } from '../domain/serialization.ts';
import { canonicalJson } from '../domain/validation.ts';
import { sampleInteger } from '../random/rng.ts';
import { isGameCommand } from './contracts.ts';
import type { CommandRejection, GameCommand, GameEvent } from './contracts.ts';
import { applyEvent } from './applyEvent.ts';
import { reject, validateCommand } from './validateCommand.ts';

export type ResolveResult = { readonly ok: true; readonly events: readonly GameEvent[]; readonly state: GameState } |
  { readonly ok: false; readonly rejection: CommandRejection };

/** One accepted command is one atomic event/revision. No I/O, clocks, ambient RNG or input mutation. */
export function resolveCommand(state: GameState, command: GameCommand, ruleset: ValidatedRuleset): ResolveResult {
  if (!isGameCommand(command)) return { ok: false, rejection: reject('INVALID_COMMAND') };
  if (!isGameState(state)) return { ok: false, rejection: reject('INVALID_STATE') };
  const checked = validateRuleset(ruleset);
  if (!checked.ok) return { ok: false, rejection: reject('INVALID_RULESET', ...checked.issues) };
  const invalid = validateCommand(state, command, checked.value);
  if (invalid) return { ok: false, rejection: invalid };
  const base = { schemaVersion: 1 as const, id: eventId(state.matchId, state.revision + 1), matchId: state.matchId,
    revision: state.revision + 1, ruleset: rulesetRef(checked.value), command };
  const c = checked.value.configuration;
  let event: GameEvent;
  switch (command.kind) {
    case 'InitializeMatch': {
      if (c.moneyUnit.status !== 'confirmed' || c.startingCash.status !== 'confirmed' || c.board.status !== 'confirmed' || c.startingLocationId.status !== 'confirmed') return { ok: false, rejection: reject('RULES_UNCONFIGURED') };
      event = { ...base, kind: 'MatchInitialized', openingEconomy: { unit: c.moneyUnit.value, startingUnits: c.startingCash.value, negativeBalancePolicy: c.negativeBalancePolicy }, board: c.board.value, startingLocationId: c.startingLocationId.value, playerOrder: command.playerOrder }; break;
    }
    case 'PrepareHandoff': event = { ...base, kind: 'HandoffPrepared', completedPlayerId: state.turn.ownerPlayerId, incomingPlayerId: command.nextPlayerId }; break;
    case 'AcknowledgeHandoff': {
      if (command.actor.kind !== 'player') return { ok: false, rejection: reject('INVALID_ACTOR') };
      event = { ...base, kind: 'HandoffAcknowledged', playerId: command.actor.playerId }; break;
    }
    case 'PostTransaction': event = { ...base, kind: 'TransactionPosted', posting: { transaction: command.transaction, commandId: command.id, eventId: base.id } }; break;
    case 'RollDice': {
      if (c.dice.status !== 'confirmed' || command.actor.kind !== 'player') return { ok: false, rejection: reject('RULES_UNCONFIGURED') };
      let cursor = state.rng; const faces: number[] = [];
      try {
        for (let i = 0; i < c.dice.value.count; i++) {
          const draw = sampleInteger(cursor, 1, c.dice.value.sides); faces.push(draw.value); cursor = draw.state;
        }
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        return { ok: false, rejection: reject('RNG_EXHAUSTED') };
      }
      event = { ...base, kind: 'DiceRolled', definition: c.dice.value, playerId: command.actor.playerId, faces, rngBefore: state.rng, rngAfter: cursor }; break;
    }
  }
  const applied = applyEvent(state, event);
  if (!applied.ok) throw new Error(`Resolver produced an invalid event: ${applied.rejection.details.join('; ')}`);
  return { ok: true, events: [JSON.parse(canonicalJson(event)) as GameEvent], state: applied.state };
}
