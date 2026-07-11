// src/hooks/useAnalyticsHistory.ts
//
// The Analytics history table feed. Fetches the period's fact_transaction
// rows (+ Monthly-Allocation rows for the spend tab) ONCE, then filters
// purely client-side as the donut/column/month selection changes — so
// clicking a slice never triggers a refetch.
//
// Output matches useTransactions: DateGroup[] of enriched Transaction rows,
// so it drops straight into the existing TransactionTable. Monthly
// Allocation rows carry an `alloc` marker so Step 4 can route their taps
// (manual → allocation panel, linked → transfer detail) exactly like the
// Goal Savings Table.
//
// Loan merge policy (confirmed): merge the 2-3 loan rows into one
// "Loan Payment" row ONLY when nothing is isolating a category/subcategory
// (i.e. a total scope). Under a group/category/subcategory selection we
// keep the raw rows so Loan Capital / Loan Interest isolate correctly.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  mergeLoanPayments,
  type Transaction,
  type DateGroup,
} from '@/hooks/useTransactions'
import { type AnalyticsTab, isTotalScope } from '@/lib/analyticsScope'

// ── Row + group types (superset of Transaction; TransactionTable ignores extras) ──
export interface AnalyticsRow extends Transaction {
  alloc?: {
    manual: boolean          // true → manual Monthly Allocation (open allocation panel)
    month:  string           // 'YYYY-MM-01'
    goal:   string
    amount: number
    note:   string | null
  }
}
export interface AnalyticsDateGroup extends Omit<DateGroup, 'transactions'> {
  transactions: AnalyticsRow[]
}

// ── Raw shapes ──────────────────────────────────────────────────────
interface RawTxn {
  id: string; date: string; master_account: string; ex_sub_category: string
  singed_amount: number; note: string | null; goal: string | null; user_id: string
  transfer_group_id: string | null; created_at: string; updated_at: string
  dim_sub_category: { category: string; group_name: string; type: string; rollover_enabled: boolean } | null
}
interface RawAlloc {
  id: string; date: string; goal: string; ex_sub_category: string
  master_account: string | null; singed_amount: number; note: string | null
  user_id: string; created_at: string; transfer_group_id: string | null
  source_transaction_id: string | null
}

const TXN_SELECT = `
  id, date, master_account, ex_sub_category,
  singed_amount, note, goal, user_id,
  transfer_group_id, created_at, updated_at,
  dim_sub_category ( category, group_name, type, rollover_enabled )
`
const ALLOC_SELECT = `
  id, date, goal, ex_sub_category, master_account,
  singed_amount, note, user_id, created_at,
  transfer_group_id, source_transaction_id
`

// ── transform — mirrors useTransactions.transform() exactly ─────────
function transform(raw: RawTxn): Transaction {
  const sc       = raw.dim_sub_category
  const txnType  = (sc?.type ?? 'Expense') as 'Expense' | 'Income' | 'Transfer'
  const category = sc?.category ?? raw.ex_sub_category

  const isIncome       = txnType === 'Income'
  const isTransfer     = txnType === 'Transfer'
  const isSinkingFunds = txnType === 'Expense' && category === 'Sinking Funds'
  const isTransferFee  = !!raw.transfer_group_id && raw.ex_sub_category === 'Fees & Taxes'

  let display_category: string
  let display_subcategory: string
  let amount_color: 'green' | 'red' | 'gray'

  if (isTransfer) {
    display_category = raw.singed_amount < 0 ? 'Transfer Out' : 'Transfer In'
    display_subcategory = ''
    amount_color = 'gray'
  } else if (isTransferFee) {
    display_category = 'Other'; display_subcategory = 'Fees & Taxes'; amount_color = 'red'
  } else if (isIncome || isSinkingFunds) {
    display_category = category; display_subcategory = ''
    amount_color = isIncome ? 'green' : 'red'
  } else {
    display_category = category
    display_subcategory = raw.ex_sub_category !== category ? raw.ex_sub_category : ''
    amount_color = 'red'
  }

  return {
    id: raw.id, date: raw.date, master_account: raw.master_account,
    ex_sub_category: raw.ex_sub_category, singed_amount: raw.singed_amount,
    note: raw.note, goal: raw.goal, user_id: raw.user_id,
    transfer_group_id: raw.transfer_group_id, created_at: raw.created_at, updated_at: raw.updated_at,
    category, group_name: sc?.group_name ?? '', txn_type: txnType,
    rollover_enabled: sc?.rollover_enabled ?? false,
    display_category, display_subcategory, amount_color,
    is_transfer: isTransfer || isTransferFee, is_transfer_fee: isTransferFee,
    is_income: isIncome, is_sinking_funds: isSinkingFunds, is_loan_payment: false,
  }
}

