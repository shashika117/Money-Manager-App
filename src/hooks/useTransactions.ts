import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── Raw Supabase response shape ────────────────────────────────────
interface RawTransaction {
  id:                string
  date:              string
  master_account:    string
  ex_sub_category:   string
  singed_amount:     number
  note:              string | null
  goal:              string | null
  user_id:           string
  transfer_group_id: string | null
  created_at:        string
  updated_at:        string
  dim_sub_category: {
    category:         string
    group_name:       string
    type:             string
    rollover_enabled: boolean
  } | null
}

// ── Fully enriched transaction (used throughout the UI) ────────────
export interface Transaction {
  id:                string
  date:              string
  master_account:    string
  ex_sub_category:   string
  singed_amount:     number
  note:              string | null
  goal:              string | null
  user_id:           string
  transfer_group_id: string | null
  created_at:        string
  updated_at:        string
  // From dim_sub_category
  category:         string
  group_name:       string
  txn_type:         'Expense' | 'Income' | 'Transfer'
  rollover_enabled: boolean
  // Derived for display
  display_category:    string   // "Transfer Out" / "Transfer In" / "Loan Payment" / category name
  display_subcategory: string   // '' for Income / Transfer / Sinking Funds
  amount_color:        'green' | 'red' | 'gray'
  is_transfer:         boolean  // Transfer In or Transfer Out rows
  is_transfer_fee:     boolean  // Fees & Taxes row inside a transfer group
  is_income:           boolean
  is_sinking_funds:    boolean
  is_loan_payment:     boolean  // synthetic merged row (capital + interest + liability leg)
}

// ── Date group (for rendering) ─────────────────────────────────────
export interface DateGroup {
  date:          string   // 'YYYY-MM-DD'
  day_name:      string   // 'Thu'
  day_of_month:  string   // '11'
  month_year:    string   // 'Jun 2026'
  total_income:  number
  total_expense: number
  transactions:  Transaction[]
}

// ── Transform a raw DB row into a display-ready Transaction ─────────
function transform(raw: RawTransaction): Transaction {
  const sc       = raw.dim_sub_category
  const txnType  = (sc?.type ?? 'Expense') as 'Expense' | 'Income' | 'Transfer'
  const category = sc?.category ?? raw.ex_sub_category

  const isIncome       = txnType === 'Income'
  const isTransfer     = txnType === 'Transfer'
  const isSinkingFunds = txnType === 'Expense' && category === 'Sinking Funds'
  // Fee row = Fees & Taxes that belongs to a transfer group (not a standalone expense)
  const isTransferFee  = !!raw.transfer_group_id && raw.ex_sub_category === 'Fees & Taxes'

  let display_category:    string
  let display_subcategory: string
  let amount_color:        'green' | 'red' | 'gray'

  if (isTransfer) {
    display_category    = raw.singed_amount < 0 ? 'Transfer Out' : 'Transfer In'
    display_subcategory = ''
    amount_color        = 'gray'
  } else if (isTransferFee) {
    display_category    = 'Other'
    display_subcategory = 'Fees & Taxes'
    amount_color        = 'red'
  } else if (isIncome || isSinkingFunds) {
    display_category    = category
    display_subcategory = ''
    amount_color        = isIncome ? 'green' : 'red'
  } else {
    display_category    = category
    display_subcategory = raw.ex_sub_category !== category ? raw.ex_sub_category : ''
    amount_color        = 'red'
  }

  return {
    id:                raw.id,
    date:              raw.date,
    master_account:    raw.master_account,
    ex_sub_category:   raw.ex_sub_category,
    singed_amount:     raw.singed_amount,
    note:              raw.note,
    goal:              raw.goal,
    user_id:           raw.user_id,
    transfer_group_id: raw.transfer_group_id,
    created_at:        raw.created_at,
    updated_at:        raw.updated_at,
    category,
    group_name:        sc?.group_name       ?? '',
    txn_type:          txnType,
    rollover_enabled:  sc?.rollover_enabled ?? false,
    display_category,
    display_subcategory,
    amount_color,
    is_transfer:       isTransfer || isTransferFee,
    is_transfer_fee:   isTransferFee,
    is_income:         isIncome,
    is_sinking_funds:  isSinkingFunds,
    is_loan_payment:   false,   // set true by flagLoanPaymentRows() / mergeLoanPayments() below
  }
}

