// src/components/forms/editTypes.ts

import type { Transaction } from '@/hooks/useTransactions'

export type EditableTxnType = 'Expense' | 'Income' | 'Transfer' | 'Loan'

export interface TransferGroupPrefill {
  from_account: string
  to_account:   string
  fee:          number
  amount:       number
}

export interface LoanPaymentGroupPrefill {
  from_account:    string
  loan_account:    string
  capital_amount:  number
  interest_amount: number
}

// Everything AddTransactionSheet and its child forms need to turn an
// "Add" flow into an "Edit" flow: what the original record looked like
// (for prefill) and how to remove it once the replacement is safely saved.
export interface EditingTransaction {
  type: EditableTxnType
  transaction: Transaction
  transferGroup?: TransferGroupPrefill
  loanPaymentGroup?: LoanPaymentGroupPrefill
  /**
   * Deletes the original record(s) this edit is replacing.
   * IMPORTANT: only call this AFTER the replacement has saved
   * successfully — never before — so a failed save can never
   * destroy the original data.
   */
  deleteOriginal: () => Promise<void>
}