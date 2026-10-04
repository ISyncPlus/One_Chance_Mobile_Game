import assert from 'node:assert/strict';
import test from 'node:test';
import { isEconomy, isTransaction, openEconomy, postTransaction } from '../src/game/economy/transactions.ts';
import { known, unknown, freeze, copy, player, system, transaction } from './fixtures/artificial-domain.mjs';
const unit = { currencyCode: 'TEST', unitLabel: 'synthetic-unit', unitsPerMajor: 100 };
const ids = ['fixture-player-1', 'fixture-player-2'];
const ledger = (balance = 1000, policy = known('reject-negative')) => openEconomy(unit, ids, balance, policy).economy;
const total = (state) => state.accounts.reduce((sum, account) => sum + BigInt(account.balanceUnits), 0n);

test('central economy credits and debits system-originated units with identity and reason', () => {
  const state = freeze(ledger()); const before = copy(state);
  const credit = transaction('credit', { toPlayerId: ids[0] }); const credited = postTransaction(state, credit, system);
  assert.equal(credited.ok, true); assert.equal(credited.economy.accounts[0].balanceUnits, 1100); assert.equal(total(credited.economy), total(state) + 100n);
  const debit = transaction('debit', { fromPlayerId: ids[1] }, system, 'fixture-debit'); const debited = postTransaction(credited.economy, debit, system);
  assert.equal(debited.ok, true); assert.equal(total(debited.economy), total(state)); assert.deepEqual(state, before);
  assert.deepEqual(debited.economy.transactionIds, ['fixture-transaction', 'fixture-debit']);
});
test('player-originated transfer conserves exact integer units and is immutable', () => {
  const state = freeze(ledger()); const before = copy(state); const actor = player(ids[0]);
  const transfer = freeze(transaction('transfer', { fromPlayerId: ids[0], toPlayerId: ids[1], amountUnits: 333 }, actor));
  const result = postTransaction(state, transfer, actor); assert.equal(result.ok, true);
  assert.deepEqual(result.economy.accounts.map((a) => a.balanceUnits), [667, 1333]); assert.equal(total(result.economy), total(state)); assert.deepEqual(state, before);
  const debit = postTransaction(state, transaction('debit', { fromPlayerId: ids[0] }, actor, 'fixture-player-debit'), actor);
  assert.equal(debit.ok, true); assert.equal(debit.economy.accounts[0].balanceUnits, 900);
});
test('origin/account/duplicate failures cannot mutate the ledger', () => {
  const state = freeze(ledger()); const before = copy(state);
  const inputs = [
    [transaction('credit', { toPlayerId: 'absent' }), system, 'UNKNOWN_ACCOUNT'],
    [transaction('transfer', { fromPlayerId: ids[1], toPlayerId: ids[0] }, player()), player(), 'ORIGIN_MISMATCH'],
    [transaction('credit', { toPlayerId: ids[0] }, player()), player(), 'ORIGIN_MISMATCH'],
    [transaction('debit', { fromPlayerId: ids[0] }), player(), 'ORIGIN_MISMATCH'],
    [transaction('transfer', { fromPlayerId: ids[0], toPlayerId: ids[0] }), system, 'INVALID_TRANSACTION'],
  ];
  for (const [input, actor, error] of inputs) assert.deepEqual(postTransaction(state, input, actor), { ok: false, error });
  const input = transaction('credit', { toPlayerId: ids[0] }); const first = postTransaction(state, input, system);
  assert.deepEqual(postTransaction(first.economy, input, system), { ok: false, error: 'DUPLICATE_TRANSACTION' }); assert.deepEqual(state, before);
});
test('money is positive safe-integer units for transactions, without rounding or silent no-ops', () => {
  for (const amountUnits of [0, -0, -1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '100']) {
    const input = transaction('credit', { toPlayerId: ids[0], amountUnits }); assert.equal(isTransaction(input), false);
    assert.deepEqual(postTransaction(ledger(), input, system), { ok: false, error: 'INVALID_TRANSACTION' });
  }
  assert.equal(isTransaction(transaction('credit', { toPlayerId: ids[0], amountUnits: Number.MAX_SAFE_INTEGER })), true);
  assert.equal(openEconomy(unit, ids, 0.1, known('reject-negative')).ok, false);
  assert.equal(openEconomy(unit, [ids[0], ids[0]], 1, unknown()).ok, false);
  assert.equal(openEconomy(unit, [ids[0], , ids[1]], 1, unknown()).ok, false);
});
test('safe integer overflow rejects credit and transfer atomically', () => {
  const state = freeze(ledger(Number.MAX_SAFE_INTEGER));
  for (const input of [transaction('credit', { toPlayerId: ids[0] }), transaction('transfer', { fromPlayerId: ids[0], toPlayerId: ids[1] })]) assert.deepEqual(postTransaction(state, input, system), { ok: false, error: 'MONEY_OVERFLOW' });
});
test('unknown negative-balance policy remains unavailable at the boundary; no guessed debt policy', () => {
  const state = freeze(ledger(50, unknown())); const debit = transaction('debit', { fromPlayerId: ids[0] });
  assert.deepEqual(postTransaction(state, debit, system), { ok: false, error: 'NEGATIVE_BALANCE_POLICY_UNKNOWN' });
  assert.equal(postTransaction(state, { ...debit, amountUnits: 50 }, system).ok, true);
  assert.deepEqual(postTransaction(ledger(50), debit, system), { ok: false, error: 'INSUFFICIENT_FUNDS' });
  const allowed = postTransaction(ledger(50, known('allow-negative')), debit, system); assert.equal(allowed.economy.accounts[0].balanceUnits, -50);
  assert.equal(openEconomy(unit, ids, -1, unknown()).error, 'NEGATIVE_BALANCE_POLICY_UNKNOWN');
  assert.equal(openEconomy(unit, ids, -1, known('allow-negative')).ok, true);
  assert.equal(isEconomy({ ...state, accounts: [{ playerId: ids[0], balanceUnits: -1 }] }), false);
});
