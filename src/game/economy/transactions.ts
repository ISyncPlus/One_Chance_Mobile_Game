import type { MoneyUnit } from '../content/ruleset.ts';
import { isKnowledge, isMoneyUnit } from '../content/ruleset.ts';
import type { RuleKnowledge } from '../content/provenance.ts';
import { hasKeys, isArrayOf, isId, isInteger, isPositive, isRecord, isText, unique } from '../domain/validation.ts';

export type Actor = { readonly kind: 'system' } | { readonly kind: 'player'; readonly playerId: string };
export interface TransactionReference { readonly reason: string; readonly reference: string }
interface TransactionBase extends TransactionReference {
  readonly id: string;
  readonly origin: Actor;
  readonly amountUnits: number;
}
export type Transaction =
  | (TransactionBase & { readonly kind: 'credit'; readonly toPlayerId: string })
  | (TransactionBase & { readonly kind: 'debit'; readonly fromPlayerId: string })
  | (TransactionBase & { readonly kind: 'transfer'; readonly fromPlayerId: string; readonly toPlayerId: string });
export interface AccountBalance { readonly playerId: string; readonly balanceUnits: number }
export interface EconomyState {
  readonly schemaVersion: 1;
  readonly unit: MoneyUnit;
  readonly negativeBalancePolicy: RuleKnowledge<'allow-negative' | 'reject-negative'>;
  readonly accounts: readonly AccountBalance[];
  readonly transactionIds: readonly string[];
}
export interface TransactionOrigin { readonly commandId: string; readonly eventId: string }
export interface PostedTransaction extends TransactionOrigin { readonly transaction: Transaction }
export type EconomyError = 'INVALID_TRANSACTION' | 'DUPLICATE_TRANSACTION' | 'UNKNOWN_ACCOUNT' |
  'ORIGIN_MISMATCH' | 'NEGATIVE_BALANCE_POLICY_UNKNOWN' | 'INSUFFICIENT_FUNDS' | 'MONEY_OVERFLOW';
export type EconomyResult = { readonly ok: true; readonly economy: EconomyState } | { readonly ok: false; readonly error: EconomyError };

export function isActor(value: unknown): value is Actor {
  return isRecord(value) && ((value.kind === 'system' && hasKeys(value, ['kind'])) ||
    (value.kind === 'player' && hasKeys(value, ['kind', 'playerId']) && isId(value.playerId)));
}
export function isTransaction(value: unknown): value is Transaction {
  if (!isRecord(value) || !isId(value.id) || !isActor(value.origin) || !isPositive(value.amountUnits) ||
      !isText(value.reason) || !isText(value.reference)) return false;
  const base = ['id', 'origin', 'amountUnits', 'reason', 'reference', 'kind'];
  if (value.kind === 'credit') return hasKeys(value, [...base, 'toPlayerId']) && isId(value.toPlayerId);
  if (value.kind === 'debit') return hasKeys(value, [...base, 'fromPlayerId']) && isId(value.fromPlayerId);
  return value.kind === 'transfer' && hasKeys(value, [...base, 'fromPlayerId', 'toPlayerId']) &&
    isId(value.fromPlayerId) && isId(value.toPlayerId) && value.fromPlayerId !== value.toPlayerId;
}
export function isAccount(value: unknown): value is AccountBalance {
  return isRecord(value) && hasKeys(value, ['playerId', 'balanceUnits']) && isId(value.playerId) && isInteger(value.balanceUnits);
}
export function isEconomy(value: unknown): value is EconomyState {
  if (!isRecord(value) || !hasKeys(value, ['schemaVersion', 'unit', 'negativeBalancePolicy', 'accounts', 'transactionIds']) ||
      value.schemaVersion !== 1 || !isMoneyUnit(value.unit) ||
      !isKnowledge(value.negativeBalancePolicy, (v): v is 'allow-negative' | 'reject-negative' => v === 'allow-negative' || v === 'reject-negative') ||
      !isArrayOf(value.accounts, isAccount) || !unique(value.accounts.map((a) => a.playerId)) ||
      !isArrayOf(value.transactionIds, isId) || !unique(value.transactionIds)) return false;
  const policy = value.negativeBalancePolicy;
  return value.accounts.every((account) => account.balanceUnits >= 0 || policy.value === 'allow-negative');
}
/** Sole balance initialization authority; caller must supply verified starting units and policy. */
export function openEconomy(unit: MoneyUnit, playerIds: readonly string[], startingUnits: number,
  policy: EconomyState['negativeBalancePolicy']): EconomyResult {
  if (!isMoneyUnit(unit) || !isArrayOf(playerIds, isId) || !unique(playerIds) || !isInteger(startingUnits) ||
      !isKnowledge(policy, (v): v is 'allow-negative' | 'reject-negative' => v === 'allow-negative' || v === 'reject-negative')) return { ok: false, error: 'INVALID_TRANSACTION' };
  const economy: EconomyState = { schemaVersion: 1, unit: { ...unit }, negativeBalancePolicy: policy,
    accounts: playerIds.map((playerId) => ({ playerId, balanceUnits: startingUnits })), transactionIds: [] };
  return isEconomy(economy) ? { ok: true, economy } : { ok: false,
    error: startingUnits < 0 && policy.status === 'unknown' ? 'NEGATIVE_BALANCE_POLICY_UNKNOWN' : 'INVALID_TRANSACTION' };
}
/** Does not round, tax, pay salary, or choose a debt policy. External credit/debit changes total units; transfers conserve them. */
export function postTransaction(economy: EconomyState, transaction: Transaction, actor: Actor): EconomyResult {
  if (!isEconomy(economy) || !isTransaction(transaction) || !isActor(actor)) return { ok: false, error: 'INVALID_TRANSACTION' };
  if (economy.transactionIds.includes(transaction.id)) return { ok: false, error: 'DUPLICATE_TRANSACTION' };
  if (actor.kind !== transaction.origin.kind || (actor.kind === 'player' &&
      (transaction.origin.kind !== 'player' || actor.playerId !== transaction.origin.playerId)) ||
      (actor.kind === 'player' && (transaction.kind === 'credit' || transaction.fromPlayerId !== actor.playerId))) {
    return { ok: false, error: 'ORIGIN_MISMATCH' };
  }
  const from = transaction.kind === 'credit' ? null : transaction.fromPlayerId;
  const to = transaction.kind === 'debit' ? null : transaction.toPlayerId;
  if ([from, to].some((id) => id !== null && !economy.accounts.some((account) => account.playerId === id))) return { ok: false, error: 'UNKNOWN_ACCOUNT' };
  const accounts: AccountBalance[] = [];
  for (const account of economy.accounts) {
    const balanceUnits = account.balanceUnits + (account.playerId === to ? transaction.amountUnits :
      account.playerId === from ? -transaction.amountUnits : 0);
    if (!Number.isSafeInteger(balanceUnits)) return { ok: false, error: 'MONEY_OVERFLOW' };
    if (balanceUnits < 0 && account.playerId === from) {
      if (economy.negativeBalancePolicy.status === 'unknown') return { ok: false, error: 'NEGATIVE_BALANCE_POLICY_UNKNOWN' };
      if (economy.negativeBalancePolicy.value === 'reject-negative') return { ok: false, error: 'INSUFFICIENT_FUNDS' };
    }
    accounts.push({ ...account, balanceUnits });
  }
  return { ok: true, economy: { ...economy, accounts, transactionIds: [...economy.transactionIds, transaction.id] } };
}
