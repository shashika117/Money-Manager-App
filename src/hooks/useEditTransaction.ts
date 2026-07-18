//src\hooks\useEditTransaction.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const KEYS = [
  ['transactions'],
  ['account_balances'],
  ['net_worth'],
  ['net_worth_daily'],
  ['budget_rollover'],
  ['nws_components'],
  ['left_for_savings'],
  ['calendar_daily'],
  ['goals'],
  ['monthly_cashflow'],
  ['transactions_search'],
  // ── ADDED: editing/updating a transfer can create or move a linked
  //    Monthly Allocation (or a linked transfer's own edit), so the
  //    Goals views must refresh alongside everything else.
  ['goals_all'],
  ['goal_activity'],
  ['total_left_to_save'],
  ['monthly_left_to_save'],
]
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  KEYS.forEach(k => qc.invalidateQueries({ queryKey: k }))
}

// ── Reconstructed transfer data used to pre-populate edit form ──────
// From Funds fields REMOVED — transfers no longer withdraw from a goal.
export interface TransferGroupData {
  transfer_group_id: string
  date:              string
  from_account:      string
  to_account:        string
  amount:            number
  fee:               number
  note:              string | null
}

// ── Fetch and reconstruct all rows in a transfer group ───────────────
// The fact_goal lookup is REMOVED — transfers no longer create a linked
// fact_goal row (that was the old From-Funds "Sinking Funds" write).
// Any OLD From-Funds rows from before this change still exist in
// fact_goal and are still cleaned up correctly by update_transfer /
// delete_transfer (both clear rows by transfer_group_id) — they are
// simply no longer read back into the edit form.
export function useTransferGroup(transferGroupId: string | null | undefined) {
  return useQuery<TransferGroupData | null>({
    queryKey: ['transfer_group', transferGroupId],
    queryFn: async () => {
      if (!transferGroupId) return null

      const { data: txns, error: e1 } = await supabase
        .from('fact_transaction')
        .select('*')
        .eq('transfer_group_id', transferGroupId)
      if (e1) throw e1

      const outRow  = txns?.find(t => t.ex_sub_category === 'Transfer' && t.singed_amount < 0)
      const inRow   = txns?.find(t => t.ex_sub_category === 'Transfer' && t.singed_amount > 0)
      const feeRow  = txns?.find(t => t.ex_sub_category === 'Fees & Taxes')

      return {
        transfer_group_id: transferGroupId,
        date:         outRow?.date ?? inRow?.date ?? '',
        from_account: outRow?.master_account ?? '',
        to_account:   inRow?.master_account  ?? '',
        amount:       Math.abs(outRow?.singed_amount ?? 0),
        fee:          Math.abs(feeRow?.singed_amount ?? 0),
        note:         outRow?.note ?? null,
      }
    },
    enabled: !!transferGroupId,
    staleTime: 0,
  })
}

// ════════════════════════════════════════════════════════════════
// Loan payment reconstruction — UNCHANGED, unrelated to From Funds.
// ════════════════════════════════════════════════════════════════

// ── Reconstructed loan-payment data used to pre-populate edit form ──
export interface LoanPaymentGroupData {
  transfer_group_id: string
  date:              string
  from_account:      string   // paying account (capital + interest)
  loan_account:      string   // liability account credited
  capital_amount:    number
  interest_amount:   number
  note:              string | null
}

// ── Fetch and reconstruct all rows in a loan-payment group ───────────
export function useLoanPaymentGroup(transferGroupId: string | null | undefined) {
  return useQuery<LoanPaymentGroupData | null>({
    queryKey: ['loan_payment_group', transferGroupId],
    queryFn: async () => {
      if (!transferGroupId) return null

      const { data: rows, error } = await supabase
        .from('fact_transaction')
        .select('*')
        .eq('transfer_group_id', transferGroupId)
      if (error) throw error

      const capitalRow   = rows?.find(r => r.ex_sub_category === 'Loan Capital')
      const interestRow  = rows?.find(r => r.ex_sub_category === 'Loan Interest')
      const liabilityRow = rows?.find(r => r.ex_sub_category === 'Transfer' && r.singed_amount > 0)

      return {
        transfer_group_id: transferGroupId,
        date:            capitalRow?.date ?? liabilityRow?.date ?? '',
        from_account:    capitalRow?.master_account ?? '',
        loan_account:    liabilityRow?.master_account ?? '',
        capital_amount:  Math.abs(capitalRow?.singed_amount ?? 0),
        interest_amount: Math.abs(interestRow?.singed_amount ?? 0),
        note:            capitalRow?.note ?? null,
      }
    },
    enabled: !!transferGroupId,
    staleTime: 0,
  })
}


// ── Update regular Expense or Income ────────────────────────────────
export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      id:              string
      date:            string
      master_account:  string
      ex_sub_category: string
      singed_amount:   number
      note?:           string
      goal?:           string
    }) => {
      const { error } = await supabase.rpc('update_transaction', {
        p_id:              p.id,
        p_date:            p.date,
        p_master_account:  p.master_account,
        p_ex_sub_category: p.ex_sub_category,
        p_singed_amount:   p.singed_amount,
        p_note:            p.note    || undefined,
        p_goal:            p.goal    || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateAll(qc),
  })
}

// ── Update Sinking Funds expense ─────────────────────────────────────
export function useUpdateSinkingFundExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: {
      transaction_id: string
      date:           string
      account:        string
      goal_name:      string
      amount:         number
      note?:          string
    }) => {
      const { error } = await supabase.rpc('update_sinking_fund_expense', {
        p_transaction_id: p.transaction_id,
        p_date:           p.date,
        p_account:        p.account,
        p_goal_name:      p.goal_name,
        p_amount:         p.amount,
        p_note:           p.note || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateAll(qc),
  })
}

// ── Update Transfer ──────────────────────────────────────────────────
// From Funds params REMOVED from the RPC call. If the (possibly new)
// To account is linked to a goal, update_transfer() auto-creates the
// Monthly Allocation server-side, guarded once-per-month excluding this
// transfer's own existing allocation. A duplicate attempt raises
// 'DUPLICATE_ALLOCATION:...', surfaced through `error` for the form.
export function useUpdateTransfer() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: TransferGroupData & { note?: string }) => {
      const { error } = await supabase.rpc('update_transfer', {
        p_transfer_group_id: p.transfer_group_id,
        p_date:              p.date,
        p_from_account:      p.from_account,
        p_to_account:        p.to_account,
        p_amount:            p.amount,
        p_fee:               p.fee,
        p_note:              p.note || undefined,
        p_user_id:           user?.id,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateAll(qc),
  })
}