import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useTransactions } from '@/hooks/useTransactions'
import type { Transaction } from '@/hooks/useTransactions'
import { TransactionTable }       from '@/components/layout/TransactionTable'
import { TransactionDetailPanel } from '@/components/layout/TransactionDetailPanel'
import { AddTransactionSheet }    from '@/components/forms/AddTransactionSheet'
import { FAB }                    from '@/components/ui/FAB'
// ADD this import at the top (after the other imports)
import {
  type TransactionFilters,
  hasActiveFilters,
  applyFilters,
} from '@/lib/transactionFilters'



export interface TransactionTableWidgetProps {
  /**
   * Active filter set. Any combination of fields.
   * When `filters.date` is provided, month nav defaults to hidden.
   */
  filters?: TransactionFilters

  /** Seed the displayed month on first mount. Defaults to current month. */
  initialYear?:  number
  initialMonth?: number

  /**
   * Show the month navigation header.
   * Auto-detected: true when no date filter, false when date filter is active.
   * Pass explicitly to override.
   */
  showMonthNav?: boolean

  /** Extra Tailwind classes on the outer wrapper. */
  className?: string

  onDateGroupSelect?: (date: string) => void
}

// Add this line anywhere near the top of the file, after the import above
export type { TransactionFilters }

// ── Month navigation header ────────────────────────────────────────


const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                            'Jul','Aug','Sep','Oct','Nov','Dec']

// ── Inline month picker popup (same design as TransactionsPage) ────
interface PickerProps {
  currentYear:  number; currentMonth: number
  pos:          { top: number; left: number }
  onSelect:     (y: number, m: number) => void
  onClose:      () => void
}
function MonthPickerPopup({ currentYear, currentMonth, pos, onSelect, onClose }: PickerProps) {
  const now = new Date()
  const [py, setPy] = useState(currentYear)
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 animate-fade-in" onClick={onClose} />
      <div className="fixed z-[61] w-72 rounded-2xl bg-card border border-line shadow-2xl p-4 animate-fade-in-scale"
        style={{ top: pos.top, left: pos.left }}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setPy(y => y - 1)}
            className="h-8 w-8 flex items-center justify-center rounded-lg font-sora text-base text-soft hover:text-white hover:bg-panel transition-colors">‹</button>
          <span className="font-sora text-base font-bold text-white">{py}</span>
          <button onClick={() => setPy(y => Math.min(y + 1, now.getFullYear()))}
            disabled={py >= now.getFullYear()}
            className={cn('h-8 w-8 flex items-center justify-center rounded-lg font-sora text-base transition-colors',
              py >= now.getFullYear() ? 'text-line cursor-default' : 'text-soft hover:text-white hover:bg-panel')}>›</button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {MONTH_NAMES_SHORT.map((m, i) => {
            const mNum = i + 1
            const isToday = py === now.getFullYear() && mNum === now.getMonth() + 1
            const isSel   = py === currentYear && mNum === currentMonth
            const isFut   = py > now.getFullYear() || (py === now.getFullYear() && mNum > now.getMonth() + 1)
            return (
              <button key={m} disabled={isFut}
                onClick={() => { if (!isFut) { onSelect(py, mNum); onClose() } }}
                className={cn('h-9 rounded-xl font-dm text-sm font-medium transition-all duration-150',
                  isFut  ? 'text-line cursor-default'
                  : isSel ? 'bg-green text-white shadow-sm shadow-green/30'
                  : isToday ? 'ring-1 ring-green text-green hover:bg-green/15'
                  :           'text-soft hover:bg-panel hover:text-white')}>
                {m}
              </button>
            )
          })}
        </div>
        <button onClick={onClose}
          className="mt-4 w-full rounded-xl border border-line py-2.5 font-dm text-sm text-soft hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </>
  )
}

