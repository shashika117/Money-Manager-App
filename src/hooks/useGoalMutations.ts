// src/hooks/useGoalMutations.ts
//
// All Goals-page write operations. Every mutation invalidates the shared
// Goals caches plus budget caches (linked allocations affect budget
// savings) so the whole app stays live.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// Keys every goal write should refresh.
const GOAL_KEYS = [
  ['goal_activity'],
  ['goals'],          // active-only list used by forms
  ['goals_all'],      // enriched list used by Goals page
  ['total_left_to_save'],
  ['monthly_left_to_save'],
  ['budget_table'],
  ['budget_summary'],
  ['nws_components'],
  ['left_for_savings'],
]
function invalidateGoals(qc: ReturnType<typeof useQueryClient>) {
  GOAL_KEYS.forEach(k => qc.invalidateQueries({ queryKey: k }))
}

// ════════════════════════════════════════════════════════════════
// MONTHLY ALLOCATION — upsert with once-per-month override flow
// ════════════════════════════════════════════════════════════════
export interface AllocationPayload {
  date:      string   // any date in the target month
  goal_name: string
  amount:    number
  note?:     string
  force?:    boolean  // true = override existing month's allocation
}

// Returns { status: 'exists' } when a non-forced duplicate is found, so
// the UI can show the override warning, then re-call with force=true.
export function useUpsertMonthlyAllocation() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: AllocationPayload) => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase.rpc('upsert_monthly_allocation', {
        p_date:      p.date,
        p_goal_name: p.goal_name,
        p_amount:    p.amount,
        p_user_id:   user.id,
        p_note:      p.note || undefined,
        p_force:     p.force ?? false,
      })
      if (error) throw error
      return data as { status: string; existed?: boolean; id?: string; goal?: string; month?: string }
    },
    onSuccess: (res) => {
      // Only invalidate when something actually changed (not on 'exists').
      if (res?.status !== 'exists') invalidateGoals(qc)
    },
  })
}

// ════════════════════════════════════════════════════════════════
// GOAL-TO-GOAL FUNDS TRANSFER
// ════════════════════════════════════════════════════════════════
export interface GoalTransferPayload {
  date:      string
  from_goal: string
  to_goal:   string
  amount:    number
  note?:     string
}

export function useCreateGoalTransfer() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: GoalTransferPayload) => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase.rpc('create_goal_transfer', {
        p_date:      p.date,
        p_from_goal: p.from_goal,
        p_to_goal:   p.to_goal,
        p_amount:    p.amount,
        p_user_id:   user.id,
        p_note:      p.note || undefined,
      })
      if (error) throw error   // includes "Insufficient balance in ..."
      return data
    },
    onSuccess: () => invalidateGoals(qc),
  })
}

export interface UpdateGoalTransferPayload extends GoalTransferPayload {
  transfer_group_id: string
}
export function useUpdateGoalTransfer() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: UpdateGoalTransferPayload) => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase.rpc('update_goal_transfer', {
        p_transfer_group_id: p.transfer_group_id,
        p_date:              p.date,
        p_from_goal:         p.from_goal,
        p_to_goal:           p.to_goal,
        p_amount:            p.amount,
        p_user_id:           user.id,
        p_note:              p.note || undefined,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateGoals(qc),
  })
}

export function useDeleteGoalTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (transferGroupId: string) => {
      const { data, error } = await supabase.rpc('delete_goal_transfer', {
        p_transfer_group_id: transferGroupId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => invalidateGoals(qc),
  })
}

// ════════════════════════════════════════════════════════════════
// DELETE a single Monthly Allocation (non-linked) row
// ════════════════════════════════════════════════════════════════
export function useDeleteAllocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fact_goal').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateGoals(qc),
  })
}

// ════════════════════════════════════════════════════════════════
// DIM_GOAL CRUD (create / update / reorder)
// ════════════════════════════════════════════════════════════════
export interface GoalUpsertPayload {
  goal_name:       string
  target_amount:   number | null
  target_date:     string | null
  template_budget: number | null
  linked_account:  string | null
  is_active:       boolean
  created_at?:     string   // create only (goal started date)
  sort_order?:     number   // create only (defaults to end)
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: GoalUpsertPayload) => {
      const { data, error } = await supabase
        .from('dim_goal')
        .insert({
          goal_name:       p.goal_name,
          target_amount:   p.target_amount,
          target_date:     p.target_date,
          template_budget: p.template_budget,
          linked_account:  p.linked_account,
          is_active:       p.is_active,
          created_at:      p.created_at,
          sort_order:      p.sort_order ?? 0,
        })
        .select()
        .single()
      if (error) throw error   // unique violations surface here
      return data
    },
    onSuccess: () => invalidateGoals(qc),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: GoalUpsertPayload & { id: string }) => {
      const { error } = await supabase
        .from('dim_goal')
        .update({
          goal_name:       p.goal_name,
          target_amount:   p.target_amount,
          target_date:     p.target_date,
          template_budget: p.template_budget,
          linked_account:  p.linked_account,
          is_active:       p.is_active,
        })
        .eq('id', p.id)
      if (error) throw error
      return { id: p.id }
    },
    onSuccess: () => invalidateGoals(qc),
  })
}

// ── Reorder (grip handle) — persist new sort_order for many goals ──
export function useReorderGoals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ordered: { id: string; sort_order: number }[]) => {
      // Sequential updates; the list is tiny (a handful of goals).
      for (const row of ordered) {
        const { error } = await supabase
          .from('dim_goal')
          .update({ sort_order: row.sort_order })
          .eq('id', row.id)
        if (error) throw error
      }
    },
    // Optimistic: caller reorders local state; we just refresh after.
    onSuccess: () => invalidateGoals(qc),
  })
}