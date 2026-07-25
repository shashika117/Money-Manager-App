//src\hooks\useDeleteTransaction.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { invalidateTransactionRelated } from '@/lib/queryInvalidation'

// ── Delete regular Expense or Income ──────────────────────────────
export function useDeleteRegularTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fact_transaction')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}

// ── Delete Sinking Funds expense (cleans up fact_goal too) ─────────
export function useDeleteSinkingFundExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase.rpc('delete_sinking_fund_expense', {
        p_transaction_id: transactionId,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}

// ── Delete Transfer (all rows in the group + fact_goal if from_funds)
export function useDeleteTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (transferGroupId: string) => {
      const { error } = await supabase.rpc('delete_transfer', {
        p_transfer_group_id: transferGroupId,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}