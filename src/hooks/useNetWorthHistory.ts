// ── src/hooks/useNetWorthHistory.ts ──────────────────────────────
// Calls get_net_worth_history(p_period) RPC.
//
// p_period = '3M'  → daily data, last 3 months  (~90  rows)
// p_period = '6M'  → daily data, last 6 months  (~180 rows)
// p_period = '12M' → daily data, last 12 months (~365 rows)
// p_period = 'ALL' → monthly data, all time     (~240 rows at 20 years)
//
// For '3M'/'6M'/'12M': only scans transactions in the period
//   (idx_ft_date bounded scan, ~1-10 K rows max).
// For 'ALL': reads from mv_net_worth_monthly (pre-computed, instant).
 
import { useQuery } from '@tanstack/react-query'
import { supabase }  from '@/lib/supabase'
 
export type NetWorthPeriod = '3M' | '6M' | '12M' | 'ALL'
 
export interface NetWorthDataPoint {
  period_date: string   // 'YYYY-MM-DD'
  assets:      number
  liability:   number
  net_worth:   number
}
 
export function useNetWorthHistory(period: NetWorthPeriod) {
  return useQuery<NetWorthDataPoint[]>({
    queryKey: ['net_worth_history', period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_net_worth_history', {
        p_period: period,
      })
      if (error) throw error
 
      return (data ?? []).map((v: any) => ({
        period_date: v.period_date as string,
        assets:      Number(v.assets),
        liability:   Number(v.liability),
        net_worth:   Number(v.net_worth),
      }))
    },
    // 'ALL' data refreshes at most hourly server-side;
    // bounded periods have live transaction data — stale after 5 min.
    staleTime: period === 'ALL' ? 1000 * 60 * 60 : 1000 * 60 * 5,
  })
}