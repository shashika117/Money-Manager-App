// src/components/forms/AddTransactionSheet.tsx

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn, todayLocal } from '@/lib/utils'
import { BottomSheet }   from '@/components/ui/BottomSheet'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { TransferForm }    from '@/components/forms/TransferForm'
import { LoanPaymentForm } from '@/components/forms/LoanPaymentForm'
import type { EditingTransaction } from '@/components/forms/editTypes'

// ── Types ─────────────────────────────────────────────────────────
type TxnType = 'Expense' | 'Income' | 'Transfer' | 'Loan'

interface AddTransactionSheetProps {
  isOpen:          boolean
  onClose:         () => void
  initialDate?:    string
  initialAccount?: string
  editing?:        EditingTransaction | null
  /** Called after a save completes successfully, in addition to onClose.
   *  Kept separate from onClose so callers can tell "user cancelled /
   *  dismissed" apart from "data actually changed underneath you". */
  onSaved?:        () => void
}

export interface SharedTxnData {
  date: string
  account: string
  amount: string
  note: string
}

const TYPE_TABS: { id: 'Expense' | 'Income' | 'Transfer'; label: string; activeClass: string }[] = [
  { id: 'Expense',  label: 'Expense',  activeClass: 'bg-red  text-white' },
  { id: 'Income',   label: 'Income',   activeClass: 'bg-green text-white' },
  { id: 'Transfer', label: 'Transfer', activeClass: 'bg-blue  text-white' },
]

function buildSharedData(
  editing?: EditingTransaction | null,
  initialDate?: string,
  initialAccount?: string,
): SharedTxnData {
  if (editing) {
    const t = editing.transaction
    if (editing.type === 'Transfer' && editing.transferGroup) {
      return {
        date:    t.date,
        account: editing.transferGroup.from_account,
        amount:  String(editing.transferGroup.amount),
        note:    t.note ?? '',
      }
    }
    if (editing.type === 'Loan' && editing.loanPaymentGroup) {
      return {
        date:    t.date,
        account: editing.loanPaymentGroup.from_account,
        amount:  String(editing.loanPaymentGroup.capital_amount),
        note:    t.note ?? '',
      }
    }
    // Expense / Income
    return {
      date:    t.date,
      account: t.master_account,
      amount:  String(Math.abs(t.singed_amount)),
      note:    t.note ?? '',
    }
  }
  return {
    date:    initialDate ?? todayLocal(),
    account: initialAccount ?? '',
    amount:  '',
    note:    '',
  }
}

// ── Component ──────────────────────────────────────────────────────
export function AddTransactionSheet({ isOpen, onClose, initialDate, initialAccount, editing, onSaved }: AddTransactionSheetProps) {
  const [activeType, setActiveType] = useState<TxnType>('Expense')

  // Force forms to completely remount when opened, or when the active
  // type changes — each type gets a clean form instance.
  const [formResetKey, setFormResetKey] = useState(0)

  const sharedDataRef = useRef<SharedTxnData>(
    buildSharedData(editing, initialDate, initialAccount)
  )

  // Reset form caches dynamically when the sheet opens
  useEffect(() => {
    if (isOpen) {
      sharedDataRef.current = buildSharedData(editing, initialDate, initialAccount)
      setActiveType(editing?.type ?? 'Expense')
      setFormResetKey(prev => prev + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialDate, initialAccount, editing?.transaction.id])

  const updateSharedData = useCallback((data: Partial<SharedTxnData>) => {
    sharedDataRef.current = {
      date: data.date ?? sharedDataRef.current.date,
      account: data.account ?? sharedDataRef.current.account,
      amount: data.amount ?? sharedDataRef.current.amount,
      note: data.note ?? sharedDataRef.current.note,
    }
  }, [])

  function handleSuccess() {
    setTimeout(() => {
      onClose()
      onSaved?.()
    }, 150)
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit Transaction' : 'Add Transaction'}
    >
      {/* ── Type selector ────────────────────────────────────────── */}
      <div className="mb-5 flex gap-1.5">
        <div className="flex flex-1 gap-1.5 rounded-xl bg-panel p-1">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveType(tab.id)}
              className={cn(
                'flex-1 rounded-lg py-2 font-dm text-sm font-medium transition-colors',
                activeType === tab.id
                  ? tab.activeClass
                  : 'text-soft hover:text-white',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setActiveType('Loan')}
          title="Loan Payment"
          aria-label="Loan Payment"
          className={cn(
            'flex-none w-12 rounded-xl flex items-center justify-center text-base transition-colors',
            activeType === 'Loan'
              ? 'bg-amber text-white'
              : 'bg-panel text-soft hover:text-white',
          )}
        >
          🏦
        </button>
      </div>

      {/* ── Form ── */}
      {/* Only the form matching the ORIGINAL type gets prefilled type-
          specific fields. Switching tabs away from that starts blank —
          same as normal Add — but `editing` still travels along so the
          original record gets cleaned up once the new one saves. */}
      {activeType === 'Transfer' ? (
        <TransferForm
          key={`Transfer-${formResetKey}`}
          sharedData={sharedDataRef.current}
          updateSharedData={updateSharedData}
          onSuccess={handleSuccess}
          onCancel={onClose}
          editing={editing ?? undefined}
        />
      ) : activeType === 'Loan' ? (
        <LoanPaymentForm
          key={`Loan-${formResetKey}`}
          sharedData={sharedDataRef.current}
          updateSharedData={updateSharedData}
          onSuccess={handleSuccess}
          onCancel={onClose}
          editing={editing ?? undefined}
        />
      ) : (
        <TransactionForm
          key={`${activeType}-${formResetKey}`}
          initialType={activeType}
          sharedData={sharedDataRef.current}
          updateSharedData={updateSharedData}
          onSuccess={handleSuccess}
          onCancel={onClose}
          editing={editing ?? undefined}
        />
      )}
    </BottomSheet>
  )
}