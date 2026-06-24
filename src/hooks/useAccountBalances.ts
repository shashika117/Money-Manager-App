// ── src/hooks/useAccountBalances.ts ──────────────────────────────
// Reads dim_account.current_balance via the simplified v_account_balances.
// Was: O(n) aggregation over fact_transaction.
// Now: O(accounts) plain SELECT — always fast regardless of history size.
 
import { useQuery } from '@tanstack/react-query'
import { supabase }  from '@/lib/supabase'
 
export interface AccountBalance {
  master_account:   string
  account_category: string
  account_group:    'Assets' | 'Liability'
  sort_order:       number
  opening_balance:  number
  txn_total:        number
  current_balance:  number
}
 
export function useAccountBalances() {
  return useQuery<AccountBalance[]>({
    queryKey: ['account_balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_account_balances')
        .select('*')
        .order('account_group', { ascending: true })
        .order('sort_order',    { ascending: true })
 
      if (error) throw error
      return data as AccountBalance[]
    },
    staleTime: 0,   // always fresh — underlying current_balance is trigger-maintained
  })
}