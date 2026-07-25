//src\hooks\useTransactionMutations.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { invalidateTransactionRelated } from '@/lib/queryInvalidation'

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

// From Funds REMOVED — transfers no longer withdraw from a goal.
// Deducting saved money from a goal is done only via the Expense flow
// (category = 'Sinking Funds').
export interface TransferPayload {
  date:          string
  from_account:  string
  to_account:    string
  amount:        number
  fee:           number
  note:          string
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
    onSuccess: () => invalidateTransactionRelated(queryClient),
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
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}

// ── useAddTransfer ─────────────────────────────────────────────────
// From Funds params removed from the RPC call. If the To account is
// linked to a goal, create_transfer() auto-creates a Monthly Allocation
// server-side (once per month per goal) — nothing extra to send here.
// A duplicate-allocation attempt raises 'DUPLICATE_ALLOCATION:...',
// which surfaces through `error` below for the form to display.
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
      })

      if (error) throw error
      return data
    },
    onSuccess: () => invalidateTransactionRelated(queryClient),
  })
}


