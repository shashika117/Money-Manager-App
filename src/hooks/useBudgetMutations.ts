import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase }  from '@/lib/supabase'
 
function invalidateBudget(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['budget_table'] })
  qc.invalidateQueries({ queryKey: ['budget_summary'] })
}
 
/** Income / Expense subcategory Budget cell. */
export function useUpsertBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      month:           string
      ex_sub_category: string
      amount:          number
      applyFuture:     boolean
    }) => {
      const { error } = await supabase.rpc('upsert_budget', {
        p_month:           p.month,
        p_ex_sub_category: p.ex_sub_category,
        p_amount:          p.amount,
        p_apply_future:    p.applyFuture,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateBudget(qc),
  })
}
 
/** Savings goal Budget cell. */
export function useUpsertGoalBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      month:       string
      goal_name:   string
      amount:      number
      applyFuture: boolean
    }) => {
      const { error } = await supabase.rpc('upsert_goal_budget', {
        p_month:        p.month,
        p_goal_name:    p.goal_name,
        p_amount:       p.amount,
        p_apply_future: p.applyFuture,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateBudget(qc),
  })
}