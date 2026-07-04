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
]
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  KEYS.forEach(k => qc.invalidateQueries({ queryKey: k }))
}

// ── Reconstructed transfer data used to pre-populate edit form ──────
export interface TransferGroupData {
  transfer_group_id: string
  date:              string
  from_account:      string
  to_account:        string
  amount:            number
  fee:               number
  note:              string | null
  from_funds:        boolean
  goal_name:         string | null
}

// ── Fetch and reconstruct all rows in a transfer group ───────────────
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

      const { data: goalRows, error: e2 } = await supabase
        .from('fact_goal')
        .select('goal')
        .eq('transfer_group_id', transferGroupId)
        .limit(1)
      if (e2) throw e2

      const outRow  = txns?.find(t => t.ex_sub_category === 'Transfer' && t.singed_amount < 0)
      const inRow   = txns?.find(t => t.ex_sub_category === 'Transfer' && t.singed_amount > 0)
      const feeRow  = txns?.find(t => t.ex_sub_category === 'Fees & Taxes')
      const goalRow = goalRows?.[0]

      return {
        transfer_group_id: transferGroupId,
        date:         outRow?.date ?? inRow?.date ?? '',
        from_account: outRow?.master_account ?? '',
        to_account:   inRow?.master_account  ?? '',
        amount:       Math.abs(outRow?.singed_amount ?? 0),
        fee:          Math.abs(feeRow?.singed_amount ?? 0),
        note:         outRow?.note ?? null,
        from_funds:   !!goalRow,
        goal_name:    goalRow?.goal ?? null,
      }
    },
    enabled: !!transferGroupId,
    staleTime: 0,
  })
}

// ════════════════════════════════════════════════════════════════
// ADD THIS to useEditTransaction.ts — place it right after
// useTransferGroup (same file, same import block already covers it).
// Mirrors useTransferGroup's exact pattern: fetch all rows sharing
// the transfer_group_id, reconstruct the logical "loan payment" shape
// the edit form and detail panel need.
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
        p_note:              p.note         || undefined,
        p_user_id:           user?.id,
        p_from_funds:        p.from_funds,
        p_goal_name:         p.from_funds ? (p.goal_name ?? undefined) : undefined,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateAll(qc),
  })
}