// ════════════════════════════════════════════════════════════════
// Loan payment merge — PRESENTATION-LAYER UTILITY. NOT called inside
// this hook. useTransactions() must always return the true, unmerged
// rows, because every category/subCategory-filtered consumer (e.g. the
// Budget page's per-subcategory calendar drill-down) needs to isolate
// the exact amount for ONE subcategory — merging here would corrupt
// that (a "Loan Capital" filter would catch the merged total including
// interest; a "Loan Interest" filter would find nothing, since the
// interest row got absorbed into the merged row labelled Loan Capital).
//
// Call this ONLY in the general "browse everything" list view
// (TransactionTableWidget), and ONLY when no category/subCategory
// filter is currently narrowing the data. See TransactionTableWidget.tsx.
//
// A loan payment writes 2-3 raw rows sharing one transfer_group_id:
//   'Loan Capital'  (Expense)
//   'Loan Interest' (Expense, only if interest > 0)
//   'Transfer'      (the liability-reduction leg, positive amount)
//
// Cost: O(n) over an already-fetched, already month-bounded array
// (~20-50 rows for a typical month) — no extra database round trip.
// ════════════════════════════════════════════════════════════════
export function mergeLoanPayments(txns: Transaction[]): Transaction[] {
  // Group rows by transfer_group_id (only those that have one)
  const byGroup = new Map<string, Transaction[]>()
  for (const t of txns) {
    if (!t.transfer_group_id) continue
    if (!byGroup.has(t.transfer_group_id)) byGroup.set(t.transfer_group_id, [])
    byGroup.get(t.transfer_group_id)!.push(t)
  }

  // Identify which groups are loan payments (contain Loan Capital or Loan Interest)
  const loanGroupIds = new Set<string>()
  for (const [gid, rows] of byGroup) {
    if (rows.some(r => r.ex_sub_category === 'Loan Capital' || r.ex_sub_category === 'Loan Interest')) {
      loanGroupIds.add(gid)
    }
  }
  if (loanGroupIds.size === 0) return txns   // fast path — nothing to merge

  const result: Transaction[] = []
  const consumed = new Set<string>()

  for (const t of txns) {
    const gid = t.transfer_group_id
    if (gid && loanGroupIds.has(gid)) {
      if (consumed.has(gid)) continue   // this group's merged row already emitted
      consumed.add(gid)

      const rows         = byGroup.get(gid)!
      const capitalRow   = rows.find(r => r.ex_sub_category === 'Loan Capital')
      const interestRow  = rows.find(r => r.ex_sub_category === 'Loan Interest')
      const liabilityRow = rows.find(r => r.txn_type === 'Transfer')

      const capitalAmt  = Math.abs(capitalRow?.singed_amount ?? 0)
      const interestAmt = Math.abs(interestRow?.singed_amount ?? 0)
      const base        = capitalRow ?? rows[0]

      result.push({
        ...base,
        id:                   base.id,                              // keyed off the capital row
        master_account:       base.master_account,                  // paying account
        singed_amount:        -(capitalAmt + interestAmt),
        display_category:     'Loan Payment',
        display_subcategory:  liabilityRow?.master_account ?? '',   // e.g. "BOC Loan"
        amount_color:         'red',
        is_transfer:          false,
        is_transfer_fee:      false,
        is_income:            false,
        is_sinking_funds:     false,
        is_loan_payment:      true,
      })
      continue
    }
    result.push(t)
  }
  return result
}