// ── New month nav header with popup picker ─────────────────────────
interface MonthNavHeaderProps {
  nav: { year: number; month: number; prev: () => void; next: () => void; label: string; goTo: (y: number, m: number) => void }
}
function MonthNavHeader({ nav }: MonthNavHeaderProps) {
  const monthBtnRef = useRef<HTMLButtonElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPos, setPickerPos]   = useState<{ top: number; left: number } | null>(null)
  const now     = new Date()
  const isLatest = nav.year === now.getFullYear() && nav.month === now.getMonth() + 1

  function handleOpenPicker() {
    if (monthBtnRef.current) {
      const rect = monthBtnRef.current.getBoundingClientRect()
      const w = 288, margin = 8
      const cl = rect.left + rect.width / 2 - w / 2
      setPickerPos({ top: rect.bottom + 6, left: Math.max(margin, Math.min(cl, window.innerWidth - w - margin)) })
    }
    setPickerOpen(true)
  }

  return (
    <>
      <div className="flex items-center justify-end px-4 py-2.5 border-b border-line bg-card flex-none">
        <div className="flex items-center gap-1.5">
          <button onClick={nav.prev}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-line bg-navy font-sora text-sm text-soft hover:text-white hover:border-soft transition-colors touch-manipulation">
            ‹
          </button>
          <button ref={monthBtnRef} type="button" onClick={handleOpenPicker}
            className="font-sora text-sm font-semibold text-white min-w-[120px] text-center hover:text-green transition-colors touch-manipulation select-none">
            {nav.label}
          </button>
          <button onClick={nav.next} disabled={isLatest}
            className={cn('h-8 w-8 flex items-center justify-center rounded-lg border font-sora text-sm transition-colors touch-manipulation',
              isLatest ? 'border-line text-line cursor-default' : 'border-line bg-navy text-soft hover:text-white hover:border-soft')}>
            ›
          </button>
        </div>
      </div>
      {pickerOpen && pickerPos && (
        <MonthPickerPopup
          currentYear={nav.year} currentMonth={nav.month}
          pos={pickerPos}
          onSelect={(y, m) => nav.goTo(y, m)}
          onClose={() => { setPickerOpen(false); setPickerPos(null) }}
        />
      )}
    </>
  )
}





// ── Active filter indicator pills ──────────────────────────────────
// Shown between the month nav and the transaction list so the user
// always knows what is being filtered without hunting for a settings panel.
interface FilterPillsProps {
  filters: TransactionFilters
}
function FilterPills({ filters }: FilterPillsProps) {
  // Build a human-readable label for each active filter
  const pills: { key: string; label: string }[] = []

  if (filters.type)        pills.push({ key: 'type',       label: filters.type })
  if (filters.account)     pills.push({ key: 'account',    label: `🏦 ${filters.account}` })
  if (filters.category)    pills.push({ key: 'category',   label: `📂 ${filters.category}` })
  if (filters.subCategory) pills.push({ key: 'subCat',     label: `• ${filters.subCategory}` })
  if (filters.date)        pills.push({ key: 'date',       label: `📅 ${filters.date}` })

  if (pills.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2.5 border-b border-line bg-card/60 flex-none animate-fade-in">
      <span className="font-dm text-xs text-soft self-center">Filtered by:</span>
      {pills.map(p => (
        <span
          key={p.key}
          className="inline-flex items-center rounded-full border border-green/30 bg-green/10 px-2.5 py-0.5 font-dm text-xs text-green"
        >
          {p.label}
        </span>
      ))}
    </div>
  )
}

// ── Empty state when filters produce no results ────────────────────
function EmptyFiltered() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <span className="text-4xl mb-4">🔍</span>
      <p className="font-sora text-sm font-semibold text-white mb-1">
        No matching transactions
      </p>
      <p className="font-dm text-xs text-soft">
        Try a different month or adjust your filters.
      </p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// MONTH NAV HOOK (internal)
// ════════════════════════════════════════════════════════════════════

