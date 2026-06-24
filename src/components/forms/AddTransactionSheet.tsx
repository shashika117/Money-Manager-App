import { useState } from 'react'
import { cn }            from '@/lib/utils'
import { BottomSheet }   from '@/components/ui/BottomSheet'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { TransferForm }    from '@/components/forms/TransferForm'

// ── Types ─────────────────────────────────────────────────────────
type TxnType = 'Expense' | 'Income' | 'Transfer'

interface AddTransactionSheetProps {
  isOpen:    boolean
  onClose:   () => void
  initialDate?: string    // NEW
  initialAccount?: string   // ← ADD THIS
}

// ── Type tab configuration ─────────────────────────────────────────
const TYPE_TABS: { id: TxnType; label: string; activeClass: string }[] = [
  { id: 'Expense',  label: 'Expense',  activeClass: 'bg-red  text-white' },
  { id: 'Income',   label: 'Income',   activeClass: 'bg-green text-white' },
  { id: 'Transfer', label: 'Transfer', activeClass: 'bg-blue  text-white' },
]

// ── Component ──────────────────────────────────────────────────────
export function AddTransactionSheet({ isOpen, onClose, initialDate, initialAccount }: AddTransactionSheetProps) {
  const [activeType, setActiveType] = useState<TxnType>('Expense')

  function handleSuccess() {
    // Small delay so the user sees the form reset before sheet closes
    setTimeout(onClose, 150)
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add Transaction"
    >
      {/* ── Type selector ── */}
      <div className="mb-5 flex gap-1.5 rounded-xl bg-panel p-1">
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

      {/* ── Form (switches based on active type) ── */}
      {activeType === 'Transfer' ? (

        <TransferForm 
        onSuccess={handleSuccess} 
        initialDate={initialDate} 
        initialAccount={initialAccount}
        onCancel={onClose}        // {/* ← add this */}
        />

      ) : (

        <TransactionForm
          key={activeType}          // remounts form when type switches
          initialType={activeType}
          initialDate={initialDate}
          initialAccount={initialAccount}
          onSuccess={handleSuccess}
          onCancel={onClose}        // {/* ← add this */}
        />
      )}
    </BottomSheet>
  )
}