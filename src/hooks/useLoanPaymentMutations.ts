import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// Mirrors INVALIDATE_KEYS in useTransactionMutations.ts — kept identical
// so a loan payment refreshes every page a regular transfer would.
const INVALIDATE_KEYS = [
  ['transactions'],
  ['account_balances'],
  ['net_worth'],
  ['net_worth_daily'],
  ['budget_rollover'],
  ['nws_components'],
  ['left_for_savings'],
  ['calendar_daily'],
  ['monthly_cashflow'],
  ['transactions_search'],
  ['budget_table'],
  ['budget_summary'],
]

export interface LoanPaymentPayload {
  date:             string   // 'YYYY-MM-DD'
  from_account:     string   // savings account paying the EMI
  loan_account:     string   // liability account (e.g. 'BOC Loan')
  capital_amount:   number   // > 0
  interest_amount:  number   // >= 0; 0 → no interest row written
  note:             string
}

export interface UpdateLoanPaymentPayload extends LoanPaymentPayload {
  transfer_group_id: string
}

// ── useAddLoanPayment ────────────────────────────────────────────
export function useAddLoanPayment() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: LoanPaymentPayload) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase.rpc('create_loan_payment', {
        p_date:            payload.date,
        p_from_account:    payload.from_account,
        p_loan_account:    payload.loan_account,
        p_capital_amount:  payload.capital_amount,
        p_interest_amount: payload.interest_amount,
        p_note:            payload.note || undefined,
        p_user_id:         user.id,
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      INVALIDATE_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: key }))
    },
  })
}

// ── useUpdateLoanPayment ─────────────────────────────────────────
export function useUpdateLoanPayment() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: UpdateLoanPaymentPayload) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase.rpc('update_loan_payment', {
        p_transfer_group_id: payload.transfer_group_id,
        p_date:              payload.date,
        p_from_account:      payload.from_account,
        p_loan_account:      payload.loan_account,
        p_capital_amount:    payload.capital_amount,
        p_interest_amount:   payload.interest_amount,
        p_note:              payload.note || undefined,
        p_user_id:           user.id,
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      INVALIDATE_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: key }))
    },
  })
}

// ── useDeleteLoanPayment ─────────────────────────────────────────
export function useDeleteLoanPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (transferGroupId: string) => {
      const { data, error } = await supabase.rpc('delete_loan_payment', {
        p_transfer_group_id: transferGroupId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      INVALIDATE_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: key }))
    },
  })
}