function useMonthNav(seedYear: number, seedMonth: number) {
  const [year,  setYear]  = useState(seedYear)
  const [month, setMonth] = useState(seedMonth)

  function prev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function next() {
    const now = new Date()
    if (year > now.getFullYear()
      || (year === now.getFullYear() && month >= now.getMonth() + 1)) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // AFTER the existing prev / next functions inside useMonthNav:
  function goTo(y: number, m: number) {
    setYear(y)
   setMonth(m)
  }

  const label = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  })
  return { year, month, prev, next, label, goTo }
}

  function InternalFABSheet({
  initialAccount,
  onDateGroupSelect,
}: {
  initialAccount?: string
  onDateGroupSelect?: (date: string) => void
}) {
  const [open, setOpen]     = useState(false)
  const [date, setDate]     = useState<string | undefined>()

  // TransactionTable calls onDateGroupSelect → we intercept and open our sheet
  // This component doesn't need to change; just the parent wires onDateGroupSelect
  // to openSheet if it wants its own sheet management.
  // FAB here is for widget-local sheet when parent doesn't provide onDateGroupSelect.
  if (onDateGroupSelect) return null   // parent handles it

  return (
    <>
      <FAB onClick={() => setOpen(true)} />
      <AddTransactionSheet
        isOpen={open}
        onClose={() => { setOpen(false); setTimeout(() => setDate(undefined), 300) }}
        initialDate={date}
        initialAccount={initialAccount}
      />
    </>
  )
}


// ════════════════════════════════════════════════════════════════════
// MAIN WIDGET
// ════════════════════════════════════════════════════════════════════

export function TransactionTableWidget({
  filters = {},
  initialYear,
  initialMonth,
  showMonthNav: showNavProp,
  className,
  onDateGroupSelect,      // ← add this
}: TransactionTableWidgetProps) {
  const now = new Date()

  // Seed the month from the date filter when provided, so the hook
  // fetches the correct month without the user having to navigate.
  const seedYear  = filters.date
    ? parseInt(filters.date.slice(0, 4), 10)
    : (initialYear  ?? now.getFullYear())
  const seedMonth = filters.date
    ? parseInt(filters.date.slice(5, 7), 10)
    : (initialMonth ?? now.getMonth() + 1)

  const nav = useMonthNav(seedYear, seedMonth)

  // Fetch one month of data — the same call regardless of which filters
  // are active. Client-side filtering handles the rest.
  const { data: allGroups = [], isLoading, isError } = useTransactions(
    nav.year,
    nav.month,
     filters.noteSearch || undefined,   // triggers full-history mode when non-empty
  )

  // Apply all active filters to the fetched data
  const displayGroups = applyFilters(allGroups, filters)

  // Each widget instance owns its own selected transaction state.
  // Mounting two widgets simultaneously keeps their selections independent.
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)

  // Auto-detect whether to show the month nav:
  // hide when filtering to a single date, show in all other cases.
  const showNav = showNavProp ?? !filters.date

  // Determine what to render in the body:
  // If filters are active AND the result is empty, show the filtered empty state
  // rather than the generic "no transactions this month" state.
  const isFilteredEmpty = hasActiveFilters(filters)
    && !isLoading
    && !isError
    && displayGroups.length === 0

  return (
    <div className={cn('flex flex-col', className)}>

      {/* ── Month navigation ── */}
      {showNav && <MonthNavHeader nav={nav} />}

      {/* ── Active filter indicator ── */}
      <FilterPills filters={filters} />

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-safe-bottom"> {/* change from "overflow-y-auto" to "overflow-visible" in order to stick date row into the screen */}
        {isFilteredEmpty ? (
          <EmptyFiltered />
        ) : (
          <TransactionTable
            groups={displayGroups}
            onSelectTransaction={setSelectedTxn}
            isLoading={isLoading}
            isError={isError}
            onDateGroupSelect={onDateGroupSelect}   // NEW
          />
        )}
      </div>

      {/* ── Detail / Edit / Delete panel (instance-local) ── */}
      <TransactionDetailPanel
        transaction={selectedTxn}
        onClose={() => setSelectedTxn(null)}
      />

      {showNav && (
       <>
         <InternalFABSheet
           initialAccount={(filters as any).account}
           onDateGroupSelect={onDateGroupSelect}
         />
       </>
      )}

    </div>
  )
}