// ── src/hooks/useNetWorth.ts ──────────────────────────────────────
// Reads the current total net worth from v_net_worth.
// Now reads from dim_account.current_balance directly (O(accounts)),
// not from a SUM over fact_transaction (was O(n)).
 
import { useQuery } from '@tanstack/react-query'
import { supabase }  from '@/lib/supabase'
 
export interface NetWorth {
  total_assets:    number
  total_liability: number
  net_worth:       number
}
 
export function useNetWorth() {
  return useQuery<NetWorth>({
    queryKey: ['net_worth'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_net_worth')
        .select('*')
        .single()
 
      if (error) throw error
      return {
        total_assets:    Number((data as any).total_assets),
        total_liability: Number((data as any).total_liability),
        net_worth:       Number((data as any).net_worth),
      }
    },
    staleTime: 0,  // always fresh — backed by trigger-maintained current_balance
  })
}