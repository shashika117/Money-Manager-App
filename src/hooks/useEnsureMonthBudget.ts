import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase }  from '@/lib/supabase'
import type { BudgetRow } from '@/hooks/useBudgetTable'
 
/**
 * Call with the current month's loaded budget rows. If every row has
 * budget === 0 (a genuinely empty month) and we haven't already seeded
 * this month in the current session, fire copy_budget_to_month once,
 * then invalidate so the table refetches with seeded values.
 *
 * Guarded by a ref-set of already-seeded months so it never loops.
 */
export function useEnsureMonthBudget(
  month:     string,
  rows:      BudgetRow[] | undefined,
  isLoading: boolean,
) {
  const qc = useQueryClient()
  const seeded = useRef<Set<string>>(new Set())
 
  useEffect(() => {
    if (isLoading || !rows) return
    if (seeded.current.has(month)) return
 
    // A month is "empty" if no income/expense/savings row carries a budget.
    const hasAnyBudget = rows.some(r => r.budget !== 0)
    if (hasAnyBudget) {
      seeded.current.add(month)   // already has data; nothing to seed
      return
    }
 
    seeded.current.add(month)     // mark before async to prevent re-entry
    ;(async () => {
      const { error } = await supabase.rpc('copy_budget_to_month', {
        p_target_month: month,
      })
      if (error) {
        console.error('copy_budget_to_month failed:', error)
        return
      }
      qc.invalidateQueries({ queryKey: ['budget_table', month] })
      qc.invalidateQueries({ queryKey: ['budget_summary', month] })
    })()
  }, [month, rows, isLoading, qc])
}
 