import type { RuleKnowledge, RuleSource } from './provenance.ts';
import type { RulesetDraft } from './ruleset.ts';

const source: RuleSource = { id: 'owner-product-brief', kind: 'product-brief',
  reference: 'One Chance Mobile founding product brief; physical materials not yet supplied', edition: null };
const known = <T>(value: T): RuleKnowledge<T> => ({ status: 'confirmed', value, sources: [{ ...source }] });
const unknown = (): { readonly status: 'unknown'; readonly value: null } => ({ status: 'unknown', value: null });

export function createOneChanceDraft(): RulesetDraft {
  return { schemaVersion: 1, id: 'one-chance', version: 'draft-1', purpose: 'production', facts: {
    beginsWithJamb: known(true), jambPassingFaces: known([4, 5, 6]), physicalCardCount: known(32),
    mechanicsPresent: known(['salary', 'traffic', 'prison', 'tax', 'ajo', 'bank-investment', 'market-investment']),
    multiplePlayers: known(true), wealthAndFinancialDecisionsMatter: known(true), cardsCanBePositiveOrNegative: known(true),
  }, configuration: {
    moneyUnit: unknown(), startingCash: unknown(), playerLimits: unknown(), dice: unknown(), board: unknown(),
    startingLocationId: unknown(), turnOrder: unknown(), negativeBalancePolicy: unknown(), movement: unknown(),
    jambResolution: unknown(), salary: unknown(), traffic: unknown(), prison: unknown(), tax: unknown(), ajo: unknown(),
    bankInvestment: unknown(), marketInvestment: unknown(), cards: unknown(), deckHandling: unknown(),
    financialResolution: unknown(), victory: unknown(), conflictPrecedence: unknown(),
  } };
}
