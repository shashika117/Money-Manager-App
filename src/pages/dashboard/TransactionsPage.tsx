/**
 * TransactionsPage.tsx — complete rewrite with all adjustments
 */

import { useState, useCallback, useRef } from 'react'
import { cn }                          from '@/lib/utils'
import { FAB }                         from '@/components/ui/FAB'
import { AddTransactionSheet }         from '@/components/forms/AddTransactionSheet'
import { TransactionTableWidget }      from '@/components/layout/TransactionTableWidget'
import { CalendarWidget }              from '@/components/layout/CalendarWidget'
import { CashflowChart }               from '@/components/charts/CashflowChart'
import { useMonthlyCashflow }          from '@/hooks/useMonthlyCashflow'
import type { TransactionFilters }     from '@/lib/transactionFilters'
import type { MonthlySummary }         from '@/hooks/useMonthlyCashflow'

// ── Constants ──────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun',
                     'Jul','Aug','Sep','Oct','Nov','Dec']

// ── Full amount formatter — absolute, 2 dp ─────────────────────────
function fmtFull(n: number): string {
  return Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ════════════════════════════════════════════════════════════════════
// MONTH PICKER POPUP
// ════════════════════════════════════════════════════════════════════
// AFTER — pos is calculated from the button's exact viewport position
interface MonthPickerProps {
  currentYear:  number
  currentMonth: number
  pos:          { top: number; left: number }   // ← new: exact pixel position
  onSelect:     (year: number, month: number) => void
  onClose:      () => void
}

function MonthPicker({ currentYear, currentMonth, pos, onSelect, onClose }: MonthPickerProps) {
  const now = new Date()
  const todayYear  = now.getFullYear()
  const todayMonth = now.getMonth() + 1
  const [pickerYear, setPickerYear] = useState(currentYear)

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 animate-fade-in" onClick={onClose} />
      <div
        className="fixed z-[61] w-72 rounded-2xl bg-card border border-line shadow-2xl p-4 animate-fade-in-scale"
        style={{ top: pos.top, left: pos.left }}
      >

        {/* Year nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setPickerYear(y => y - 1)}
            className="h-8 w-8 flex items-center justify-center rounded-lg font-sora text-base text-soft hover:text-white hover:bg-panel transition-colors">
            ‹
          </button>
          <span className="font-sora text-base font-bold text-white">{pickerYear}</span>
          <button onClick={() => setPickerYear(y => Math.min(y + 1, todayYear))}
            disabled={pickerYear >= todayYear}
            className={cn('h-8 w-8 flex items-center justify-center rounded-lg font-sora text-base transition-colors',
              pickerYear >= todayYear ? 'text-line cursor-default' : 'text-soft hover:text-white hover:bg-panel')}>
            ›
          </button>
        </div>
        {/* Month grid */}
        <div className="grid grid-cols-4 gap-1.5">
          {MONTH_NAMES.map((m, i) => {
            const mNum       = i + 1
            const isToday    = pickerYear === todayYear   && mNum === todayMonth
            const isSelected = pickerYear === currentYear && mNum === currentMonth
            const isFuture   = pickerYear > todayYear || (pickerYear === todayYear && mNum > todayMonth)
            return (
              <button key={m}
                onClick={() => { if (!isFuture) { onSelect(pickerYear, mNum); onClose() } }}
                disabled={isFuture}
                className={cn('h-9 rounded-xl font-dm text-sm font-medium transition-all duration-150',
                  isFuture   ? 'text-line cursor-default'
                  : isSelected ? 'bg-green text-white shadow-sm shadow-green/30'
                  : isToday   ? 'ring-1 ring-green text-green hover:bg-green/15'
                  :              'text-soft hover:bg-panel hover:text-white')}>
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

// ════════════════════════════════════════════════════════════════════
// TOGGLE SWITCH
// ════════════════════════════════════════════════════════════════════
function ToggleSwitch({ value, onChange, offLabel, onLabel }: {
  value: boolean; onChange: (v: boolean) => void; offLabel: string; onLabel: string
}) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className="flex items-center gap-2 touch-manipulation" aria-pressed={value}>
      <span className={cn('font-dm text-[11px] transition-colors', value ? 'text-green' : 'text-soft')}>
        {value ? onLabel : offLabel}
      </span>
      <div className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
        value ? 'bg-green' : 'bg-line')}>
        <span className={cn('absolute h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200',
          value ? 'translate-x-[18px]' : 'translate-x-[3px]')} />
      </div>
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════
// SEARCH FIELD — commits on Enter key only
// ════════════════════════════════════════════════════════════════════
function SearchField({ inputValue, appliedValue, onInputChange, onCommit, onClear }: {
  inputValue: string; appliedValue: string
  onInputChange: (v: string) => void; onCommit: (v: string) => void; onClear: () => void
}) {
  const isPending = inputValue !== appliedValue && inputValue !== ''
  const isApplied = appliedValue !== '' && appliedValue === inputValue
  return (
    <div>
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input type="text" placeholder="Search notes…"
          value={inputValue}
          onChange={e => onInputChange(e.target.value)}

          onKeyDown={e => {
           if (e.key === 'Enter') {
             const v = inputValue.trim()
             if (v.length > 0 && v.length < 3) {
               // Show a hint but don't commit — trigram index needs 3+ chars
               return
             }
              onCommit(inputValue)
            }
          }}
          
          className={cn('w-full rounded-xl border bg-panel py-2 lg:py-2.5 pl-9 pr-9 font-dm text-sm text-white placeholder:text-muted outline-none transition-colors',
            isApplied  ? 'border-green/60 focus:border-green'
            : isPending ? 'border-amber/40 focus:border-amber'
            :             'border-line focus:border-green')} />
        {(inputValue || appliedValue) && (
          <button type="button" onClick={onClear} aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors touch-manipulation">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      
      {inputValue.trim().length > 0 && inputValue.trim().length < 3 && (
        <p className="mt-1 font-dm text-[10px] text-muted animate-fade-in">
         Type at least 3 characters to search
       </p>
     )}
      {isPending && inputValue.trim().length >= 3 && (
      <p className="mt-1 font-dm text-[10px] text-amber animate-fade-in">
          Press Enter to search
        </p>
      )}

      {isApplied && <p className="mt-1 font-dm text-[10px] text-green animate-fade-in">Showing results for "{appliedValue}"</p>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// SUMMARY CARD — no sign, color only, full amount
// ════════════════════════════════════════════════════════════════════
function SummaryCard({ label, amount, isPositive, compact = false }: {
  label: string; amount: number; isPositive: boolean; compact?: boolean
}) {
  return (
    <div className={cn('rounded-xl border border-line bg-navy/60 flex flex-col', compact ? 'p-2.5' : 'p-3.5')}>
      <p className={cn('font-dm uppercase tracking-wider text-muted', compact ? 'text-[9px]' : 'text-[10px]')}>{label}</p>
      <p className={cn('font-sora font-bold leading-tight mt-0.5', isPositive ? 'text-green' : 'text-red', compact ? 'text-sm' : 'text-lg')}>
        {fmtFull(amount)}
      </p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// VIEW TOGGLE (mobile only)
// ════════════════════════════════════════════════════════════════════
function ViewToggle({ showCalendar, onChange }: { showCalendar: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex rounded-lg border border-line bg-navy overflow-hidden">
      <button type="button" onClick={() => onChange(false)}
        className={cn('flex items-center gap-1 px-2.5 py-1.5 font-dm text-[11px] transition-colors touch-manipulation',
          !showCalendar ? 'bg-green/15 text-green' : 'text-soft hover:text-white')}>
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 7h6M9 11h6M9 15h4" />
        </svg>
        Table
      </button>
      <div className="w-px bg-line" />
      <button type="button" onClick={() => onChange(true)}
        className={cn('flex items-center gap-1 px-2.5 py-1.5 font-dm text-[11px] transition-colors touch-manipulation',
          showCalendar ? 'bg-green/15 text-green' : 'text-soft hover:text-white')}>
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        Cal
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════
export default function TransactionsPage() {
  const now = new Date()

  const [selectedYear,        setSelectedYear]        = useState(now.getFullYear())
  const [selectedMonth,       setSelectedMonth]       = useState(now.getMonth() + 1)
  const [showCalendar,        setShowCalendar]        = useState(false)
  const [searchInput,         setSearchInput]         = useState('')
  const [searchNote,          setSearchNote]          = useState('')
  // DEFAULT OFF = exclude Sinking Funds
  const [includeSinkingFunds, setIncludeSinkingFunds] = useState(false)
  const [pickerOpen,          setPickerOpen]          = useState(false)
  const [sheetOpen,           setSheetOpen]           = useState(false)
  const [sheetInitialDate,    setSheetInitialDate]    = useState<string | undefined>()

  const monthBtnRef                                   = useRef<HTMLButtonElement>(null)
  const [pickerPos,           setPickerPos]           = useState<{ top: number; left: number } | null>(null)

  const { data: cashflowData = [], isLoading: cfLoading } = useMonthlyCashflow(includeSinkingFunds)

  const selectedSummary: MonthlySummary | undefined = cashflowData.find(
    d => d.year === selectedYear && d.month === selectedMonth)
  const income  = selectedSummary?.income  ?? 0
  const expense = selectedSummary?.expense ?? 0
  const net     = selectedSummary?.net     ?? 0

  function goToPrev() {
    if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12) }
    else setSelectedMonth(m => m - 1)
  }
  function goToNext() {
    if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1) return
    if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1) }
    else setSelectedMonth(m => m + 1)
  }

  const handleSelectMonth = useCallback((y: number, m: number) => {
    setSelectedYear(y); setSelectedMonth(m)
  }, [])

  function openSheet(date?: string) { setSheetInitialDate(date); setSheetOpen(true) }
  function closeSheet() { setSheetOpen(false); setTimeout(() => setSheetInitialDate(undefined), 300) }

  // Calculates the popup's position from the button's bounding rect.
// Centers the picker under the button and clamps it so it never
// overflows the screen edges.
function handleOpenPicker() {
  if (monthBtnRef.current) {
    const rect        = monthBtnRef.current.getBoundingClientRect()
    const pickerW     = 288   // w-72 = 18rem = 288px at 16px root
    const margin      = 8
    const centeredLeft = rect.left + rect.width / 2 - pickerW / 2
    const clampedLeft  = Math.max(
      margin,
      Math.min(centeredLeft, window.innerWidth - pickerW - margin),
    )
    setPickerPos({ top: rect.bottom + 6, left: clampedLeft })
  }
  setPickerOpen(true)
}

  const activeFilters: TransactionFilters = {
    ...(searchNote.trim()   && { noteSearch: searchNote.trim() }),
    ...(includeSinkingFunds ? {} : { excludeSinkingFunds: true }),
  }

  const widgetKey    = `${selectedYear}-${selectedMonth}`
  const monthLabel   = new Date(selectedYear, selectedMonth - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const isLatest = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1

  return (
    /*
      animate-fade-in (NO scale/translate transform on this container).
      If a parent has transform CSS, iOS Safari positions fixed children
      relative to that parent instead of the viewport — causing the FAB
      to visually "drop" on mount. Fade-only avoids any transform here.
    */
    <div className={cn(
      'flex flex-col flex-1 min-h-0 overflow-hidden lg:overflow-y-auto animate-fade-in',
    )}>

      {/* ── HEADER ── */}
      <div className="border-b border-line bg-card px-4 flex-none"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)', paddingBottom: '12px' }}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-sora text-xl font-bold text-white leading-none">Transactions</h1>
          <ToggleSwitch
            value={includeSinkingFunds}
            onChange={setIncludeSinkingFunds}
            offLabel="Excl. Sinking Funds"
            onLabel="Incl. Sinking Funds"
          />
        </div>
        <div className="mt-2.5">
          <SearchField
            inputValue={searchInput}
            appliedValue={searchNote}
            onInputChange={setSearchInput}
            onCommit={v => setSearchNote(v)}
            onClear={() => { setSearchInput(''); setSearchNote('') }}
          />
        </div>
      </div>

      {/* ── DESKTOP ANALYTICS (lg only) ── */}
      <div className="hidden lg:flex gap-4 px-4 pt-4 pb-3 flex-none items-stretch">
        <div className="flex-[3]">
          <CashflowChart
            data={cashflowData} selectedYear={selectedYear} selectedMonth={selectedMonth}
            onSelectMonth={handleSelectMonth} isLoading={cfLoading} className="h-full" />
        </div>
        <div className="flex-1 flex flex-col gap-2.5 justify-center">
          <SummaryCard label="Inflow"    amount={income}        isPositive />
          <SummaryCard label="Outflow"  amount={expense}       isPositive={false} />
          <SummaryCard label="Netflow" amount={Math.abs(net)} isPositive={net >= 0} />
        </div>
      </div>

      {/* ── CONTROLS BAR ─────────────────────────────────────────────
          Mobile:  [ViewToggle] ── [‹ Month/Year (clickable) ›]
          Laptop:  ──────────── ── [‹ Month/Year (clickable) ›]
      ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-line bg-card/70 flex-none">
        {/* ViewToggle: mobile only */}
        <div className="lg:hidden">
          <ViewToggle showCalendar={showCalendar} onChange={setShowCalendar} />
        </div>

        <div className="flex-1" />

        {/* Month nav with clickable label */}
        <div className="flex items-center gap-1.5">

          <button
            onClick={goToPrev}
           disabled={!!searchNote}
            className={cn(
              'h-8 w-8 flex items-center justify-center rounded-lg border font-sora text-sm transition-colors touch-manipulation',
              searchNote
                ? 'border-line text-line cursor-default'
               : 'border-line bg-navy text-soft hover:text-white hover:border-soft',
            )}
          >
            ‹
          </button>
          
        {searchNote ? (
          <span className="font-dm text-xs text-amber min-w-[130px] text-center animate-fade-in">
            All transaction history
         </span>
        ) : (
          <button
            ref={monthBtnRef}
           type="button"
            onClick={handleOpenPicker}
            className="font-sora text-sm font-semibold text-white min-w-[130px] text-center hover:text-green transition-colors touch-manipulation select-none"
          >
            {monthLabel}
          </button>
        )}

          <button
           onClick={goToNext}
            disabled={isLatest || !!searchNote}
            className={cn(
             'h-8 w-8 flex items-center justify-center rounded-lg border font-sora text-sm transition-colors touch-manipulation',
              (isLatest || searchNote)
               ? 'border-line text-line cursor-default'
               : 'border-line bg-navy text-soft hover:text-white hover:border-soft',
           )}
          >
           ›
          </button>

        </div>
      </div>

      {/* ── MOBILE SUMMARY CARDS (hidden on lg) ── */}
      <div className="lg:hidden grid grid-cols-3 gap-2 px-4 py-2.5 border-b border-line bg-navy/30 flex-none">
        <SummaryCard label="Inflow"    amount={income}        isPositive compact />
        <SummaryCard label="Outflow"  amount={expense}       isPositive={false} compact />
        <SummaryCard label="Netflow" amount={Math.abs(net)} isPositive={net >= 0} compact />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          CONTENT AREA
          Mobile: single column toggled by ViewToggle
          Laptop: 2-column — table LEFT, calendar RIGHT (no toggle needed)
      ══════════════════════════════════════════════════════════════ */}
      <div className={cn(
        'flex-1 min-h-0 overflow-hidden',
        'lg:flex lg:flex-row lg:flex-none lg:h-[92vh] lg:overflow-hidden',
      )}>

        {/* LEFT: Transaction Table */}
        <div className={cn(
          // Mobile: visible only in table mode
          showCalendar ? 'hidden' : 'flex flex-col h-full',
          // Laptop: always visible, left half
          'lg:flex lg:flex-col lg:flex-2 lg:min-w-0 lg:overflow-hidden lg:border-r lg:border-line',
        )}>
          <TransactionTableWidget
            key={`txn-${widgetKey}`}
            filters={activeFilters}
            initialYear={selectedYear}
            initialMonth={selectedMonth}
            showMonthNav={false}
            onDateGroupSelect={openSheet}
            className="flex-1 min-h-0 w-full"
          />
        </div>

        {/* RIGHT: Calendar */}
        <div className={cn(
          // Mobile: visible only in calendar mode
          showCalendar ? 'flex flex-col h-full' : 'hidden',
          // Laptop: always visible, right half, scrollable
          'lg:flex lg:flex-col lg:flex-1 lg:min-w-0 lg:overflow-y-auto lg:p-4 scroll-safe-bottom',
        )}>
          <CalendarWidget
            key={`cal-${widgetKey}`}
            filters={activeFilters}
            initialYear={selectedYear}
            initialMonth={selectedMonth}
            hideHeader
          />
        </div>

      </div>

      {/* ── MONTH PICKER POPUP ── */}
      
        {pickerOpen && pickerPos && (
          <MonthPicker
            currentYear={selectedYear}
           currentMonth={selectedMonth}
           pos={pickerPos}
            onSelect={(y, m) => { setSelectedYear(y); setSelectedMonth(m) }}
            onClose={() => { setPickerOpen(false); setPickerPos(null) }}
          />
        )}

      {/* ── FAB + SHEET ── */}
      <FAB onClick={() => openSheet()} />
      <AddTransactionSheet isOpen={sheetOpen} onClose={closeSheet} initialDate={sheetInitialDate} />

    </div>
  )
}
