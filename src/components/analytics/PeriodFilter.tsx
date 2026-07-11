// src/components/analytics/PeriodFilter.tsx
//
// The shared Period filter (applies to BOTH tabs).
//
// Button row:  [ ‹ ]  [ Apr – Jun 2026 ]  [ › ]
//   ‹ / ›  jump by the CURRENT selection length (1 month → ±1; a 3-month
//          range → ±3, so Apr–Jun becomes Jan–Mar). Never past the
//          current real month.
//
// Popover:
//   • year nav (‹ year ›), 12-month grid, Today, Apply
//   • two-click range: 1st click = anchor (highlighted); 2nd click =
//     select the contiguous span anchor..target (either direction),
//     capped at MAX_RANGE_MONTHS (6). A 3rd click starts a new anchor.
//   • future months disabled
//   • nothing changes until Apply is pressed (draft state).

import { useState, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { periodLabel } from '@/lib/analyticsFormat'
import {
  MAX_RANGE_MONTHS, ym, currentYM, addMonths, splitYM, enumerateMonths,
} from '@/lib/analyticsScope'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface Props {
  months:    string[]                  // current applied selection (ascending, contiguous)
  onChange:  (months: string[]) => void
}

export function PeriodFilter({ months, onChange }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState<{ top: number; left: number } | null>(null)

  const cur   = currentYM()
  const count = months.length || 1
  const last  = months[months.length - 1] ?? cur

  // ‹ / › jump by the current selection length.
  const canNext = addMonths(last, count) <= cur
  function jump(dir: -1 | 1) {
    const shifted = months.map(m => addMonths(m, dir * count))
    if (dir === 1 && shifted[shifted.length - 1] > cur) return
    onChange(shifted)
  }

  function openPicker() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const w = 300, margin = 8
      const cl = r.left + r.width / 2 - w / 2
      setPos({ top: r.bottom + 6, left: Math.max(margin, Math.min(cl, window.innerWidth - w - margin)) })
    }
    setOpen(true)
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button onClick={() => jump(-1)} aria-label="Previous period"
          className="h-8 w-7 flex items-center justify-center rounded-lg border border-line bg-navy font-sora text-sm text-soft hover:text-white hover:border-soft transition-colors">
          ‹
        </button>

        <button ref={btnRef} onClick={openPicker}
          className="h-8 rounded-lg border border-line bg-navy px-3 font-sora text-xs font-semibold text-white hover:border-blue hover:text-blue transition-colors select-none whitespace-nowrap">
          {periodLabel(months)}
        </button>

        <button onClick={() => jump(1)} disabled={!canNext} aria-label="Next period"
          className={cn('h-8 w-7 flex items-center justify-center rounded-lg border font-sora text-sm transition-colors',
            canNext ? 'border-line bg-navy text-soft hover:text-white hover:border-soft'
                    : 'border-line text-line cursor-default')}>
          ›
        </button>
      </div>

      {open && pos && (
        <PeriodPopover
          months={months} pos={pos}
          onApply={m => { onChange(m); setOpen(false) }}
          onClose={() => { setOpen(false); setPos(null) }} />
      )}
    </>
  )
}

