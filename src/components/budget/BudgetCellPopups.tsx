// src/components/budget/BudgetCellPopups.tsx
//
// Three popups anchored next to a clicked cell:
//   BudgetEditPopup    — Template card + Last-month card + Monthly-avg
//                        + 3-month column chart + "Apply to all future months"
//   RemainingPopup     — breakdown card (Rollover / Budget / Actual / Remaining)
//   (Actual cell uses the existing CalendarWidget in a small floating panel —
//    see ActualCalendarPopup below.)

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { fmtAmt, fmtAmtSigned, savingActualColor, incomeRemainingColor, savingRemainingColor, expenseRemainingColor } 
from '@/lib/budgetFormat'

import { useSubcatHistory } from '@/hooks/useSubcatHistory'
import { CalendarWidget } from '@/components/layout/CalendarWidget'
import type { BudgetRow } from '@/hooks/useBudgetTable'

// ── Shared anchored-popup shell ───────────────────────────────────
// Positions a floating card to the LEFT of the cell (desktop) or
// centered (mobile). Closes on outside click / Esc.
function AnchoredPopup({
  anchorRect, onClose, children, width = 320,
}: {
  anchorRect: DOMRect
  onClose:    () => void
  children:   React.ReactNode
  width?:     number
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Start with a best-guess position, then refine once we can measure
  // the popup's real rendered height (so tall popups never overflow).
  const [pos, setPos] = useState<{ left: number; top: number }>(() => {
    const margin = 8
    let left = anchorRect.left - width - 10
    if (left < margin) left = anchorRect.right + 10
    if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin
    return { left, top: anchorRect.top }
  })

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // After first paint, measure real height and clamp so the popup's
  // bottom edge never goes past the viewport (with a safe margin that
  // clears bottom UI like the mobile nav bar).
  useEffect(() => {
    if (!ref.current) return
    const margin       = 8
    const bottomSafe   = 80   // clearance for bottom nav / OS bars
    const h            = ref.current.offsetHeight
    const maxTop       = window.innerHeight - h - bottomSafe

    // Prefer aligning the popup's vertical centre to the cell's centre,
    // but never let it start above the top margin or end past maxTop.
    let top = anchorRect.top + anchorRect.height / 2 - h / 2
    top = Math.max(margin, Math.min(top, Math.max(margin, maxTop)))

    // Horizontal: keep the left-of-cell preference, re-clamp.
    let left = anchorRect.left - width - 10
    if (left < margin) left = anchorRect.right + 10
    if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin

    setPos({ left, top })
  }, [anchorRect, width])

  return (
    <>
      <div className="fixed inset-0 z-[60]" onMouseDown={onClose} />
      <div
        ref={ref}
        className="fixed z-[61] rounded-2xl border border-line bg-card shadow-2xl animate-fade-in-scale"
        style={{ left: pos.left, top: pos.top, width }}
        onMouseDown={e => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════
// BUDGET EDIT POPUP
// ════════════════════════════════════════════════════════════════
interface BudgetEditPopupProps {
  row:         BudgetRow
  month:       string
  anchorRect:  DOMRect
  onClose:     () => void
  onSave:      (amount: number, applyFuture: boolean) => void
  saving:      boolean
}
export function BudgetEditPopup({
  row, month, anchorRect, onClose, onSave, saving,
}: BudgetEditPopupProps) {
  const isGoal = row.section === 'Savings'
  const { data: hist, isLoading } = useSubcatHistory(
    month,
    isGoal ? undefined : row.ex_sub_category,
    isGoal ? row.ex_sub_category : undefined,
    3,
    true,
  )

  const [applyFuture, setApplyFuture] = useState(false)
  const [draft, setDraft] = useState<string>(row.budget ? String(row.budget) : '')
  const inputRef = useRef<HTMLInputElement>(null)

  // Autofocus the input when the popup opens
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  function commit() {
    const amount = parseFloat(draft)
    if (isNaN(amount) || amount < 0) return
    onSave(amount, applyFuture)
  }

  // Chart geometry
  const points = hist?.points ?? []
  const maxVal = Math.max(...points.map(p => p.amount), 1)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  // Income progress colour cue: income bars green, others red-ish accent
  const barColor = 
    row.section === 'Income' ? '#10b981' 
    : row.section === 'Expense' ? '#ef4444' 
    : '#44b9ef'

  return (
    <AnchoredPopup anchorRect={anchorRect} onClose={onClose} width={340}>
      <div className="p-4">
        {/* Inline editable budget input */}
        <label className="mb-1 block font-dm text-[10px] uppercase tracking-wider text-soft">
          {isGoal ? 'Goal budget' : 'Budget'} · {row.ex_sub_category}
        </label>
        <input
          ref={inputRef}
          type="number" min={0} step="0.01" inputMode="decimal"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit() }}
          placeholder="0.00"
          className="w-full rounded-xl border border-line bg-panel px-3 py-2.5 mb-3 font-sora text-base text-white outline-none focus:border-green transition-colors"
        />

        <p className="font-sora text-sm font-bold text-white mb-3">History</p>

        {/* Template + Last-month + average cards */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Template Budget */}
          <div className="rounded-xl bg-navy/60 border border-line p-2.5">
            <p className="font-sora text-sm font-bold text-white">
              {row.template_budget == null ? '—' : fmtAmt(row.template_budget)}
            </p>
            <p className="font-dm text-[10px] text-soft mt-0.5">Template Budget</p>
          </div>
          {/* Monthly average */}
          <div className="rounded-xl bg-navy/60 border border-line p-2.5">
            <p className="font-sora text-sm font-bold text-white">
              {fmtAmt(hist?.average ?? 0)}
            </p>
            <p className="font-dm text-[10px] text-soft mt-0.5">Monthly average</p>
          </div>
        </div>

        {/* 3-month column chart */}
        <div className="rounded-xl bg-navy/40 border border-line p-3 mb-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-28">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-green border-t-transparent" />
            </div>
          ) : (
            <div className="flex items-end justify-around gap-2 h-28">
              {points.map((p, i) => {
                const h = Math.max((p.amount / maxVal) * 100, p.amount > 0 ? 4 : 0)
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full"
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}>
                    {hoverIdx === i && (
                      <span className="font-dm text-[10px] font-semibold text-white mb-1 whitespace-nowrap">
                        {fmtAmt(p.amount)}
                      </span>
                    )}
                    <div
                      className="w-7 rounded-t-md transition-all duration-300"
                      style={{
                        height: `${h}%`,
                        backgroundColor: barColor,
                        opacity: hoverIdx === null || hoverIdx === i ? 1 : 0.5,
                      }}
                    />
                    <span className="font-dm text-[10px] text-muted mt-1 uppercase">{p.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Apply to all future months */}
        <label className="flex items-center gap-2.5 cursor-pointer mb-1">
          <input
            type="checkbox"
            checked={applyFuture}
            onChange={e => setApplyFuture(e.target.checked)}
            className="h-4 w-4 accent-green rounded"
          />
          <span className="font-dm text-xs text-white">Apply to all future months</span>
        </label>
        <p className="font-dm text-[10px] text-muted leading-snug mb-3">
          Sets the template baseline. Existing future months are never overwritten —
          only brand-new months inherit this value.
        </p>

        {/* Save / Cancel */}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-line py-2.5 font-dm text-xs text-soft hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={commit} disabled={saving}
            className={cn(
              'flex-1 rounded-xl py-2.5 font-sora text-xs font-semibold text-white transition-all',
              saving ? 'bg-green/40 cursor-not-allowed' : 'bg-green hover:opacity-90 active:scale-95',
            )}>
            {saving ? 'Saving…' : 'Save (Enter)'}
          </button>
        </div>
      </div>
    </AnchoredPopup>
  )
}

// ════════════════════════════════════════════════════════════════
// REMAINING POPUP
// ════════════════════════════════════════════════════════════════
interface RemainingPopupProps {
  row:         BudgetRow
  anchorRect:  DOMRect
  onClose:     () => void
}

export function RemainingPopup({ row, anchorRect, onClose }: RemainingPopupProps) {
  const showRollover = row.rollover_enabled && row.section === 'Expense'

  // ── Exact color logic pulled from BudgetTable's SubRow ──
  const actualColor = row.section === 'Savings'
    ? savingActualColor(row.actual)
    : 'text-soft'

  const remainingColor =
    row.section === 'Income'    ? incomeRemainingColor(row.remaining)
    : row.section === 'Savings' ? savingRemainingColor(row.remaining)
    : expenseRemainingColor(row.remaining)

  return (
    <AnchoredPopup anchorRect={anchorRect} onClose={onClose} width={280}>
      <div className="p-4">
        <p className="font-sora text-sm font-bold text-white mb-3">{row.ex_sub_category}</p>
        <div className="space-y-2">
          {showRollover && (
            <Row 
              label="Rollover from previous months" 
              value={row.rollover_amount} 
              colorClass={row.rollover_amount >= 0 ? 'text-soft' : 'text-red'} 
            />
          )}
          
          <Row 
            label="This month's budget" 
            value={row.budget} 
            colorClass="text-soft" 
          />
          
          <Row
            label="Actual"
            // Retaining original popup logic: negating expense actuals so they show as deductions
            value= {row.actual}
            colorClass= {actualColor}
          />
          
          <div className="h-px bg-line my-1" />
          
          <Row 
            label="Remaining" 
            value={row.remaining} 
            bold 
            colorClass={remainingColor}
          />
        </div>
      </div>
    </AnchoredPopup>
  )
}

// ── Cleaned up Row Component ──
function Row({ label, value, bold, colorClass }: {
  label: string; value: number; bold?: boolean; colorClass?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('font-dm text-xs', bold ? 'text-white font-bold' : 'text-soft')}>
        {label}
      </span>
      <span className={cn(
        'font-dm text-xs tabular-nums',
        bold ? 'font-bold' : '',
        colorClass ?? 'text-white'
      )}>
        {/* fmtAmtSigned automatically natively handles the "-" sign for values < 0 */}
        {fmtAmtSigned(value)}
      </span>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ACTUAL CALENDAR POPUP
// Reuses the existing CalendarWidget filtered to this category.
// ════════════════════════════════════════════════════════════════
interface ActualCalendarPopupProps {
  row:        BudgetRow
  month:      string
  anchorRect: DOMRect
  onClose:    () => void
}
export function ActualCalendarPopup({ row, month, anchorRect, onClose }: ActualCalendarPopupProps) {
  const { year, monthNo } = (() => {
    const [y, m] = month.split('-').map(Number)
    return { year: y, monthNo: m }
  })()

  // Filter: income/expense by category; savings has no fact_transaction rows,
  // so we filter by sub-category for income/expense only.
  const filters = row.section === 'Savings'
    ? { } // goals: calendar of transactions not applicable; show category note
    : { category: row.category, subCategory: row.ex_sub_category }

  return (
    <AnchoredPopup anchorRect={anchorRect} onClose={onClose} width={360}>
      <div className="p-3">
        <p className="font-sora text-xs font-bold text-white mb-2 px-1">
          {row.ex_sub_category} · transactions
        </p>
        {row.section === 'Savings' ? (
          <p className="font-dm text-xs text-soft px-1 py-6 text-center">
            Goal allocations are recorded in the Goals ledger, not the
            transaction calendar.
          </p>
        ) : (
          <CalendarWidget
            filters={filters as any}
            initialYear={year}
            initialMonth={monthNo}
            hideHeader
          />
        )}
      </div>
    </AnchoredPopup>
  )
}
