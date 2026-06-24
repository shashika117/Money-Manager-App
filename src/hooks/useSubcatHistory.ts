import { useQuery } from '@tanstack/react-query'
import { supabase }  from '@/lib/supabase'
 
export interface HistoryPoint {
  month_date: string   // 'YYYY-MM-01'
  label:      string   // 'Mar'
  amount:     number
}
export interface SubcatHistory {
  points:  HistoryPoint[]
  average: number
}
 
/**
 * One of exKey / goalKey is used:
 *   - income/expense subcategory → pass exKey, leave goalKey undefined
 *   - savings goal               → pass goalKey, leave exKey undefined
 * `enabled` lets the caller defer the query until the popup opens.
 */
export function useSubcatHistory(
  month:    string,
  exKey?:   string,
  goalKey?: string,
  months  = 3,
  enabled = true,
) {
  const key = goalKey ? `goal:${goalKey}` : `sub:${exKey}`
  return useQuery<SubcatHistory>({
    queryKey: ['subcat_history', month, key, months],
    enabled: enabled && (!!exKey || !!goalKey),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_subcat_history', {
        p_selected_month:  month,
        p_ex_sub_category: goalKey ? undefined : exKey,
        p_goal_name:       goalKey,
        p_months:          months,
      })
      if (error) throw error
      const points: HistoryPoint[] = (data ?? []).map((r: any) => ({
        month_date: r.month_date,
        label: new Date(r.month_date + 'T00:00:00')
          .toLocaleDateString('en-US', { month: 'short' }),
        amount: Number(r.amount),
      }))
      const sum = points.reduce((s, p) => s + p.amount, 0)
      const average = points.length ? sum / points.length : 0
      return { points, average }
    },
    staleTime: 1000 * 60 * 5,
  })
}