// ── flag loan-payment rows — mirrors useTransactions.flagLoanPaymentRows() ──
function flagLoan(txns: Transaction[]): Transaction[] {
  const loanGroups = new Set<string>()
  for (const t of txns) {
    if (t.transfer_group_id && t.ex_sub_category === 'Loan Capital') loanGroups.add(t.transfer_group_id)
  }
  if (loanGroups.size === 0) return txns
  return txns.map(t =>
    t.transfer_group_id && loanGroups.has(t.transfer_group_id)
      ? { ...t, is_loan_payment: true, is_transfer: false, is_transfer_fee: false }
      : t,
  )
}

// ── Monthly Allocation → enriched row ───────────────────────────────
function allocationToRow(rec: RawAlloc): AnalyticsRow {
  const isLinked = rec.transfer_group_id != null
  const base: Transaction = {
    id: rec.id, date: rec.date, master_account: rec.master_account ?? '',
    ex_sub_category: isLinked ? 'Transfer' : 'Monthly Allocation',
    singed_amount: rec.singed_amount, note: rec.note, goal: rec.goal, user_id: rec.user_id,
    transfer_group_id: rec.transfer_group_id, created_at: rec.created_at, updated_at: rec.created_at,
    category: 'Savings', group_name: 'Save',
    txn_type: isLinked ? 'Transfer' : 'Expense', rollover_enabled: false,
    display_category: rec.goal, display_subcategory: 'Monthly Allocation',
    amount_color: 'gray',
    is_transfer: isLinked,   // linked → detail panel reconstructs the transfer
    is_transfer_fee: false, is_income: false, is_sinking_funds: false, is_loan_payment: false,
  }
  return {
    ...base,
    alloc: {
      manual: !isLinked,
      month:  rec.date.slice(0, 7) + '-01',
      goal:   rec.goal,
      amount: Math.abs(rec.singed_amount),
      note:   rec.note,
    },
  }
}

// ── Group rows by date (newest first) ───────────────────────────────
function groupByDate(rows: AnalyticsRow[]): AnalyticsDateGroup[] {
  const map = new Map<string, AnalyticsRow[]>()
  for (const r of rows) {
    if (!map.has(r.date)) map.set(r.date, [])
    map.get(r.date)!.push(r)
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))   // date DESC
    .map(([date, txns]) => {
      const d = new Date(date + 'T00:00:00')
      const total_income  = txns.filter(t => t.txn_type === 'Income')
        .reduce((s, t) => s + t.singed_amount, 0)
      const total_expense = txns.filter(t => t.txn_type !== 'Income')
        .reduce((s, t) => s + Math.abs(t.singed_amount), 0)
      return {
        date,
        day_name:     d.toLocaleDateString('en-US', { weekday: 'short' }),
        day_of_month: String(d.getDate()),
        month_year:   d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        total_income, total_expense,
        transactions: txns,
      }
    })
}

