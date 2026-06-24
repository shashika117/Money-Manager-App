import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Calls recalculate_account_balances() on the server.
 * This recomputes every account's current_balance from first principles
 * (opening_balance + SUM of all transactions) regardless of what the
 * trigger-maintained value says.
 *
 * Use after a bulk data import, or any time you suspect drift.
 * The function runs in ~200ms even at 200K transactions.
 */
export function useRecalculateBalances() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .rpc('recalculate_account_balances')

      if (error) throw error
      // The function returns a text message like:
      // "Recalculated current_balance for 8 accounts from scratch."
      return data as string
    },
    onSuccess: () => {
      // Refresh all balance-dependent queries
      queryClient.invalidateQueries({ queryKey: ['account_balances'] })
      queryClient.invalidateQueries({ queryKey: ['net_worth'] })
      queryClient.invalidateQueries({ queryKey: ['net_worth_history'] })
    },
  })
}