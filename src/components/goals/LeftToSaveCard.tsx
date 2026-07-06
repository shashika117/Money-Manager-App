// src/components/goals/LeftToSaveCard.tsx
//
// Headline card: all-time total of "truly unallocated money still
// available" summed across every month (get_total_left_to_save RPC).
// Positive = green (money still free to allocate); negative = red
// (historically over-allocated relative to capacity).

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { fmtSignedAmt } from '@/lib/goalFormat'
import { useTotalLeftToSave } from '@/hooks/useGoalMisc'

export function LeftToSaveCard() {
  const { data: total, isLoading } = useTotalLeftToSave()
  // Tap-toggle for touch devices (hover has no equivalent on mobile).
  const [infoOpen, setInfoOpen] = useState(false)

  const value = total ?? 0
  const isNeg = value < 0

  const tooltipText = isNeg
    ? 'Across all months, allocations have exceeded available savings.'
    : 'Total unallocated savings still available across all months.'

  return (
    <div className="relative rounded-2xl border border-line bg-card p-5 flex flex-col items-center justify-center text-center min-h-[130px]">

      {/* ── Top-right info icon: hover on desktop, TAP on mobile ── */}
      <div className="absolute top-4 right-4 group z-30">
        <button
          type="button"
          onClick={() => setInfoOpen(v => !v)}
          aria-label="What does this mean?"
          aria-expanded={infoOpen}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-soft/50 text-xs font-bold text-soft hover:text-white hover:border-white transition-colors select-none touch-manipulation"
        >
          !
        </button>

        {/* Tooltip — shown on hover (desktop) OR when tapped open (mobile) */}
        <div className={cn(
          'absolute top-full right-0 mt-1.5 w-44 rounded-xl border border-line bg-navy p-2.5 font-dm text-[11px] leading-snug text-white shadow-xl text-center z-50',
          infoOpen ? 'block' : 'hidden group-hover:block',
        )}>
          {tooltipText}
        </div>
      </div>

      {/* Tap-away layer (mobile): closes the tooltip when tapping elsewhere */}
      {infoOpen && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setInfoOpen(false)}
          className="fixed inset-0 z-20 cursor-default"
        />
      )}

      {/* ── Center content ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center">
          <p className={cn(
            'font-sora text-2xl font-bold leading-none',
            isNeg ? 'text-red' : 'text-green',
          )}>
            {fmtSignedAmt(value)}
          </p>
          <span className="mt-2.5 font-sora text-sm font-normal text-soft">
            LEFT TO SAVE
          </span>
        </div>
      )}
    </div>
  )
}
