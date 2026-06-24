import type { DateGroup } from '@/hooks/useTransactions'
 
// ── Filter shape ───────────────────────────────────────────────────
export interface TransactionFilters {
  date?:                string
  account?:             string
  category?:            string
  subCategory?:         string
  type?:                'Expense' | 'Income' | 'Transfer'
  /** Case-insensitive substring match on the transaction note field */
  noteSearch?:          string
  /** When true, hide all transactions where category = 'Sinking Funds' */
  excludeSinkingFunds?: boolean
}
 
// ── Guards ─────────────────────────────────────────────────────────
export function hasActiveFilters(f: TransactionFilters): boolean {
  return !!(
    f.date
    || f.account
    || f.category
    || f.subCategory
    || f.type
    || f.noteSearch
    || f.excludeSinkingFunds
  )
}
 
// ── Client-side filter ─────────────────────────────────────────────
export function applyFilters(groups: DateGroup[], f: TransactionFilters): DateGroup[] {
  if (!hasActiveFilters(f)) return groups
 
  const noteSearch = f.noteSearch?.toLowerCase().trim()
 
  return groups
    .map(group => {
      const filtered = group.transactions.filter(txn => {
        if (f.date                && txn.date            !== f.date)        return false
        if (f.account             && txn.master_account  !== f.account)     return false
        if (f.category            && txn.category        !== f.category)    return false
        if (f.subCategory         && txn.ex_sub_category !== f.subCategory) return false
        if (f.type                && txn.txn_type        !== f.type)        return false
        if (noteSearch            && !txn.note?.toLowerCase().includes(noteSearch)) return false
        if (f.excludeSinkingFunds && txn.category === 'Sinking Funds')      return false
        return true
      })
 
      const total_income  = filtered.filter(t => t.txn_type === 'Income')
        .reduce((s, t) => s + t.singed_amount, 0)
      const total_expense = filtered.filter(t => t.txn_type === 'Expense')
        .reduce((s, t) => s + Math.abs(t.singed_amount), 0)
 
      return { ...group, transactions: filtered, total_income, total_expense }
    })
    .filter(g => g.transactions.length > 0)
}