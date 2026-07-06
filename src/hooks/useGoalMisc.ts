// src/hooks/useGoalMisc.ts
//
// Two small read hooks:
//   • useTotalLeftToSave — the all-time headline scalar (RPC).
//   • useGoalChart       — a single goal's running cumulative balance
//                          series, sliced to a period, from the
//                          useGoalActivity cache (no extra query).

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  useGoalActivity,
  computeGoalChartSeries,
  sliceChartPeriod,
  type GoalChartPoint,
  type GoalChartPeriod,
} from '@/hooks/useGoalActivity'

// ── Per-goal Budget for a single month, from goal_budget_data ──────
// Returns a Map<goal_name, amount> for the given month ('YYYY-MM-01').
// This is the month-specific budget (NOT dim_goal.template_budget).
export function useGoalBudgetForMonth(monthKey: string | null) {
  return useQuery<Map<string, number>>({
    queryKey: ['goal_budget_data', monthKey],
    queryFn: async () => {
      const map = new Map<string, number>()
      if (!monthKey) return map
      const { data, error } = await supabase
        .from('goal_budget_data')
        .select('goal_name, amount')
        .eq('month', monthKey)
      if (error) throw error
      for (const r of (data as { goal_name: string; amount: number }[]) ?? []) {
        map.set(r.goal_name, Number(r.amount))
      }
      return map
    },
    enabled: !!monthKey,
    staleTime: 1000 * 30,
  })
}

// ── All-time "Left to Save" headline (single scalar via RPC) ───────
export function useTotalLeftToSave() {
  return useQuery<number>({
    queryKey: ['total_left_to_save'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_total_left_to_save')
      if (error) throw error
      return Number(data ?? 0)
    },
    staleTime: 1000 * 30,
  })
}

// ── "Left to Save" for a single month ('YYYY-MM-01') ───────────────
// Reads v_left_for_savings for that one month. Used by the allocation
// manager to show the selected month's unallocated amount.
export function useLeftToSaveForMonth(monthKey: string | null) {
  return useQuery<number>({
    queryKey: ['monthly_left_to_save', monthKey, monthKey],
    queryFn: async () => {
      if (!monthKey) return 0
      // Range-bound to the single month for date-column safety.
      const [y, m] = monthKey.split('-').map(Number)
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
      const { data, error } = await supabase
        .from('v_left_for_savings')
        .select('month, left_for_savings')
        .gte('month', monthKey)
        .lt('month', nextMonth)
      if (error) throw error
      const rows = (data as { left_for_savings: number }[]) ?? []
      return rows.reduce((s, r) => s + Number(r.left_for_savings), 0)
    },
    enabled: !!monthKey,
    staleTime: 1000 * 30,
  })
}

// ── Goal chart series (cumulative balance) for one goal + period ───
export function useGoalChart(goalName: string | null, period: GoalChartPeriod) {
  const activityQ = useGoalActivity()

  const series = useMemo<GoalChartPoint[]>(() => {
    if (!goalName || !activityQ.data) return []
    const full = computeGoalChartSeries(activityQ.data, goalName)
    return sliceChartPeriod(full, period)
  }, [goalName, activityQ.data, period])

  return {
    series,
    isLoading: activityQ.isLoading,
    isError:   activityQ.isError,
  }
}