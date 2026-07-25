// src/lib/queryInvalidation.ts
//
// Every mutation that touches fact_transaction, fact_goal, or dim_goal
// can ripple into a lot of screens: the transaction list, account
// balances, net worth, the budget table, every Analytics view, and the
// Goals page. Previously each mutation hook hand-maintained its own
// invalidation list, and those lists drifted out of sync as new
// features (Analytics, enriched Goals, Budget) were added — some
// screens invalidated correctly, others silently didn't, which is why
// some UI elements updated instantly while others needed a manual
// refresh.
//
// Fix: ONE canonical list per "what changed", used by every mutation
// that can plausibly cause that change. invalidateQueries is cheap for
// keys that aren't currently mounted (it just marks them stale — no
// network call happens until they're next used), so it's safe to be
// generous here rather than precisely minimal per mutation.

import type { QueryClient } from '@tanstack/react-query'

// Anything that can be affected by a write to fact_transaction:
// adding/editing/deleting an Expense, Income, Transfer, or Loan
// Payment. Included even for plain Expenses/Income (which don't touch
// goals) because Sinking Funds expenses and goal-linked-account
// Transfers both write through these same mutation hooks.
// Anything derived directly from dim_account.current_balance. A write
// to fact_transaction changes these; so does a manual balance
// recalculation (recalculate_account_balances) — which has nothing to
// do with transactions, goals, or budget otherwise. Kept as its own
// list, spread into TRANSACTION_RELATED_KEYS below, so a new
// balance-derived query only ever needs to be added HERE — both
// useRecalculateBalances and every transaction mutation pick it up
// automatically.
export const BALANCE_RELATED_KEYS: string[][] = [
  ['account_balances'],
  ['net_worth'],
  ['net_worth_history'],
]

export const TRANSACTION_RELATED_KEYS: string[][] = [
  ['transactions'],
  ['transactions_search'],
  ...BALANCE_RELATED_KEYS,
  ['monthly_cashflow'],
  ['budget_table'],
  ['budget_summary'],
  ['subcat_history'],
  ['analytics_breakdown'],
  ['analytics_daily'],
  ['analytics_history'],
  ['goals'],
  ['goals_all'],
  ['goal_activity'],
  ['total_left_to_save'],
  ['monthly_left_to_save'],
]

// Anything that can be affected by a write to fact_goal: a Monthly
// Allocation, a goal-to-goal funds transfer, or deleting either.
// Doesn't touch fact_transaction directly, so 'transactions' /
// 'account_balances' / 'net_worth' are intentionally left out — but it
// DOES feed the Analytics "Save" group and the Budget page.
export const GOAL_ACTIVITY_RELATED_KEYS: string[][] = [
  ['goal_activity'],
  ['goals'],
  ['goals_all'],
  ['total_left_to_save'],
  ['monthly_left_to_save'],
  ['subcat_history'],
  ['budget_table'],
  ['budget_summary'],
  ['analytics_breakdown'],
  ['analytics_daily'],
  ['analytics_history'],
]

// dim_goal CRUD (create/edit/reorder a goal itself) — doesn't move any
// money, so this is a much smaller blast radius than the two above.
export const GOAL_DEFINITION_RELATED_KEYS: string[][] = [
  ['goals'],
  ['goals_all'],
]

// Budget-table cell edits and goal-budget cell edits.
export const BUDGET_RELATED_KEYS: string[][] = [
  ['budget_table'],
  ['budget_summary'],
  ['goal_budget_data'],
]

function invalidate(qc: QueryClient, keys: string[][]) {
  keys.forEach(k => qc.invalidateQueries({ queryKey: k }))
}

export function invalidateTransactionRelated(qc: QueryClient) {
  invalidate(qc, TRANSACTION_RELATED_KEYS)
}
export function invalidateGoalActivityRelated(qc: QueryClient) {
  invalidate(qc, GOAL_ACTIVITY_RELATED_KEYS)
}
export function invalidateGoalDefinitionRelated(qc: QueryClient) {
  invalidate(qc, GOAL_DEFINITION_RELATED_KEYS)
}
export function invalidateBudgetRelated(qc: QueryClient) {
  invalidate(qc, BUDGET_RELATED_KEYS)
}
export function invalidateBalanceRelated(qc: QueryClient) {
  invalidate(qc, BALANCE_RELATED_KEYS)
}