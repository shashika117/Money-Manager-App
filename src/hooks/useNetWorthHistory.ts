// src/hooks/useNetWorthHistory.ts 
 
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


