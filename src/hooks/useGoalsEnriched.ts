// src/hooks/useGoalsEnriched.ts
//
// Goals-page-specific goal list. UNLIKE useGoals (which filters
// is_active=true and is used by the transaction/transfer forms), this
// returns ALL goals (active + inactive) enriched with:
//   • linked_account, template_budget, is_active, created_at
//   • current_balance (from useGoalActivity)
//   • required_monthly_saving
//   • progress_ratio (balance / target_amount)
//   • pace status: 'ahead' | 'on_track' | 'behind' | null
//
// useGoals stays UNTOUCHED so existing form callers are unaffected.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  useGoalActivity,
  computeGoalBalances,
  computeThreeMonthAllocAverage,
  type GoalActivityRecord,
} from '@/hooks/useGoalActivity'
import { useMemo } from 'react'

// ── Raw goal (all columns we need) ─────────────────────────────────
export interface GoalRow {
  id:              string
  goal_name:       string
  target_amount:   number | null
  target_date:     string | null
  sort_order:      number
  is_active:       boolean
  created_at:      string
  template_budget: number | null
  linked_account:  string | null
}

export type GoalPace = 'ahead' | 'on_track' | 'behind' | null

export interface EnrichedGoal extends GoalRow {
  current_balance:         number
  required_monthly_saving: number | null   // null when no target or no future date
  progress_ratio:          number | null   // null when no target_amount
  pace:                    GoalPace
  three_month_avg:         number
}

// ── Raw fetch: ALL goals (no is_active filter) ─────────────────────
function useAllGoalRows() {
  return useQuery<GoalRow[]>({
    queryKey: ['goals_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_goal')
        .select('id, goal_name, target_amount, target_date, sort_order, is_active, created_at, template_budget, linked_account')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data as GoalRow[]
    },
    staleTime: 1000 * 60 * 5,
  })
}

// ── Months between now and a target date (inclusive-ish, min 1) ────
function monthsUntil(targetDate: string, now: Date): number | null {
  const t = new Date(targetDate + 'T00:00:00')
  if (isNaN(t.getTime())) return null
  const months =
    (t.getFullYear() - now.getFullYear()) * 12 +
    (t.getMonth() - now.getMonth())
  return months   // may be <= 0 if target is past/this month
}

// ── Enrichment ─────────────────────────────────────────────────────
function enrich(
  goal: GoalRow,
  balances: Map<string, number>,
  activity: GoalActivityRecord[],
  now: Date,
): EnrichedGoal {
  const current_balance = balances.get(goal.goal_name) ?? 0

  // Required monthly saving (only when target amount + a future target date)
  let required_monthly_saving: number | null = null
  if (goal.target_amount != null && goal.target_date) {
    const remaining = goal.target_amount - current_balance
    const m = monthsUntil(goal.target_date, now)
    if (m != null && m > 0 && remaining > 0) {
      required_monthly_saving = remaining / m
    } else if (remaining <= 0) {
      required_monthly_saving = 0   // already reached
    } else {
      // target date is now/past but not reached → treat as "due now"
      required_monthly_saving = remaining
    }
  }

  const progress_ratio =
    goal.target_amount != null && goal.target_amount > 0
      ? current_balance / goal.target_amount
      : null

  const three_month_avg = computeThreeMonthAllocAverage(activity, goal.goal_name, now)

  // Pace: compare 3-month avg allocation vs required monthly, ±10% band.
  // Only meaningful when a required amount > 0 exists.
  let pace: GoalPace = null
  if (required_monthly_saving != null && required_monthly_saving > 0) {
    const req = required_monthly_saving
    const lower = req * 0.9
    const upper = req * 1.1
    if (three_month_avg > upper)      pace = 'ahead'
    else if (three_month_avg < lower) pace = 'behind'
    else                               pace = 'on_track'
  }

  return {
    ...goal,
    current_balance,
    required_monthly_saving,
    progress_ratio,
    pace,
    three_month_avg,
  }
}

// ── Main hook ──────────────────────────────────────────────────────
export function useGoalsEnriched() {
  const goalsQ    = useAllGoalRows()
  const activityQ = useGoalActivity()

  const isLoading = goalsQ.isLoading || activityQ.isLoading
  const isError   = goalsQ.isError   || activityQ.isError

  const goals = useMemo<EnrichedGoal[]>(() => {
    if (!goalsQ.data || !activityQ.data) return []
    const now = new Date()
    const balances = computeGoalBalances(activityQ.data)
    return goalsQ.data.map(g => enrich(g, balances, activityQ.data!, now))
  }, [goalsQ.data, activityQ.data])

  return { goals, isLoading, isError }
}

// ── Validation helpers for the create/edit goal panel ──────────────
// Read from the already-cached goal list; no extra query.

/** true if the name collides with an EXISTING different goal. */
export function isGoalNameTaken(
  goals: GoalRow[] | EnrichedGoal[],
  name: string,
  excludeId?: string,
): boolean {
  const n = name.trim().toLowerCase()
  return goals.some(g => g.goal_name.trim().toLowerCase() === n && g.id !== excludeId)
}

/** returns the goal that already links this account, if any (else null). */
export function accountLinkedTo(
  goals: GoalRow[] | EnrichedGoal[],
  account: string,
  excludeId?: string,
): GoalRow | EnrichedGoal | null {
  return goals.find(g => g.linked_account === account && g.id !== excludeId) ?? null
}