// src/pages/dashboard/BudgetPage.tsx
import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { monthKey, monthLabel, parseMonthKey } from '@/lib/budgetFormat'
import { useBudgetTable }       from '@/hooks/useBudgetTable'
import { useBudgetSummary }     from '@/hooks/useBudgetSummary'
import { useEnsureMonthBudget } from '@/hooks/useEnsureMonthBudget'
import { BudgetTable }   from '@/components/budget/BudgetTable'
import { SummaryCards }  from '@/components/budget/SummaryCards'
import { NwsRatioPopup } from '@/components/budget/NwsRatioPopup'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function BudgetPage() {
  const now = new Date()
  const [month, setMonth] = useState<string>(monthKey(now.getFullYear(), now.getMonth() + 1))
  const [showAll, setShowAll] = useState(false)

  // Popups
  const [nwsOpen, setNwsOpen] = useState(false)
  const [nwsRect, setNwsRect] = useState<DOMRect | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null)

  const nwsBtnRef   = useRef<HTMLButtonElement>(null)
  const monthBtnRef = useRef<HTMLButtonElement>(null)

  // Data
  const { data: rows = [], isLoading: rowsLoading } = useBudgetTable(month)
  const { data: summary, isLoading: sumLoading }    = useBudgetSummary(month)

  // Lazy auto-copy for empty months
  useEnsureMonthBudget(month, rows, rowsLoading)

  const { year, month: m } = parseMonthKey(month)
  const isCurrentMonth = year === now.getFullYear() && m === now.getMonth() + 1

  // ── Month navigation ──────────────────────────────────────────────
  function goPrev() {
    const d = new Date(year, m - 2, 1)
    setMonth(monthKey(d.getFullYear(), d.getMonth() + 1))
  }
  function goNext() {
    if (isCurrentMonth) return
    const d = new Date(year, m, 1)
    setMonth(monthKey(d.getFullYear(), d.getMonth() + 1))
  }
  function goToday() {
    setMonth(monthKey(now.getFullYear(), now.getMonth() + 1))
  }

  function openNws() {
    if (nwsBtnRef.current) setNwsRect(nwsBtnRef.current.getBoundingClientRect())
    setNwsOpen(true)
  }
  function openPicker() {
    if (monthBtnRef.current) setPickerRect(monthBtnRef.current.getBoundingClientRect())
    setPickerOpen(true)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden lg:overflow-hidden">

      {/* ══ STICKY TOP HEADER ══ */}
      <div className="flex-none border-b border-line bg-card z-40"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>

        {/* Row 1: title + controls */}
        <div className="flex items-center gap-2 px-4 pb-2 flex-wrap">
          <h1 className="font-sora text-xl font-bold text-white leading-none mr-auto">Budget</h1>

          {/* Show all toggle */}
          <button onClick={() => setShowAll(v => !v)}
            className="flex items-center gap-2 touch-manipulation">
            <span className={cn('font-dm text-[11px]', showAll ? 'text-green' : 'text-soft')}>
              Show all
            </span>
            <span className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              showAll ? 'bg-green' : 'bg-line')}>
              <span className={cn('absolute h-3.5 w-3.5 rounded-full bg-white transition-transform',
                showAll ? 'translate-x-[18px]' : 'translate-x-[3px]')} />
            </span>
          </button>

          {/* NWS ratio */}
          <button ref={nwsBtnRef} onClick={openNws}
            className="rounded-lg border border-line px-3 py-1.5 font-dm text-xs text-soft hover:border-green hover:text-green transition-colors touch-manipulation">
            NWS ratio
          </button>

          {/* Month selector */}
          <div className="flex items-center gap-1">
            <button onClick={goPrev}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-line bg-navy font-sora text-sm text-soft hover:text-white hover:border-soft transition-colors">
              ‹
            </button>
            <button ref={monthBtnRef} onClick={openPicker}
              className="font-sora text-sm font-semibold text-white min-w-[120px] text-center hover:text-green transition-colors touch-manipulation">
              {monthLabel(month)}
            </button>
            <button onClick={goNext} disabled={isCurrentMonth}
              className={cn('h-8 w-8 flex items-center justify-center rounded-lg border font-sora text-sm transition-colors',
                isCurrentMonth ? 'border-line text-line cursor-default' : 'border-line bg-navy text-soft hover:text-white hover:border-soft')}>
              ›
            </button>
          </div>

          {/* Today */}
          <button onClick={goToday}
            className={cn('rounded-lg border px-3 py-1.5 font-dm text-xs transition-colors touch-manipulation',
              isCurrentMonth ? 'border-line text-muted cursor-default' : 'border-green/40 text-green hover:bg-green/10')}>
            Today
          </button>
        </div>
      </div>


      {/* ══ BODY ══ */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-safe-bottom">
        <div className="lg:flex lg:gap-4 lg:px-4 lg:py-4">

          {/* Sectional table — 3/4 */}
          <div className="lg:flex-[3] lg:min-w-0 px-2 py-3 lg:p-0">
            <BudgetTable rows={rows} month={month} showAll={showAll} />
          </div>

          {/* Summary cards — 1/4, sticky on laptop */}
          <div className="lg:flex-1 lg:max-w-[26%] px-3 pb-6 lg:p-0">
            <div className="lg:sticky lg:top-2">
              <SummaryCards summary={summary} month={month} loading={sumLoading} />
            </div>
          </div>
        </div>
      </div>

      {/* ══ POPUPS ══ */}
      {nwsOpen && nwsRect && (
        <NwsRatioPopup anchorRect={nwsRect} onClose={() => { setNwsOpen(false); setNwsRect(null) }} />
      )}

      {pickerOpen && pickerRect && (
        <MonthPicker
          month={month} rect={pickerRect}
          onSelect={(y, mm) => { setMonth(monthKey(y, mm)); setPickerOpen(false) }}
          onClose={() => { setPickerOpen(false); setPickerRect(null) }}
        />
      )}
    </div>
  )
}

// ── Month picker popup ────────────────────────────────────────────
function MonthPicker({ month, rect, onSelect, onClose }: {
  month: string
  rect: DOMRect
  onSelect: (year: number, month: number) => void
  onClose: () => void
}) {
  const now = new Date()
  const { year: curY, month: curM } = parseMonthKey(month)
  const [py, setPy] = useState(curY)

  const width = 288, margin = 8
  let left = rect.left + rect.width / 2 - width / 2
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
  const top = rect.bottom + 6

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 animate-fade-in" onClick={onClose} />
      <div className="fixed z-[61] w-72 rounded-2xl bg-card border border-line shadow-2xl p-4 animate-fade-in-scale"
        style={{ top, left }}>
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
          {MONTHS_SHORT.map((mm, i) => {
            const mNum = i + 1
            const isSel = py === curY && mNum === curM
            const isToday = py === now.getFullYear() && mNum === now.getMonth() + 1
            const isFut = py > now.getFullYear() || (py === now.getFullYear() && mNum > now.getMonth() + 1)
            return (
              <button key={mm} disabled={isFut}
                onClick={() => { if (!isFut) onSelect(py, mNum) }}
                className={cn('h-9 rounded-xl font-dm text-sm font-medium transition-all',
                  isFut ? 'text-line cursor-default'
                  : isSel ? 'bg-green text-white shadow-sm shadow-green/30'
                  : isToday ? 'ring-1 ring-green text-green hover:bg-green/15'
                  : 'text-soft hover:bg-panel hover:text-white')}>
                {mm}
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
