import { canonicalJson, hasKeys, isArrayOf, isId, isInteger, isPositive, isRecord, isText, unique, type Validation } from '../domain/validation.ts';
import type { RuleKnowledge, RuleSource } from './provenance.ts';

export interface MoneyUnit { readonly currencyCode: string; readonly unitLabel: string; readonly unitsPerMajor: number }
export interface PlayerLimits { readonly minimum: number; readonly maximum: number }
export interface DiceDefinition { readonly count: number; readonly sides: number }
/** Logical identities only; topology/movement semantics remain separate verified rules. */
export interface BoardDefinition { readonly id: string; readonly version: string; readonly locationIds: readonly string[] }
export interface RuleConfiguration {
  readonly moneyUnit: RuleKnowledge<MoneyUnit>;
  readonly startingCash: RuleKnowledge<number>;
  readonly playerLimits: RuleKnowledge<PlayerLimits>;
  readonly dice: RuleKnowledge<DiceDefinition>;
  readonly board: RuleKnowledge<BoardDefinition>;
  readonly startingLocationId: RuleKnowledge<string>;
  readonly turnOrder: RuleKnowledge<'provided-order'>;
  readonly negativeBalancePolicy: RuleKnowledge<'allow-negative' | 'reject-negative'>;
  readonly movement: RuleKnowledge<string>;
  readonly jambResolution: RuleKnowledge<string>;
  readonly salary: RuleKnowledge<string>;
  readonly traffic: RuleKnowledge<string>;
  readonly prison: RuleKnowledge<string>;
  readonly tax: RuleKnowledge<string>;
  readonly ajo: RuleKnowledge<string>;
  readonly bankInvestment: RuleKnowledge<string>;
  readonly marketInvestment: RuleKnowledge<string>;
  readonly cards: RuleKnowledge<readonly { readonly id: string; readonly text: string }[]>;
  readonly deckHandling: RuleKnowledge<string>;
  readonly financialResolution: RuleKnowledge<string>;
  readonly victory: RuleKnowledge<string>;
  readonly conflictPrecedence: RuleKnowledge<string>;
}
export interface RulesetRef { readonly schemaVersion: 1; readonly id: string; readonly version: string }
export interface RulesetDraft extends RulesetRef {
  readonly purpose: 'production' | 'test-fixture';
  readonly facts: {
    readonly beginsWithJamb: RuleKnowledge<boolean>;
    readonly jambPassingFaces: RuleKnowledge<readonly number[]>;
    readonly physicalCardCount: RuleKnowledge<number>;
    readonly mechanicsPresent: RuleKnowledge<readonly string[]>;
    readonly multiplePlayers: RuleKnowledge<boolean>;
    readonly wealthAndFinancialDecisionsMatter: RuleKnowledge<boolean>;
    readonly cardsCanBePositiveOrNegative: RuleKnowledge<boolean>;
  };
  readonly configuration: RuleConfiguration;
}
/** Validation is rechecked at resolver trust boundaries; this tag is not an authorization token. */
export interface ValidatedRuleset extends RulesetDraft { readonly validationVersion: 1 }
export type RuleKey = keyof RuleConfiguration;

