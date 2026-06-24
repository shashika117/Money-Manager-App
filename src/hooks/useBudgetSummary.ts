import { useQuery } from '@tanstack/react-query'
import { supabase }  from '@/lib/supabase'
 
export interface BudgetSummary {
  // Budget card
  budget_income:  number
  budget_needs:   number
  budget_wants:   number
  budget_save:    number
  left_to_budget: number
  budget_nws:     number
  // Actual card
  actual_income:  number
  actual_needs:   number
  actual_wants:   number
  actual_save:    number
  left_to_save:   number
  actual_nws:     number
  // Summary card
  budget_expense: number
  actual_expense: number
}
 
export function useBudgetSummary(month: string) {
  return useQuery<BudgetSummary>({
    queryKey: ['budget_summary', month],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_budget_summary', {
        p_selected_month: month,
      })
      if (error) throw error
      // RPC returns a single row (array of 1)
      const r = Array.isArray(data) ? data[0] : data
      const num = (v: any) => Number(v ?? 0)
      return {
        budget_income:  num(r?.budget_income),
        budget_needs:   num(r?.budget_needs),
        budget_wants:   num(r?.budget_wants),
        budget_save:    num(r?.budget_save),
        left_to_budget: num(r?.left_to_budget),
        budget_nws:     num(r?.budget_nws),
        actual_income:  num(r?.actual_income),
        actual_needs:   num(r?.actual_needs),
        actual_wants:   num(r?.actual_wants),
        actual_save:    num(r?.actual_save),
        left_to_save:   num(r?.left_to_save),
        actual_nws:     num(r?.actual_nws),
        budget_expense: num(r?.budget_expense),
        actual_expense: num(r?.actual_expense),
      }
    },
    staleTime: 1000 * 30,
  })
}
 