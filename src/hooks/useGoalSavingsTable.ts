// src/hooks/useGoalSavingsTable.ts
//
// Builds the Goal Savings Table's month→date grouped structure for a
// given 4-month window, from the useGoalActivity cache + per-month
// left-to-save figures from v_left_for_savings.
//
// Structure per spec:
//   MonthSection
//     ├─ allocations[]         (Monthly Allocation rows — shown WITHOUT dates,
//     │                          outside date groups)
//     └─ dateGroups[]          (each = a date with sinking-fund + funds-transfer rows)
//
// A month with only allocations has NO date groups.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  useGoalActivity,
  type GoalActivityRecord,
} from '@/hooks/useGoalActivity'

// ── View row for the 4-month window's left-to-save ─────────────────
interface LeftRow { month: string; left_for_savings: number }

// ── Output shapes ───────────────────────────────────────────────────
export interface GoalDateGroup {
  date:         string   // 'YYYY-MM-DD'
  day_name:     string   // 'Thu'
  day_of_month: string   // '11'
  month_year:   string   // 'Jun 2026'
  records:      GoalActivityRecord[]   // sinking_fund + funds_transfer only
}

export interface GoalMonthSection {
  month:            string   // 'YYYY-MM-01'
  month_label:      string   // 'June 2026'
  allocations:      GoalActivityRecord[]         // Monthly Allocation rows (dateless display)
  dateGroups:       GoalDateGroup[]
  total_allocated:  number   // sum of Monthly Allocation singed_amount
  total_sinking:    number   // sum of Sinking Funds singed_amount (negative)
  left_to_save:     number   // from v_left_for_savings for this month
}

// ── 4-month window helper ──────────────────────────────────────────
// Given an anchor (year, month 1-12), returns the 4 months of the slot
// it belongs to: Jan-Apr, May-Aug, or Sep-Dec.
export function fourMonthSlot(year: number, month1to12: number): string[] {
  const slotStartMonth =
    month1to12 <= 4 ? 1 : month1to12 <= 8 ? 5 : 9
  return [0, 1, 2, 3].map(i => {
    const m = slotStartMonth + i
    return `${year}-${String(m).padStart(2, '0')}-01`
  })
}

export function slotLabel(year: number, month1to12: number): string {
  const s = month1to12 <= 4 ? 'Jan – Apr' : month1to12 <= 8 ? 'May – Aug' : 'Sep – Dec'
  return `${s} ${year}`
}

// ── Left-to-save for the window (date-bounded read of the view) ────
function useMonthlyLeftToSave(monthKeys: string[]) {
  const first = monthKeys[0]
  const last  = monthKeys[monthKeys.length - 1]
  return useQuery<Map<string, number>>({
    queryKey: ['monthly_left_to_save', first, last],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_left_for_savings')
        .select('month, left_for_savings')
        .gte('month', first)
        .lte('month', last)
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of (data as LeftRow[])) {
        // normalise the month key to 'YYYY-MM-01'
        const key = r.month.slice(0, 7) + '-01'
        m.set(key, Number(r.left_for_savings))
      }
      return m
    },
    staleTime: 1000 * 30,
  })
}

// ── Build sections from activity + left map ────────────────────────
function buildSections(
  activity: GoalActivityRecord[],
  monthKeys: string[],
  leftMap: Map<string, number>,
): GoalMonthSection[] {
  return monthKeys.map(monthKey => {
    const [y, m] = monthKey.split('-').map(Number)
    const monthStart = new Date(y, m - 1, 1)
    const monthEnd   = new Date(y, m, 1)

    // Rows in this month
    const inMonth = activity.filter(r => {
      const d = new Date(r.date + 'T00:00:00')
      return d >= monthStart && d < monthEnd
    })

    const allocations = inMonth.filter(r => r.kind === 'allocation')
    const dated       = inMonth.filter(r => r.kind !== 'allocation') // sinking + transfers

    // Group dated rows by date (desc)
    const byDate = new Map<string, GoalActivityRecord[]>()
    for (const r of dated) {
      if (!byDate.has(r.date)) byDate.set(r.date, [])
      byDate.get(r.date)!.push(r)
    }
    const dateGroups: GoalDateGroup[] = Array.from(byDate.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))   // newest date first
      .map(([date, records]) => {
        const d = new Date(date + 'T00:00:00')
        return {
          date,
          day_name:     d.toLocaleDateString('en-US', { weekday: 'short' }),
          day_of_month: String(d.getDate()),
          month_year:   d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          records,
        }
      })

    const total_allocated = allocations.reduce((s, r) => s + r.singed_amount, 0)
    const total_sinking   = inMonth
      .filter(r => r.kind === 'sinking_fund')
      .reduce((s, r) => s + r.singed_amount, 0)

    return {
      month:           monthKey,
      month_label:     monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      allocations,
      dateGroups,
      total_allocated,
      total_sinking,
      left_to_save:    leftMap.get(monthKey) ?? 0,
    }
  })
  // Newest month first
  .sort((a, b) => b.month.localeCompare(a.month))
}

// ── Main hook ──────────────────────────────────────────────────────
export function useGoalSavingsTable(anchorYear: number, anchorMonth1to12: number) {
  const monthKeys = useMemo(
    () => fourMonthSlot(anchorYear, anchorMonth1to12),
    [anchorYear, anchorMonth1to12],
  )

  // Only render months up to and including the current month. Future
  // months inside the selected slot (e.g. Aug/Sep/… when we're in Jul)
  // are hidden even though they belong to the slot. Empty PAST months
  // are still shown.
  const visibleMonthKeys = useMemo(() => {
    const now = new Date()
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    return monthKeys.filter(k => k <= currentKey)   // zero-padded keys sort lexically
  }, [monthKeys])

  const activityQ = useGoalActivity()
  const leftQ     = useMonthlyLeftToSave(monthKeys)   // query full slot range; harmless

  const sections = useMemo<GoalMonthSection[]>(() => {
    if (!activityQ.data) return []
    return buildSections(activityQ.data, visibleMonthKeys, leftQ.data ?? new Map())
  }, [activityQ.data, visibleMonthKeys, leftQ.data])

  return {
    sections,
    monthKeys,
    isLoading: activityQ.isLoading || leftQ.isLoading,
    isError:   activityQ.isError   || leftQ.isError,
  }
}