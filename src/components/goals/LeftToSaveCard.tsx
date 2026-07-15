// src/components/goals/LeftToSaveCard.tsx
//
// Headline card: all-time total of "truly unallocated money still
// available" summed across every month (get_total_left_to_save RPC).
// Positive = green (money still free to allocate); negative = red
// (historically over-allocated relative to capacity).

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { fmtSignedAmt, signColor } from '@/lib/goalFormat'
import { useTotalLeftToSave } from '@/hooks/useGoalMisc'

export function LeftToSaveCard() {
  const { data: total, isLoading } = useTotalLeftToSave()
  // Tap-toggle for touch devices (hover has no equivalent on mobile).
  const [infoOpen, setInfoOpen] = useState(false)

  const value = total ?? 0
  const isNeg = value < 0
  const isPos = value > 0
  const hasTooltip = value !== 0 // 🎯 Tooltip is only active when the amount is non-zero

  // ── 🎨 Match color & background logic of "LEFT TO BUDGET" ──
  const textColor = isNeg ? 'text-red-500' : signColor(value)

  let bgAndBorderColor = 'border-line bg-card' // Default for zero
  if (isNeg) {
    bgAndBorderColor = 'border-red-500/30 bg-red-500/5'
  } else if (isPos) {
    bgAndBorderColor = 'border-green-500/20 bg-green-500/5'
  }

  // ── 💬 Dynamic Tooltip Box outline border and bg color logic ──
  let tooltipBgAndBorder = 'border-line bg-navy' // Default for zero
  if (isNeg) {
    tooltipBgAndBorder = 'border-red-500/30 bg-red-950'
  } else if (isPos) {
    tooltipBgAndBorder = 'border-green-500/20 bg-green-950'
  }

  // ── ℹ️ Tooltip Trigger Icon colors ──
  const tooltipBtnColors = isNeg
    ? 'border-red-500/50 text-red-500 hover:text-red-400 hover:border-red-500'
    : isPos
    ? 'border-green/50 text-green hover:text-green-400 hover:border-green'
    : 'border-soft/50 text-soft hover:text-white hover:border-white'

  const tooltipText = isNeg
    ? 'Across all months, allocations have exceeded available savings.'
    : 'Total unallocated savings still available across all months.'

  return (
    <div className={cn(
      "relative rounded-2xl border p-5 flex flex-col items-center justify-center text-center min-h-[130px] transition-colors",
      bgAndBorderColor
    )}>

      {/* ── Top-right info icon: hover on desktop, TAP on mobile ── */}
      {hasTooltip && (
        <div className="absolute top-4 right-4 group z-30">
          <button
            type="button"
            onClick={() => setInfoOpen(v => !v)}
            aria-label="What does this mean?"
            aria-expanded={infoOpen}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold transition-colors select-none touch-manipulation",
              tooltipBtnColors
            )}
          >
            !
          </button>

          {/* Tooltip — shown on hover (desktop) OR when tapped open (mobile) */}
          <div className={cn(
            'absolute top-full right-0 mt-1.5 w-44 rounded-xl border p-2.5 font-dm text-[11px] leading-snug shadow-xl text-center z-50 transition-colors',
            tooltipBgAndBorder,
            textColor,
            infoOpen ? 'block' : 'hidden group-hover:block',
          )}>
            {tooltipText}
          </div>
        </div>
      )}

      {/* Tap-away layer (mobile): closes the tooltip when tapping elsewhere */}
      {hasTooltip && infoOpen && (
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
          {/* Value Text */}
          <p className={cn(
            'font-sora text-2xl font-bold leading-none transition-colors',
            textColor
          )}>
            {fmtSignedAmt(value)}
          </p>
          {/* Label Text */}
          <span className={cn(
            "mt-2.5 font-sora text-sm font-normal transition-colors opacity-80",
            textColor
          )}>
            LEFT TO SAVE
          </span>
        </div>
      )}
    </div>
  )
}