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

// ── Row accent ─────────────────────────────────────────────────────
// OPTIONAL. When supplied (Analytics page), a row gets:
//   • a left→right gradient wash in the accent colour
//   • its Amount cell recoloured to the accent
// When omitted (Transactions page, Calendar day overlay, Budget drill-
// downs), rows render exactly as before — nothing changes.
export type RowAccentFn = (txn: Transaction) => string | null   // hex, or null

// Append an alpha byte to a #rrggbb colour.
function alpha(hex: string, a: number): string {
  const byte = Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16).padStart(2, '0')
  return `${hex}${byte}`
}

// ── Date group header ──────────────────────────────────────────────
interface DateGroupHeaderProps {
  group: DateGroup
  onDateGroupSelect?: (date: string) => void
  /** Hide the per-day income/expense totals on the right. */
  hideTotals?: boolean
}

function DateGroupHeader({ group, onDateGroupSelect, hideTotals }: DateGroupHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 sticky top-0 bg-navy z-10',
        onDateGroupSelect && [
          'cursor-pointer touch-manipulation',
          'transition-colors hover:bg-navy',
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
      </div>

      {/* Day totals — suppressed on the Analytics page, where the day's
          income/expense sums are meaningless against a filtered, scoped
          slice of the data (e.g. only "Food" rows). */}
      {!hideTotals && (
        <div className="flex items-center gap-2 mr-3">
          {group.total_income > 0 && (
            <span className="font-sora text-xs font-semibold text-green">
              {fmtAmt(group.total_income)} {/* -{fmtAmt(group.total_income)} for amount with sign */}
            </span>
          )}
          {group.total_expense > 0 && (
            <span className="font-sora text-xs font-semibold text-red">
              {fmtAmt(group.total_expense)} {/* -{fmtAmt(group.total_expense)} for amount with sign */}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Single transaction row ─────────────────────────────────────────
interface TransactionRowProps {
  txn:     Transaction
  onTap:   (txn: Transaction) => void
  isLast:  boolean
  accent?: string | null      // hex colour, or null/undefined for default
}

function TransactionRow({ txn, onTap, isLast, accent }: TransactionRowProps) {
  // Minimal left→right gradient wash. Subtle by design: it should read as a
  // tint on the row, never as a coloured block competing with the text.
  const accentStyle = accent
    ? { background: `linear-gradient(90deg, ${alpha(accent, 0.16)} 0%, ${alpha(accent, 0.05)} 45%, transparent 85%)` }
    : undefined

  return (
    <button
      type="button"
      onClick={() => onTap(txn)}
      style={accentStyle}
      className={cn(
        'w-full flex items-start gap-x-2 px-4 py-3 text-left',
        'transition-colors active:bg-panel',
        !isLast && 'border-b border-line/50',
      )}
    >
      {/* ── LEFT column ── */}
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

      {/* ── MIDDLE column ── */}
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

      {/* ── RIGHT: Amount — accent colour wins when provided ── */}
      <div className="flex-none pl-2 self-center text-right">
        <p
          className={cn(
            'font-sora text-sm font-normal tabular-nums whitespace-nowrap',
            !accent && AMT_COLOR[txn.amount_color],
          )}
          style={accent ? { color: accent } : undefined}
        >
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
  avatarColor?:        string
  onDateGroupSelect?:  (date: string) => void
  /** OPTIONAL — per-row accent colour (Analytics group tinting). */
  rowAccent?:          RowAccentFn
  /** OPTIONAL — hide the per-day totals in each date header (Analytics). */
  hideDateTotals?:     boolean
}

export function TransactionTable({
  groups,
  onSelectTransaction,
  isLoading,
  isError,
  onDateGroupSelect,
  rowAccent,
  hideDateTotals = false,
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
    <div className="pb-4 animate-none">
      {groups.map(group => (
        <div key={group.date}>
          <DateGroupHeader
            group={group}
            onDateGroupSelect={onDateGroupSelect}
            hideTotals={hideDateTotals}
          />
          <div className="bg-card mx-3 rounded-xl overflow-hidden border border-line mb-3">
            {group.transactions.map((txn, i) => (
              <TransactionRow
                key={txn.id}
                txn={txn}
                onTap={onSelectTransaction}
                isLast={i === group.transactions.length - 1}
                accent={rowAccent?.(txn) ?? null}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
