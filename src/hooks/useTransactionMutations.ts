import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// ── Query keys to invalidate after any write ───────────────────────
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
  // ── ADDED: keeps the Budget page's Actual column and summary cards
  //    live whenever a transaction is added/edited/deleted, instead of
  //    showing stale numbers until the user navigates away and back.
  ['budget_table'],
  ['budget_summary'],
]

// ── Payload types ──────────────────────────────────────────────────

export interface ExpensePayload {
  date:              string   // 'YYYY-MM-DD'
  master_account:    string
  ex_sub_category:   string   // selected subcategory (or 'Sinking Funds')
  amount:            number   // positive — negated automatically
  note:              string
  isSinkingFunds:    boolean
  goal_name?:        string   // required when isSinkingFunds = true
}

export interface IncomePayload {
  date:            string
  master_account:  string
  ex_sub_category: string   // = category name for Income
  amount:          number   // positive — stored as-is
  note:            string
}

export interface TransferPayload {
  date:          string
  from_account:  string
  to_account:    string
  amount:        number
  fee:           number
  note:          string
  from_funds:    boolean
  goal_name?:    string   // required when from_funds = true
}

// ── useAddExpense ──────────────────────────────────────────────────
export function useAddExpense() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: ExpensePayload) => {
      if (!user) throw new Error('Not authenticated')

      // Sinking Funds: dual-table write via RPC
      if (payload.isSinkingFunds) {
        const { data, error } = await supabase.rpc(
          'create_sinking_fund_expense',
          {
            p_date:      payload.date,
            p_account:   payload.master_account,
            p_goal_name: payload.goal_name!,
            p_amount:    payload.amount,
            p_note:      payload.note || undefined,
            p_user_id:   user.id,
          }
        )
        if (error) throw error
        return data
      }

      // Regular expense: direct insert
      const { data, error } = await supabase
        .from('fact_transaction')
        .insert({
          date:            payload.date,
          master_account:  payload.master_account,
          ex_sub_category: payload.ex_sub_category,
          singed_amount:   -Math.abs(payload.amount),   // always negative
          note:            payload.note || null,
          user_id:         user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      INVALIDATE_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: key }))
      // Also invalidate goals if Sinking Funds
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

// ── useAddIncome ───────────────────────────────────────────────────
export function useAddIncome() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: IncomePayload) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('fact_transaction')
        .insert({
          date:            payload.date,
          master_account:  payload.master_account,
          ex_sub_category: payload.ex_sub_category,
          singed_amount:   Math.abs(payload.amount),   // always positive
          note:            payload.note || null,
          user_id:         user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      INVALIDATE_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: key }))
    },
  })
}

// ── useAddTransfer ─────────────────────────────────────────────────
export function useAddTransfer() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: TransferPayload) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase.rpc('create_transfer', {
        p_date:         payload.date,
        p_from_account: payload.from_account,
        p_to_account:   payload.to_account,
        p_amount:       Math.abs(payload.amount),
        p_fee:          payload.fee ?? 0,
        p_note:         payload.note || undefined,
        p_user_id:      user.id,
        p_from_funds:   payload.from_funds,
        p_goal_name:    payload.from_funds ? (payload.goal_name ?? undefined) : undefined,
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      INVALIDATE_KEYS.forEach(key => queryClient.invalidateQueries({ queryKey: key }))
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}