export function isRuleSource(value: unknown): value is RuleSource {
  return isRecord(value) && hasKeys(value, ['id', 'kind', 'reference', 'edition']) && isId(value.id) &&
    ['product-brief', 'rulebook', 'board', 'card', 'owner-clarification', 'test-fixture'].includes(typeof value.kind === 'string' ? value.kind : '') &&
    isText(value.reference) && (value.edition === null || isText(value.edition));
}
export function isKnowledge<T>(value: unknown, guard: (data: unknown) => data is T): value is RuleKnowledge<T> {
  if (!isRecord(value)) return false;
  if (value.status === 'unknown') return hasKeys(value, ['status', 'value']) && value.value === null;
  return value.status === 'confirmed' && hasKeys(value, ['status', 'value', 'sources']) && guard(value.value) &&
    isArrayOf(value.sources, isRuleSource) && value.sources.length > 0 && unique(value.sources.map((source) => source.id));
}
export function isMoneyUnit(value: unknown): value is MoneyUnit {
  return isRecord(value) && hasKeys(value, ['currencyCode', 'unitLabel', 'unitsPerMajor']) &&
    isText(value.currencyCode) && isText(value.unitLabel) && isPositive(value.unitsPerMajor);
}
function isLimits(value: unknown): value is PlayerLimits {
  return isRecord(value) && hasKeys(value, ['minimum', 'maximum']) && isPositive(value.minimum) &&
    isPositive(value.maximum) && value.minimum <= value.maximum;
}
export function isDice(value: unknown): value is DiceDefinition {
  return isRecord(value) && hasKeys(value, ['count', 'sides']) && isPositive(value.count) && isPositive(value.sides);
}
export function isBoard(value: unknown): value is BoardDefinition {
  return isRecord(value) && hasKeys(value, ['id', 'version', 'locationIds']) && isId(value.id) && isText(value.version) &&
    isArrayOf(value.locationIds, isId) && value.locationIds.length > 0 && unique(value.locationIds);
}
function isCards(value: unknown): value is readonly { readonly id: string; readonly text: string }[] {
  return isArrayOf(value, (card): card is { readonly id: string; readonly text: string } =>
    isRecord(card) && hasKeys(card, ['id', 'text']) && isId(card.id) && isText(card.text)) && value.length > 0 &&
    unique(value.map((card) => card.id));
}
const textRules = ['movement', 'jambResolution', 'salary', 'traffic', 'prison', 'tax', 'ajo', 'bankInvestment',
  'marketInvestment', 'deckHandling', 'financialResolution', 'victory', 'conflictPrecedence'] as const;
const configurationKeys: readonly RuleKey[] = ['moneyUnit', 'startingCash', 'playerLimits', 'dice', 'board',
  'startingLocationId', 'turnOrder', 'negativeBalancePolicy', 'cards', ...textRules];
