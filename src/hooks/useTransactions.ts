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
  display_category:    string   // "Transfer Out" / "Transfer In" / category name
  display_subcategory: string   // '' for Income / Transfer / Sinking Funds
  amount_color:        'green' | 'red' | 'gray'
  is_transfer:         boolean  // Transfer In or Transfer Out rows
  is_transfer_fee:     boolean  // Fees & Taxes row inside a transfer group
  is_income:           boolean
  is_sinking_funds:    boolean
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
    // subcategory = category for Income; Sinking Funds also shows category only
    display_category    = category
    display_subcategory = ''
    amount_color        = isIncome ? 'green' : 'red'
  } else {
    // Regular Expense
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
  }
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
    // Use local time to prevent UTC offset pushing date back one day
    const d = new Date(date + 'T00:00:00')

    return {
  date,
  day_name:     d.toLocaleDateString('en-US', { weekday: 'short' }),
  day_of_month: String(d.getDate()),
  month_year:   d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  total_income: txns
    .filter(t => t.txn_type === 'Income')
    .reduce((s, t) => s + t.singed_amount, 0),
  total_expense: txns
    .filter(t => t.txn_type === 'Expense')
    .reduce((s, t) => s + Math.abs(t.singed_amount), 0),
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

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = new Date(year, month, 0).toISOString().slice(0, 10)

  return useQuery<DateGroup[]>({
    // Separate cache key so search results never collide with month data
    queryKey: isSearchMode
      ? ['transactions_search', search]
      : ['transactions', year, month],

    queryFn: async () => {
      let query = supabase.from('fact_transaction').select(SELECT)

      if (isSearchMode) {
        // Uses idx_ft_note_trgm — O(log n) regardless of table size.
        // 500-row cap guards memory if a keyword matches thousands of rows.
        query = query
          .ilike('note', `%${search}%`)
          .order('date',       { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(500)
      } else {
        // Month view — uses idx_ft_date.
        query = query
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date',       { ascending: false })
          .order('updated_at', { ascending: false })
      }

      const { data, error } = await query
      if (error) throw error

      const transformed = (data as RawTransaction[]).map(transform)
      return groupByDate(transformed)
    },
    staleTime: 1000 * 60,
  })
}
