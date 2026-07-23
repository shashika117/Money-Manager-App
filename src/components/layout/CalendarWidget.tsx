/**
 * CalendarWidget.tsx — updated with all adjustments:
 *  1. hideHeader prop: removes internal month nav + title
 *  2. No sign (+/−) on date cell amounts (color only)
 *  3. DayOverlay z-index raised to z-50 (above FAB at z-40)
 *  4. DayOverlay: right-half panel on laptop, bottom sheet on mobile
 *  5. DayOverlay uses responsive animations
 */

import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useTransactions } from '@/hooks/useTransactions'
import type { DateGroup }  from '@/hooks/useTransactions'
import {
  type TransactionFilters,
  applyFilters,
} from '@/lib/transactionFilters'
import { TransactionTableWidget } from '@/components/layout/TransactionTableWidget'
import { AddTransactionSheet }    from '@/components/forms/AddTransactionSheet'

// ── Types ──────────────────────────────────────────────────────────
interface DayData {
  total_income:      number
  total_expense:     number
  transaction_count: number
}

interface CalendarCell {
  type:        'day' | 'padding'
  date?:       string
  dayOfMonth?: number
  colIndex:    number
}

export interface CalendarWidgetProps {
  filters?:      Omit<TransactionFilters, 'date'>
  initialYear?:  number
  initialMonth?: number
  className?:    string
  /** When true, hides the internal month navigation header */
  hideHeader?:   boolean
}

// ── Constants ──────────────────────────────────────────────────────
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as const
const WEEKEND   = new Set([5, 6])

// ── Helpers ────────────────────────────────────────────────────────
function todayLocal(): string {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
}

// ── Standard amount: 100,000.00 — no sign, no currency ─────────────
function fmtAmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/* Compact amount — NO sign prefix 
function fmtCompact1(n: number): string {
  if (n <= 0)         return ''
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n >= 10_000)    return `${Math.round(n/1_000)}K`
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`
  return Math.round(n).toString()
}
  */

function fmtFullDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function buildCells(year: number, month: number): CalendarCell[] {
  const firstDayJS  = new Date(year, month - 1, 1).getDay()
  const startOffset = (firstDayJS + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: CalendarCell[] = []
  for (let i = 0; i < startOffset; i++) cells.push({ type: 'padding', colIndex: i })
  for (let d = 1; d <= daysInMonth; d++) {
    const colIndex = (startOffset + d - 1) % 7
    cells.push({
      type: 'day', dayOfMonth: d,
      date: `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
      colIndex,
    })
  }
  const rem = cells.length % 7
  if (rem > 0) for (let i = 0; i < 7 - rem; i++) cells.push({ type: 'padding', colIndex: (cells.length) % 7 })
  return cells
}

function buildDayDataMap(groups: DateGroup[]): Map<string, DayData> {
  const map = new Map<string, DayData>()
  for (const g of groups) {
    map.set(g.date, {
      total_income:      g.total_income,
      total_expense:     g.total_expense,
      transaction_count: g.transactions.length,
    })
  }
  return map
}

// ── Detect laptop breakpoint (lg = 1024px) ─────────────────────────
function useIsLaptop(): boolean {
  const [isLg, setIsLg] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsLg(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isLg
}

// ── Month nav hook (kept for data fetching even when header hidden) ─
function useMonthNav(seedYear: number, seedMonth: number) {
  const [year,      setYear]      = useState(seedYear)
  const [month,     setMonth]     = useState(seedMonth)
  const [direction, setDirection] = useState<'left'|'right'>('left')
  const [animKey,   setAnimKey]   = useState(0)

  function prev() { setDirection('right'); setAnimKey(k=>k+1); if (month===1){setYear(y=>y-1);setMonth(12)}else setMonth(m=>m-1) }
  function next() {
    const now = new Date()
    if (year>now.getFullYear()||(year===now.getFullYear()&&month>=now.getMonth()+1)) return
    setDirection('left'); setAnimKey(k=>k+1)
    if (month===12){setYear(y=>y+1);setMonth(1)}else setMonth(m=>m+1)
  }
  const [mn, ys] = new Date(year, month-1, 1)
    .toLocaleDateString('en-US',{month:'long',year:'numeric'}).split(' ')
  return { year, month, prev, next, monthName: mn, yearStr: ys, direction, animKey }
}

// ── Filter pills ───────────────────────────────────────────────────
function FilterPills({ filters }: { filters: Omit<TransactionFilters,'date'> }) {
  const pills: {key:string;label:string}[] = []
  if (filters.type)        pills.push({key:'type',  label: filters.type})
  if (filters.account)     pills.push({key:'acc',   label: `🏦 ${filters.account}`})
  if (filters.category)    pills.push({key:'cat',   label: `📂 ${filters.category}`})
  if (filters.subCategory) pills.push({key:'sub',   label: `• ${filters.subCategory}`})
  if ((filters as any).excludeSinkingFunds) pills.push({key:'sf', label: 'Excl. Sinking Funds'})
  if (pills.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-line/40 bg-card/60 animate-fade-in flex-none">
      <span className="font-dm text-[10px] text-muted self-center">Filtered:</span>
      {pills.map(p => (
        <span key={p.key} className="inline-flex items-center rounded-full border border-green/30 bg-green/10 px-2 py-0.5 font-dm text-[10px] text-green">
          {p.label}
        </span>
      ))}
    </div>
  )
}

// ── Day cell ───────────────────────────────────────────────────────
interface DayCellProps {
  cell:      CalendarCell
  data?:     DayData
  isToday:   boolean
  isWeekend: boolean
  onClick:   (date: string) => void
}
function DayCell({ cell, data, isToday, isWeekend, onClick }: DayCellProps) {
  const base = cn('min-h-[68px] border-r border-b border-line/25', isWeekend ? 'bg-navy/50' : 'bg-card')
  if (cell.type === 'padding') return <div className={base} aria-hidden />
  const hasData = data && (data.total_income > 0 || data.total_expense > 0)
  return (
    <button type="button" onClick={() => onClick(cell.date!)}
      className={cn(base, 'flex flex-col items-start p-1.5 touch-manipulation transition-colors duration-150',
        isWeekend ? 'hover:bg-panel/70' : 'hover:bg-panel/50', 'active:brightness-110',
        hasData && 'ring-inset ring-1 ring-line/30')}>
      <span className={cn('inline-flex h-[18px] w-[18px] items-center justify-center rounded-full font-sora text-[10px] font-bold leading-none',
        isToday ? 'bg-green text-white ring-2 ring-green/40'
        : isWeekend ? 'text-muted' : 'text-white')}>
        {cell.dayOfMonth}
      </span>
      {/* Income — no sign, green color only */}
      {data && data.total_income > 0 && (
        <span className="mt-1 font-dm text-[10px] font-medium leading-none text-green truncate w-full">
          {fmtAmt(data.total_income)}
        </span>
      )}
      {/* Expense — no sign, red color only */}
      {data && data.total_expense > 0 && (
        <span className="mt-0.5 font-dm text-[10px] font-medium leading-none text-red truncate w-full">
          {fmtAmt(data.total_expense)}
        </span>
      )}
    </button>
  )
}

// ── Day overlay ────────────────────────────────────────────────────
interface DayOverlayProps {
  selectedDate:     string
  inheritedFilters: Omit<TransactionFilters,'date'>
  onClose:          () => void
}
function DayOverlay({ selectedDate, inheritedFilters, onClose }: DayOverlayProps) {
  const [closing,      setClosing]      = useState(false)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const isLaptop = useIsLaptop()

  function handleClose() { setClosing(true); setTimeout(onClose, 240) }

  // Responsive position + animation
  const panelCls = cn(
    'fixed z-50 flex flex-col overflow-hidden shadow-2xl bg-navy',
    // Mobile: bottom sheet
    !isLaptop && 'inset-x-0 bottom-0 rounded-t-2xl h-[67dvh]',
    // Laptop: right half of screen, full height
    isLaptop  && 'inset-y-0 right-0 border-l border-line',
  )
  // Use inline style for left on laptop to be exact
  const panelStyle = isLaptop ? { left: '65%' } : undefined

  const enterAnim = isLaptop ? 'animate-slide-in-right'  : 'animate-slide-up'
  const exitAnim  = isLaptop ? 'animate-slide-out-right' : 'animate-slide-down'

  return (
    <>
      <div
  className={cn('fixed inset-0 z-[45] bg-black/70', closing ? 'animate-fade-out' : 'animate-fade-in')}
  onClick={handleClose} aria-hidden />

      <div className={cn(panelCls, closing ? exitAnim : enterAnim)}
        style={{ ...(panelStyle || {}), paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* Drag handle (mobile only) */}
        {!isLaptop && (
          <div className="flex justify-center pt-3 pb-1 flex-none">
            <div className="h-1 w-10 rounded-full bg-line" />
          </div>
        )}

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-card px-5 py-3 flex-none"
          style={isLaptop ? { paddingTop: 'calc(env(safe-area-inset-top) + 12px)' } : undefined}>
          <div>
            <p className="font-dm text-[10px] uppercase tracking-widest text-soft mb-0.5">
              Transactions for
            </p>
            <h3 className="font-sora text-sm font-bold text-white leading-snug">
              {fmtFullDate(selectedDate)}
            </h3>
          </div>
          <button onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-panel font-sora text-soft transition-colors hover:text-white active:scale-95"
            aria-label="Close">
            ✕
          </button>
        </div>

        {/* Transaction list for this date.
            z-[55] on the FAB keeps it above this panel (z-50).
            AddTransactionSheet (z-50) renders last in DOM → stacks on top naturally. */}
        <TransactionTableWidget
          filters={{ ...inheritedFilters, date: selectedDate }}
          showMonthNav={false}
          className="flex-1 min-h-0"
        />
      </div>

      {/* ── FAB: add transaction for the selected date ──
          z-[55] = above DayOverlay panel (z-50) but below the sheet.
          On mobile: sits above the 67dvh sheet bottom.
          On laptop: standard bottom-right corner position. */}

      {!addSheetOpen && (
       <button
         type="button"
          onClick={() => setAddSheetOpen(true)}
         aria-label="Add transaction for this date"
          className={cn(
           "fixed z-[45] h-14 w-14 rounded-full bg-green shadow-lg shadow-green/30 flex items-center justify-center font-sora text-2xl font-light text-white transition-all active:scale-90 touch-manipulation animate-fade-in",
      
           // 🎯 THE FIX: Tie the animation to the 'closing' state
           closing ? "animate-fade-out pointer-events-none" : "animate-fade-in",

            // MOBILE: Anchor to the right side
           "right-5",
      
            // LAPTOP: Cancel right alignment, push to 50% width, and translate back by half its own width to center it perfectly
           "lg:right-auto lg:left-3/5"
          )}
          // Your vertical positioning logic stays exactly how you want it:
         style={{ bottom: isLaptop ? '24px' : 'calc(67dvh + 12px)' }}
        >
          +
       </button>
)}

      {/* AddTransactionSheet — pre-fills date with the clicked calendar day */}
      <AddTransactionSheet
        isOpen={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        initialDate={selectedDate}
      />
    </>
  )
}

// ════════════════════════════════════════════════════════════════════
// CALENDAR WIDGET
// ════════════════════════════════════════════════════════════════════
export function CalendarWidget({
  filters = {},
  initialYear,
  initialMonth,
  className,
  hideHeader = false,
}: CalendarWidgetProps) {
  const now = new Date()
  const nav = useMonthNav(
    initialYear  ?? now.getFullYear(),
    initialMonth ?? now.getMonth() + 1,
  )

  const { data: allGroups = [], isLoading } = useTransactions(nav.year, nav.month)

  const filteredGroups = useMemo(
    () => applyFilters(allGroups, filters as TransactionFilters),
    [allGroups, filters],
  )
  const dayDataMap = useMemo(() => buildDayDataMap(filteredGroups), [filteredGroups])
  const cells      = useMemo(() => buildCells(nav.year, nav.month), [nav.year, nav.month])

  const today                = todayLocal()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const gridAnimClass = nav.direction === 'left' ? 'animate-none' : 'animate-slide-from-right'
  const [mn, ys]      = nav.monthName ? [nav.monthName, nav.yearStr] : ['', '']

  return (
    <div className={cn('flex flex-col rounded-2xl border border-line bg-card overflow-hidden', className)}>

      {/* ── Internal header (hidden when hideHeader=true) ── */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-none">
          <div className="leading-none">
            <span className="font-sora text-base font-bold text-white">{mn}</span>
            {' '}
            <span className="font-sora text-base font-normal text-soft">{ys}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={nav.prev} className="h-8 w-8 flex items-center justify-center rounded-lg border border-line bg-navy font-sora text-sm text-soft transition-colors hover:border-soft hover:text-white active:scale-95 touch-manipulation" aria-label="Previous month">‹</button>
            <button onClick={nav.next} className="h-8 w-8 flex items-center justify-center rounded-lg border border-line bg-navy font-sora text-sm text-soft transition-colors hover:border-soft hover:text-white active:scale-95 touch-manipulation" aria-label="Next month">›</button>
          </div>
        </div>
      )}

      {/* ── Filter pills ── */}
      <FilterPills filters={filters} />

      {/* ── Day name header ── */}
      <div className="grid grid-cols-7 border-b border-line/40 flex-none">
        {DAY_NAMES.map((name, idx) => (
          <div key={name} className={cn('py-1.5 text-center border-r border-line/25 last:border-r-0', WEEKEND.has(idx) ? 'bg-navy/50' : 'bg-card')}>
            <span className={cn('font-dm text-[10px] font-semibold uppercase tracking-wide', WEEKEND.has(idx) ? 'text-muted' : 'text-soft')}>
              {name}
            </span>
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10 flex-none">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-green border-t-transparent" />
        </div>
      ) : (
        <div key={nav.animKey} className={cn('grid grid-cols-7 border-l border-t border-line/25 flex-none', gridAnimClass)}>
          {cells.map((cell, idx) => (
            <DayCell
              key={cell.date ?? `pad-${idx}`}
              cell={cell}
              data={cell.date ? dayDataMap.get(cell.date) : undefined}
              isToday={cell.date === today}
              isWeekend={WEEKEND.has(cell.colIndex)}
              onClick={setSelectedDate}
            />
          ))}
        </div>
      )}

      {/* ── Day overlay (z-50, above FAB at z-40) ── */}
      {selectedDate && (
        <DayOverlay
          selectedDate={selectedDate}
          inheritedFilters={filters}
          onClose={() => setSelectedDate(null)}
        />
      )}

    </div>
  )
}