// ── Group transactions by date into DateGroup[] ─────────────────────
// The input array is already ordered: date DESC, updated_at DESC from Supabase.
// Map preserves insertion order → groups appear newest first.
function groupByDate(transactions: Transaction[]): DateGroup[] {
  const map = new Map<string, Transaction[]>()

  for (const txn of transactions) {
    if (!map.has(txn.date)) map.set(txn.date, [])
    map.get(txn.date)!.push(txn)
  }

  return Array.from(map.entries()).map(([date, txns]) => {
    const d = new Date(date + 'T00:00:00')

    const total_income = txns
      .filter(t => t.txn_type === 'Income')
      .reduce((s, t) => s + t.singed_amount, 0)
    const total_expense = txns
      .filter(t => t.txn_type === 'Expense')
      .reduce((s, t) => s + Math.abs(t.singed_amount), 0)

    return {
      date,
      day_name:     d.toLocaleDateString('en-US', { weekday: 'short' }),
      day_of_month: String(d.getDate()),
      month_year:   d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      total_income,
      total_expense,
      // Raw, unmerged rows — see mergeLoanPayments doc comment above
      // for exactly where/when to merge for display.
      transactions: txns,
    }
  })
}

// ── Hook ────────────────────────────────────────────────────────────
const SELECT = `
  id, date, master_account, ex_sub_category,
  singed_amount, note, goal, user_id,
  transfer_group_id, created_at, updated_at,
  dim_sub_category ( category, group_name, type, rollover_enabled )
`

export function useTransactions(
  year:        number,
  month:       number,
  noteSearch?: string,         // when set (3+ chars), searches ALL history
) {
  const search       = noteSearch?.trim() ?? ''
  const isSearchMode  = search.length >= 3

  // 1. Manually construct the start date
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  
  // 2. Get the last day of the month using local time, avoiding UTC shifts
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  
//  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
//  const endDate   = new Date(year, month, 0).toISOString().slice(0, 10)


  return useQuery<DateGroup[]>({
    queryKey: isSearchMode
      ? ['transactions_search', search]
      : ['transactions', year, month],

    queryFn: async () => {
      let query = supabase.from('fact_transaction').select(SELECT)

      if (isSearchMode) {
        // Uses idx_ft_note_trgm — O(log n) regardless of table size.
        query = query
          .ilike('note', `%${search}%`)
          .order('date',       { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(500)
      } else {
        // Month view — uses idx_ft_date. Returns ONLY this month's rows
        // regardless of total table size (200K rows or 2K — same cost).
        query = query
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date',       { ascending: false })
          .order('updated_at', { ascending: false })
      }

      const { data, error } = await query
      if (error) throw error

      const transformed = (data as RawTransaction[]).map(transform)
      const flagged     = flagLoanPaymentRows(transformed)
      return groupByDate(flagged)
    },
    staleTime: 1000 * 60,
  })
}

// ════════════════════════════════════════════════════════════════
// flagLoanPaymentRows — set is_loan_payment=true on EVERY raw row that
// belongs to a loan-payment group (capital, interest, AND the liability
// Transfer leg), WITHOUT merging them.
//
// Why this is separate from mergeLoanPayments():
//   • Detection must work in ALL views (filtered or not), so the detail
//     panel and account-filtered list can recognise a loan-payment row
//     even when the merge has NOT run.
//   • This pass keeps the rows individual (so subcategory drill-downs
//     still see the true per-row amounts) — it only sets a boolean.
//
// A group is a loan payment iff it contains a 'Loan Capital' row.
// Cost: O(n) over the already month-bounded array.
// ════════════════════════════════════════════════════════════════
function flagLoanPaymentRows(txns: Transaction[]): Transaction[] {
  // Which transfer groups are loan payments?
  const loanGroupIds = new Set<string>()
  for (const t of txns) {
    if (t.transfer_group_id && t.ex_sub_category === 'Loan Capital') {
      loanGroupIds.add(t.transfer_group_id)
    }
  }
  if (loanGroupIds.size === 0) return txns

  return txns.map(t =>
    t.transfer_group_id && loanGroupIds.has(t.transfer_group_id)
      ? {
          ...t,
          is_loan_payment: true,
          // The liability 'Transfer' leg must NOT be treated as a normal
          // transfer anywhere — clear its transfer flags so the detail
          // panel never routes it through the transfer reconstruction.
          is_transfer:     false,
          is_transfer_fee: false,
        }
      : t,
  )
}