export function isRulesetRef(value: unknown): value is RulesetRef {
  return isRecord(value) && hasKeys(value, ['schemaVersion', 'id', 'version']) && value.schemaVersion === 1 && isId(value.id) && isText(value.version);
}
export function rulesetRef(ruleset: RulesetDraft): RulesetRef {
  return { schemaVersion: ruleset.schemaVersion, id: ruleset.id, version: ruleset.version };
}
export function validateRuleset(value: unknown): Validation<ValidatedRuleset> {
  if (!isRecord(value) || !(hasKeys(value, ['schemaVersion', 'id', 'version', 'purpose', 'facts', 'configuration']) ||
      (hasKeys(value, ['schemaVersion', 'id', 'version', 'purpose', 'facts', 'configuration', 'validationVersion']) && value.validationVersion === 1)) ||
      value.schemaVersion !== 1 || !isId(value.id) || !isText(value.version) ||
      !['production', 'test-fixture'].includes(typeof value.purpose === 'string' ? value.purpose : '') || !isRecord(value.facts) || !isRecord(value.configuration)) {
    return { ok: false, issues: ['Invalid or unsupported ruleset envelope'] };
  }
  const f = value.facts; const c = value.configuration; const issues: string[] = [];
  if (!hasKeys(f, ['beginsWithJamb', 'jambPassingFaces', 'physicalCardCount', 'mechanicsPresent', 'multiplePlayers',
      'wealthAndFinancialDecisionsMatter', 'cardsCanBePositiveOrNegative']) ||
      !isKnowledge(f.beginsWithJamb, (v): v is boolean => typeof v === 'boolean') ||
      !isKnowledge(f.jambPassingFaces, (v): v is number[] => isArrayOf(v, isPositive) && v.length > 0 && new Set(v).size === v.length) ||
      !isKnowledge(f.physicalCardCount, isPositive) ||
      !isKnowledge(f.mechanicsPresent, (v): v is string[] => isArrayOf(v, isText) && v.length > 0 && unique(v)) ||
      !['multiplePlayers', 'wealthAndFinancialDecisionsMatter', 'cardsCanBePositiveOrNegative'].every((key) => isKnowledge(f[key], (v): v is boolean => typeof v === 'boolean'))) issues.push('Invalid facts or provenance');
  if (!hasKeys(c, configurationKeys)) issues.push('Configuration must retain every explicit unknown field');
  for (const key of textRules) if (!isKnowledge(c[key], isText)) issues.push(`Invalid configuration.${key}`);
  if (!isKnowledge(c.moneyUnit, isMoneyUnit)) issues.push('Invalid moneyUnit');
  if (!isKnowledge(c.startingCash, isInteger)) issues.push('Invalid startingCash integer');
  if (!isKnowledge(c.playerLimits, isLimits)) issues.push('Invalid playerLimits');
  if (!isKnowledge(c.dice, isDice)) issues.push('Invalid dice');
  if (!isKnowledge(c.board, isBoard)) issues.push('Invalid board');
  if (!isKnowledge(c.startingLocationId, isId)) issues.push('Invalid startingLocationId');
  if (!isKnowledge(c.turnOrder, (v): v is 'provided-order' => v === 'provided-order')) issues.push('Unsupported turnOrder');
  if (!isKnowledge(c.negativeBalancePolicy, (v): v is 'allow-negative' | 'reject-negative' => v === 'allow-negative' || v === 'reject-negative')) issues.push('Invalid negativeBalancePolicy');
  if (!isKnowledge(c.cards, isCards)) issues.push('Invalid cards');
  if (issues.length) return { ok: false, issues };
  // All members have passed their shape guards above; JSON copy detaches caller-owned arrays.
  const draft = JSON.parse(JSON.stringify(value)) as RulesetDraft;
  const knowledge = [...Object.values(draft.facts), ...Object.values(draft.configuration)];
  const sources = knowledge.flatMap((rule) => rule.status === 'confirmed' ? [...rule.sources] : []);
  if (draft.purpose === 'production' && sources.some((source) => source.kind === 'test-fixture')) issues.push('Artificial evidence cannot configure production rules');
  const byId = new Map<string, string>();
  for (const source of sources) {
    const signature = canonicalJson(source);
    if (byId.has(source.id) && byId.get(source.id) !== signature) issues.push(`Conflicting source identity: ${source.id}`);
    byId.set(source.id, signature);
  }
  const board = draft.configuration.board; const start = draft.configuration.startingLocationId;
  if (board.status === 'confirmed' && start.status === 'confirmed' && !board.value.locationIds.includes(start.value)) issues.push('Starting location absent from board definition');
  if (draft.facts.physicalCardCount.status === 'confirmed' && draft.configuration.cards.status === 'confirmed' &&
      draft.facts.physicalCardCount.value !== draft.configuration.cards.value.length) issues.push('Card definitions do not match configured physical count');
  return issues.length ? { ok: false, issues } : { ok: true, value: { ...draft, validationVersion: 1 } };
}
export function assessReadiness(ruleset: ValidatedRuleset) {
  const missingRules = configurationKeys.filter((key) => ruleset.configuration[key].status === 'unknown');
  const missingFacts = Object.entries(ruleset.facts).filter(([, rule]) => rule.status === 'unknown').map(([key]) => key);
  // Phase 2 records sourced text; it does not pretend to execute the physical rulebook.
  const unavailableEngineSystems = ['jamb-resolution', 'movement', 'salary', 'traffic', 'prison', 'tax', 'ajo',
    'investments', 'card-resolution', 'deck-lifecycle', 'victory', 'conflict-resolution'] as const;
  return { playable: false as const, contentComplete: missingRules.length === 0 && missingFacts.length === 0,
    missingRules, missingFacts, unavailableEngineSystems };
}

export function serializeRuleset(ruleset: ValidatedRuleset): string {
  const checked = validateRuleset(ruleset);
  if (!checked.ok) throw new TypeError(checked.issues.join('; '));
  return canonicalJson(checked.value);
}
export function deserializeRuleset(text: string): Validation<ValidatedRuleset> {
  try { return validateRuleset(JSON.parse(text)); }
  catch { return { ok: false, issues: ['Invalid ruleset JSON'] }; }
}
