// src/components/goals/FourMonthPicker.tsx
//
// The Goal Savings Table's 4-month slot selector. Instead of 12 months,
// each year shows three slots: "Jan – Apr", "May – Aug", "Sep – Dec".
// A "Today" button jumps to the current month's slot.

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  anchorYear:  number
  anchorMonth: number   // 1-12; determines which slot is highlighted
  pos:         { top: number; left: number }
  onSelect:    (year: number, month: number) => void   // month = first month of chosen slot
  onClose:     () => void
}

const SLOTS: { label: string; startMonth: number }[] = [
  { label: 'Jan – Apr', startMonth: 1 },
  { label: 'May – Aug', startMonth: 5 },
  { label: 'Sep – Dec', startMonth: 9 },
]

function slotOf(month1to12: number): number {
  return month1to12 <= 4 ? 1 : month1to12 <= 8 ? 5 : 9
}

export function FourMonthPicker({ anchorYear, anchorMonth, pos, onSelect, onClose }: Props) {
  const now = new Date()
  const [py, setPy] = useState(anchorYear)
  const activeSlotStart = slotOf(anchorMonth)

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 animate-fade-in" onClick={onClose} />
      <div className="fixed z-[61] w-72 rounded-2xl bg-card border border-line shadow-2xl p-4 animate-fade-in-scale"
        style={{ top: pos.top, left: pos.left }}>

        {/* Year navigator */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setPy(y => y - 1)}
            className="h-8 w-8 flex items-center justify-center rounded-lg font-sora text-base text-soft hover:text-white hover:bg-panel transition-colors">‹</button>
          <span className="font-sora text-base font-bold text-white">{py}</span>
          <button onClick={() => setPy(y => Math.min(y + 1, now.getFullYear()))}
            disabled={py >= now.getFullYear()}
            className={cn('h-8 w-8 flex items-center justify-center rounded-lg font-sora text-base transition-colors',
              py >= now.getFullYear() ? 'text-line cursor-default' : 'text-soft hover:text-white hover:bg-panel')}>›</button>
        </div>

        {/* Three slots */}
        <div className="flex flex-col gap-1.5">
          {SLOTS.map(slot => {
            const isSel = py === anchorYear && slot.startMonth === activeSlotStart
            // A slot is future if its FIRST month is after the current month
            const isFuture = py > now.getFullYear()
              || (py === now.getFullYear() && slot.startMonth > now.getMonth() + 1)
            return (
              <button key={slot.label} disabled={isFuture}
                onClick={() => { if (!isFuture) { onSelect(py, slot.startMonth); onClose() } }}
                className={cn('rounded-xl py-2.5 font-dm text-sm font-medium transition-all',
                  isFuture ? 'text-line cursor-default'
                  : isSel  ? 'bg-cyan text-navy'
                  :          'text-soft hover:bg-panel hover:text-white')}>
                {slot.label}
              </button>
            )
          })}
        </div>

        {/* Today */}
        <button
          onClick={() => { onSelect(now.getFullYear(), slotOf(now.getMonth() + 1)); onClose() }}
          className="mt-4 w-full rounded-xl border border-cyan/40 bg-cyan/10 py-2.5 font-dm text-sm font-medium text-cyan hover:bg-cyan/20 transition-colors">
          Today
        </button>
        <button onClick={onClose}
          className="mt-2 w-full rounded-xl border border-line py-2.5 font-dm text-sm text-soft hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </>
  )
}