// ── Popover ─────────────────────────────────────────────────────────
function PeriodPopover({ months, pos, onApply, onClose }: {
  months:  string[]
  pos:     { top: number; left: number }
  onApply: (months: string[]) => void
  onClose: () => void
}) {
  const now = new Date()
  const cur = currentYM()

  // Draft selection (nothing commits until Apply).
  const [draft, setDraft]   = useState<string[]>(months)
  const [anchor, setAnchor] = useState<string | null>(null)
  const [py, setPy]         = useState(splitYM(months[0] ?? cur).year)

  // Keep the popover fully on-screen (phones: it can open near the bottom).
  const panelRef = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(pos.top)
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    const margin = 8
    let t = pos.top
    if (t + el.offsetHeight > window.innerHeight - margin) t = window.innerHeight - el.offsetHeight - margin
    setTop(Math.max(margin, t))
  }, [pos.top])

  function isFuture(y: number, m: number) {
    return y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1)
  }

  function clickMonth(y: number, m: number) {
    if (isFuture(y, m)) return
    const key = ym(y, m)

    // No anchor yet (or we already have a committed span) → start fresh.
    if (!anchor) {
      setAnchor(key)
      setDraft([key])
      return
    }

    // Second click → contiguous span anchor..key (either direction), capped at 6.
    const [lo, hi] = anchor <= key ? [anchor, key] : [key, anchor]
    let span = enumerateMonths(lo, hi)
    if (span.length > MAX_RANGE_MONTHS) {
      // Keep the 6 months nearest the anchor, preserving the drag direction.
      span = anchor <= key
        ? enumerateMonths(anchor, addMonths(anchor, MAX_RANGE_MONTHS - 1))
        : enumerateMonths(addMonths(anchor, -(MAX_RANGE_MONTHS - 1)), anchor)
    }
    setDraft(span)
    setAnchor(null)   // span committed → next click starts a new anchor
  }

  function goToday() {
    setPy(now.getFullYear())
    setDraft([cur])
    setAnchor(null)
  }

  const draftSet = new Set(draft)
  const overCap  = false // span is capped at selection time, never exceeds 6

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 animate-fade-in" onClick={onClose} />
      <div ref={panelRef}
        className="fixed z-[61] w-[300px] rounded-2xl bg-card border border-line shadow-2xl p-4 animate-fade-in-scale"
        style={{ top, left: pos.left }}>

        {/* Year nav */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setPy(y => y - 1)}
            className="h-8 w-8 flex items-center justify-center rounded-lg font-sora text-base text-soft hover:text-white hover:bg-panel transition-colors">‹</button>
          <span className="font-sora text-base font-bold text-white">{py}</span>
          <button onClick={() => setPy(y => Math.min(y + 1, now.getFullYear()))}
            disabled={py >= now.getFullYear()}
            className={cn('h-8 w-8 flex items-center justify-center rounded-lg font-sora text-base transition-colors',
              py >= now.getFullYear() ? 'text-line cursor-default' : 'text-soft hover:text-white hover:bg-panel')}>›</button>
        </div>

        {/* Hint */}
        <p className="mb-2 font-dm text-[10px] text-muted leading-snug">
          {anchor
            ? 'Now pick an end month for the range (max 6), or re-pick to restart.'
            : 'Tap a month, then tap another to select a range (max 6 months).'}
        </p>

        {/* Month grid */}
        <div className="grid grid-cols-4 gap-1.5">
          {MONTHS_SHORT.map((mm, i) => {
            const mNum = i + 1
            const key  = ym(py, mNum)
            const fut  = isFuture(py, mNum)
            const sel  = draftSet.has(key)
            const isAnchor = anchor === key
            const isToday  = key === cur

            return (
              <button key={mm} disabled={fut} onClick={() => clickMonth(py, mNum)}
                className={cn('h-9 rounded-xl font-dm text-sm font-medium transition-all',
                  fut       ? 'text-line cursor-default'
                  : isAnchor ? 'bg-blue text-white ring-2 ring-blue/50'
                  : sel      ? 'bg-blue text-white shadow-sm shadow-blue/30'
                  : isToday  ? 'ring-1 ring-blue text-blue hover:bg-blue/15'
                  :            'text-soft hover:bg-panel hover:text-white')}>
                {mm}
              </button>
            )
          })}
        </div>

        {/* Selection summary */}
        <p className="mt-3 text-center font-dm text-[11px] text-soft">
          {draft.length === 0
            ? 'No months selected'
            : `${periodLabel(draft)} · ${draft.length} month${draft.length > 1 ? 's' : ''}`}
        </p>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button onClick={goToday}
            className="flex-1 rounded-xl border border-line py-2.5 font-dm text-xs text-soft hover:text-white transition-colors">
            Today
          </button>
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-line py-2.5 font-dm text-xs text-soft hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={() => draft.length > 0 && onApply(draft)}
            disabled={draft.length === 0 || overCap}
            className={cn('flex-1 rounded-xl py-2.5 font-sora text-xs font-semibold transition-all',
              draft.length === 0 ? 'bg-line text-muted cursor-not-allowed'
                                 : 'bg-blue text-white hover:opacity-90 active:scale-[0.98]')}>
            Apply
          </button>
        </div>
      </div>
    </>
  )
}
