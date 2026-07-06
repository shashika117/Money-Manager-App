// src/hooks/useGoalActivity.ts
//
// THE core Goals data hook. Fetches the ENTIRE fact_goal table once
// (~7,500 rows max over 30 years — trivial) and derives everything
// client-side: per-goal balances, the month→date grouped savings table,
// per-goal chart series, and 3-month allocation averages.
//
// Every other Goals read hook selects from THIS one cache. No per-goal
// or per-month round trips. Mirrors the useTransactions pattern.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── Raw row ────────────────────────────────────────────────────────
export interface GoalActivityRow {
  id:                    string
  date:                  string   // 'YYYY-MM-DD'
  goal:                  string
  ex_sub_category:       'Monthly Allocation' | 'Sinking Funds' | 'Funds Transfer' | string
  master_account:        string | null
  singed_amount:         number
  note:                  string | null
  user_id:               string
  created_at:            string
  transfer_group_id:     string | null
  source_transaction_id: string | null
}

// ── Record kind (derived, for display routing) ─────────────────────
export type GoalRecordKind = 'allocation' | 'sinking_fund' | 'funds_transfer'

export interface GoalActivityRecord extends GoalActivityRow {
  kind:         GoalRecordKind
  is_linked:    boolean   // allocation created by a linked-account transfer
}

function classify(row: GoalActivityRow): GoalActivityRecord {
  let kind: GoalRecordKind
  if (row.ex_sub_category === 'Monthly Allocation')      kind = 'allocation'
  else if (row.ex_sub_category === 'Funds Transfer')     kind = 'funds_transfer'
  else                                                    kind = 'sinking_fund'
  // Linked allocation = an allocation carrying a transfer_group_id
  // (created alongside a Transfer into a goal-linked account).
  const is_linked = kind === 'allocation' && row.transfer_group_id != null
  return { ...row, kind, is_linked }
}

// ── Hook ────────────────────────────────────────────────────────────
export function useGoalActivity() {
  return useQuery<GoalActivityRecord[]>({
    queryKey: ['goal_activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fact_goal')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as GoalActivityRow[]).map(classify)
    },
    staleTime: 1000 * 60,
  })
}

// ════════════════════════════════════════════════════════════════
// DERIVATION HELPERS (pure — call inside useMemo in consumers)
// ════════════════════════════════════════════════════════════════

// ── Current balance per goal = sum of ALL its rows ──────────────────
export function computeGoalBalances(rows: GoalActivityRecord[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) {
    m.set(r.goal, (m.get(r.goal) ?? 0) + r.singed_amount)
  }
  return m
}

// ── 3-month allocation average (fixed window: the 3 calendar months
//    immediately before the current month), per goal ────────────────
export function computeThreeMonthAllocAverage(
  rows: GoalActivityRecord[],
  goalName: string,
  now: Date = new Date(),
): number {
  // Window = [start of (currentMonth-3), start of currentMonth)
  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const windowStart   = new Date(now.getFullYear(), now.getMonth() - 3, 1)

  let sum = 0
  for (const r of rows) {
    if (r.goal !== goalName) continue
    if (r.kind !== 'allocation') continue
    const d = new Date(r.date + 'T00:00:00')
    if (d >= windowStart && d < curMonthStart) sum += r.singed_amount
  }
  return sum / 3
}

// ── Running cumulative balance series for a goal's chart ────────────
// Returns points of { period_date, balance } sampled at MONTH ends,
// as a running total of the goal's rows in chronological order.
export interface GoalChartPoint { period_date: string; balance: number }

export function computeGoalChartSeries(
  rows: GoalActivityRecord[],
  goalName: string,
): GoalChartPoint[] {
  const goalRows = rows
    .filter(r => r.goal === goalName)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))   // chronological

  if (goalRows.length === 0) return []

  // Bucket cumulative balance by month
  const monthly = new Map<string, number>()   // 'YYYY-MM-01' → running balance
  let running = 0
  for (const r of goalRows) {
    running += r.singed_amount
    const d = new Date(r.date + 'T00:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    monthly.set(key, running)   // last write in a month wins → month-end balance
  }

  // Fill gaps: every month from first to current carries forward the
  // previous running balance so the line is continuous.
  const keys = Array.from(monthly.keys()).sort()
  const first = new Date(keys[0] + 'T00:00:00')
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), 1)

  const out: GoalChartPoint[] = []
  let carry = 0
  const cursor = new Date(first.getFullYear(), first.getMonth(), 1)
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`
    if (monthly.has(key)) carry = monthly.get(key)!
    out.push({ period_date: key, balance: carry })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return out
}

// ── Slice a chart series to a period (3M / 6M / 12M / ALL) ──────────
export type GoalChartPeriod = '3M' | '6M' | '12M' | 'ALL'
export function sliceChartPeriod(series: GoalChartPoint[], period: GoalChartPeriod): GoalChartPoint[] {
  if (period === 'ALL' || series.length === 0) return series
  const months = period === '3M' ? 3 : period === '6M' ? 6 : 12
  return series.slice(Math.max(0, series.length - months - 1))
}