// ── Scope filter → the rows the table should show ───────────────────
function buildGroups(
  txns: Transaction[],
  allocs: AnalyticsRow[],
  tab: AnalyticsTab,
  scope: string,
  key: string | null,
  monthFilter: string | null,     // 'YYYY-MM' or null
): AnalyticsDateGroup[] {
  let rows: AnalyticsRow[]

  if (tab === 'earn') {
    const income = txns.filter(t => t.txn_type === 'Income') as AnalyticsRow[]
    rows = scope === 'earn_category' ? income.filter(t => t.category === key) : income
  } else {
    // Merge loans only for total scopes (isolating a selection keeps raw rows).
    const source = isTotalScope(scope) ? (mergeLoanPayments(txns) as AnalyticsRow[]) : (txns as AnalyticsRow[])
    const expenses = source.filter(t =>
      t.txn_type === 'Expense' && (t.group_name === 'Needs' || t.group_name === 'Wants'),
    )
    switch (scope) {
      case 'spend_total_nws':  rows = [...expenses, ...allocs]; break
      case 'spend_total_cats': rows = expenses; break
      case 'group':
        rows = key === 'Save' ? allocs : expenses.filter(t => t.group_name === key)
        break
      case 'category':    rows = expenses.filter(t => t.category === key); break
      case 'subcategory': rows = expenses.filter(t => t.ex_sub_category === key); break
      default:            rows = [...expenses, ...allocs]
    }
  }

  if (monthFilter) rows = rows.filter(r => r.date.slice(0, 7) === monthFilter)

  // Order: date DESC, then updated_at DESC (mirrors the source query order).
  rows = [...rows].sort((a, b) =>
    a.date === b.date ? (a.updated_at < b.updated_at ? 1 : -1) : (a.date < b.date ? 1 : -1),
  )
  return groupByDate(rows)
}

// ════════════════════════════════════════════════════════════════════
// HOOK
// ════════════════════════════════════════════════════════════════════
export function useAnalyticsHistory(params: {
  tab:          AnalyticsTab
  start:        string          // 'YYYY-MM-01'
  endExclusive: string          // 'YYYY-MM-01'
  scope:        string
  key:          string | null
  monthFilter?: string | null   // 'YYYY-MM' (range month-card) or null
  enabled?:     boolean
}) {
  const { tab, start, endExclusive, scope, key, monthFilter = null, enabled = true } = params

  // Fetch the whole period ONCE (keyed only by tab + bounds). Selection and
  // month-card changes are handled by the client-side memo below.
  const dataQ = useQuery({
    queryKey: ['analytics_history', tab, start, endExclusive],
    queryFn: async () => {
      // NOTE: a Supabase query builder is a *thenable*, not a real Promise
      // (no .catch/.finally), so it can't be collected into a Promise[].
      // Wrap each call in an async fn and Promise.all the resulting
      // promises — still a single parallel round trip.
      const fetchTxns = async () => {
        const { data, error } = await supabase
          .from('fact_transaction')
          .select(TXN_SELECT)
          .gte('date', start)
          .lt('date', endExclusive)
          .order('date',       { ascending: false })
          .order('updated_at', { ascending: false })
        if (error) throw error
        return (data ?? []) as unknown as RawTxn[]
      }

      const fetchAllocs = async (): Promise<RawAlloc[]> => {
        if (tab !== 'spend') return []          // Earning tab has no allocations
        const { data, error } = await supabase
          .from('fact_goal')
          .select(ALLOC_SELECT)
          .eq('ex_sub_category', 'Monthly Allocation')
          .gte('date', start)
          .lt('date', endExclusive)
          .order('date', { ascending: false })
        if (error) throw error
        return (data ?? []) as unknown as RawAlloc[]
      }

      const [rawTxns, rawAllocs] = await Promise.all([fetchTxns(), fetchAllocs()])

      const txns   = flagLoan(rawTxns.map(transform))
      const allocs = rawAllocs.map(allocationToRow)
      return { txns, allocs }
    },
    enabled,
    staleTime: 1000 * 60,
  })

  const groups = useMemo<AnalyticsDateGroup[]>(() => {
    if (!dataQ.data) return []
    return buildGroups(dataQ.data.txns, dataQ.data.allocs, tab, scope, key, monthFilter)
  }, [dataQ.data, tab, scope, key, monthFilter])

  return { groups, isLoading: dataQ.isLoading, isError: dataQ.isError }
}