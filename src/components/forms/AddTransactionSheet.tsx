import { useState } from 'react'
import { cn }            from '@/lib/utils'
import { BottomSheet }   from '@/components/ui/BottomSheet'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { TransferForm }    from '@/components/forms/TransferForm'
import { LoanPaymentForm } from '@/components/forms/LoanPaymentForm'

// ── Types ─────────────────────────────────────────────────────────
type TxnType = 'Expense' | 'Income' | 'Transfer' | 'Loan'

interface AddTransactionSheetProps {
  isOpen:          boolean
  onClose:         () => void
  initialDate?:    string
  initialAccount?: string
}

// ── Main 3 tabs (unchanged width/behavior) ─────────────────────────
const TYPE_TABS: { id: 'Expense' | 'Income' | 'Transfer'; label: string; activeClass: string }[] = [
  { id: 'Expense',  label: 'Expense',  activeClass: 'bg-red  text-white' },
  { id: 'Income',   label: 'Income',   activeClass: 'bg-green text-white' },
  { id: 'Transfer', label: 'Transfer', activeClass: 'bg-blue  text-white' },
]

// ── Component ──────────────────────────────────────────────────────
export function AddTransactionSheet({ isOpen, onClose, initialDate, initialAccount }: AddTransactionSheetProps) {
  const [activeType, setActiveType] = useState<TxnType>('Expense')

  function handleSuccess() {
    setTimeout(onClose, 150)
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add Transaction"
    >
      {/* ── Type selector ──────────────────────────────────────────
          3 equal main tabs (Expense/Income/Transfer) keep their exact
          original width and styling. A separate, narrow icon-only
          button sits to the right for "Loan" — used roughly once a
          month, so it doesn't deserve equal billing with the other
          three. Tapping it switches the active type without growing
          the main tab row.
      ── */}
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

        {/* Compact Loan button — fixed width, not flex-1 */}
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

      {/* ── Form (switches based on active type) ── */}
      {activeType === 'Transfer' ? (
        <TransferForm
          onSuccess={handleSuccess}
          initialDate={initialDate}
          initialAccount={initialAccount}
          onCancel={onClose}
        />
      ) : activeType === 'Loan' ? (
        <LoanPaymentForm
          onSuccess={handleSuccess}
          initialDate={initialDate}
          initialAccount={initialAccount}
          onCancel={onClose}
        />
      ) : (
        <TransactionForm
          key={activeType}
          initialType={activeType}
          initialDate={initialDate}
          initialAccount={initialAccount}
          onSuccess={handleSuccess}
          onCancel={onClose}
        />
      )}
    </BottomSheet>
  )
}
