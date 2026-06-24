import { cn } from '@/lib/utils'
import type { DateGroup, Transaction } from '@/hooks/useTransactions'

function fmtAmt(amount: number): string {
  return Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const AMT_COLOR: Record<Transaction['amount_color'], string> = {
  green: 'text-green',
  red:   'text-red',
  gray:  'text-soft',
}

// ── Date group header ──────────────────────────────────────────────
interface DateGroupHeaderProps {
  group: DateGroup
  onDateGroupSelect?: (date: string) => void   // NEW
}


// Update DateGroupHeader function:
function DateGroupHeader({ group, onDateGroupSelect }: DateGroupHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 sticky top-0 bg-navy z-10',
        // Only show interactive styles when callback is provided
        onDateGroupSelect && [
          'cursor-pointer touch-manipulation',
          'transition-colors hover:bg-panel/30 active:bg-panel/50',
        ],
      )}
      onClick={() => onDateGroupSelect?.(group.date)}
      role={onDateGroupSelect ? 'button' : undefined}
    >
      <div className="flex items-baseline gap-1">
        <span className="font-sora text-sm font-bold tabular-nums leading-none text-white">
          {group.day_of_month}
        </span>
        <span className="font-sora text-xs font-semibold uppercase leading-none text-soft">
          {group.day_name},
        </span>
        <span className="font-dm text-xs text-muted leading-none">
          {group.month_year}
        </span>
        
        {/* 
        Small "+" signals this row is tappable to add a transaction 
        {onDateGroupSelect && (
          <span className="ml-1 font-sora text-xs text-line">+</span>
        )}  
        */}

      </div>
      <div className="flex items-center gap-2 mr-3">
        {group.total_income > 0 && (
          <span className="font-sora text-xs font-semibold text-green">
            +{fmtAmt(group.total_income)}
          </span>
        )}
        {group.total_expense > 0 && (
          <span className="font-sora text-xs font-semibold text-red">
            −{fmtAmt(group.total_expense)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Single transaction row ─────────────────────────────────────────
interface TransactionRowProps {
  txn:    Transaction
  onTap:  (txn: Transaction) => void
  isLast: boolean
}
function TransactionRow({ txn, onTap, isLast }: TransactionRowProps) {
  return (
    <button
      type="button"
      onClick={() => onTap(txn)}
      className={cn(
        'w-full flex items-start gap-x-2 px-4 py-3 text-left',
        'transition-colors active:bg-panel',
        !isLast && 'border-b border-line/50',
      )}
    >
      {/* ── LEFT column: Fixed width (41.6%) anchors the middle column ── */}
      <div className="w-5/12 flex-none flex flex-col gap-y-0.5">
        <p className={cn(
          'font-sora text-sm font-semibold leading-snug truncate',
          txn.is_transfer ? 'text-soft'
          : txn.is_income  ? 'text-green'
          : 'text-white',
        )}>
          {txn.display_category}
        </p>
        {txn.display_subcategory && (
          <p className="font-dm text-[11px] italic text-muted leading-snug truncate">
            {txn.display_subcategory}
          </p>
        )}
      </div>

      {/* ── MIDDLE column: flex-1 takes the remaining space ── */}
      <div className="min-w-0 flex-1 flex flex-col gap-y-0.5">
        <p className="font-dm text-sm text-white leading-snug truncate">
          {txn.master_account}
        </p>
        {txn.note && (
          <p className="font-dm text-[11px] text-muted leading-snug truncate">
            {txn.note}
          </p>
        )}
      </div>

      {/* ── RIGHT: Amount ── */}
      <div className="flex-none pl-2 self-center text-right">
        <p className={cn(
          'font-sora text-sm font-normal tabular-nums whitespace-nowrap',
          AMT_COLOR[txn.amount_color],
        )}>
          {fmtAmt(txn.singed_amount)}
        </p>
      </div>
    </button>
  )
}

// ── Main export ────────────────────────────────────────────────────
interface TransactionTableProps {
  groups:              DateGroup[]
  onSelectTransaction: (txn: Transaction) => void
  isLoading:           boolean
  isError:             boolean
  avatarColor?:        string   // optional — currently unused (using text-soft for day name)
  onDateGroupSelect?: (date: string) => void  // Add to TransactionTableProps interface:
}

export function TransactionTable({
  groups,
  onSelectTransaction,
  isLoading,
  isError,
  onDateGroupSelect,      // ← add this
}: TransactionTableProps) {

  if (isLoading) {
    return (
      <div className="px-4 pt-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="mb-3 animate-pulse">
            <div className="mb-2 h-4 w-32 rounded-md bg-panel" />
            <div className="h-14 rounded-xl bg-panel" />
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <p className="font-sora text-sm text-red mb-1">Failed to load transactions</p>
        <p className="font-dm text-xs text-soft">Check your connection and try again.</p>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <span className="text-4xl mb-4">📭</span>
        <p className="font-sora text-sm font-semibold text-white mb-1">
          No transactions this month
        </p>
        <p className="font-dm text-xs text-soft">
          Tap <span className="font-semibold text-green">+</span> to record your first one.
        </p>
      </div>
    )
  }

  return (
    <div className="pb-4 animate-fade-in-scale">
      {groups.map(group => (
        <div key={group.date}>
          <DateGroupHeader group={group} onDateGroupSelect={onDateGroupSelect} />
          <div className="bg-card mx-3 rounded-xl overflow-hidden border border-line mb-3">
            {group.transactions.map((txn, i) => (
              <TransactionRow
                key={txn.id}
                txn={txn}
                onTap={onSelectTransaction}
                isLast={i === group.transactions.length - 1}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}