// src/components/goals/GoalCard.tsx
//
// One goal as a horizontal card. Elements:
//   • grip handle (⋮⋮) for reordering        (left, drag affordance)
//   • name + pace pill                        (ahead/on-track/behind)
//   • 📎 linked-account icon (hover → name)   (only if linked)
//   • gear (settings) — top right
//   • current balance (cyan)
//   • target amount + target date            (if set)
//   • required monthly saving                (if applicable)
//   • soft-white progress bar                (if target set)
// Clicking the card body (not gear/grip/clip) toggles the chart.

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { fmtAmt, fmtDateFull, paceStyle } from '@/lib/goalFormat'
import type { EnrichedGoal } from '@/hooks/useGoalsEnriched'

interface Props {
  goal:        EnrichedGoal
  chartOpen:   boolean
  onToggleChart: () => void
  onOpenSettings: () => void
  // drag handle wiring (from the dnd-kit sortable container)
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  dragHandleRef?:   (el: HTMLElement | null) => void
  isDragging?:   boolean
}

export function GoalCard({
  goal, chartOpen, onToggleChart, onOpenSettings, dragHandleProps, dragHandleRef, isDragging,
}: Props) {
  // Tap-reveal of the linked account (mobile has no hover for title=).
  const [showLink, setShowLink] = useState(false)

  const pace = paceStyle(goal.pace)
  const pct  = goal.progress_ratio != null
    ? Math.max(0, Math.min(1, goal.progress_ratio)) * 100
    : null

  return (
    <div
      className={cn(
        'group relative rounded-2xl border bg-card transition-all',
        chartOpen ? 'border-cyan/40' : 'border-line hover:border-soft/40',
        isDragging && 'opacity-60 ring-2 ring-cyan/40',
        !goal.is_active && 'opacity-60',
      )}
    >
      <div className="flex items-stretch">
        {/* Grip handle — dnd-kit activator (ref + listeners). touch-none
            stops the page scrolling when the drag starts from here. */}
        <button
          ref={dragHandleRef}
          {...dragHandleProps}
          aria-label="Drag to reorder"
          className="flex-none flex items-center px-2 cursor-grab active:cursor-grabbing text-muted hover:text-soft touch-none"
        >
          <span className="font-sora text-sm leading-none tracking-tighter select-none">⋮⋮</span>
        </button>

        {/* Body — tap toggles chart */}
        <button
          type="button"
          onClick={onToggleChart}
          className="flex-1 min-w-0 text-left px-1 py-4 pr-3"
        >
          {/* Row 1: name + pace + inactive tag */}
          <div className="flex items-center gap-2 mb-1.5 pr-16">
            <span className="font-sora text-sm font-bold text-white truncate">{goal.goal_name}</span>

            {pace && (
              <span className={cn('flex-none rounded-full border px-2 py-0.5 font-dm text-[10px] font-medium', pace.cls)}>
                {pace.label}
              </span>
            )}
            {!goal.is_active && (
              <span className="flex-none rounded-full border border-muted/40 bg-muted/10 px-2 py-0.5 font-dm text-[10px] text-muted">
                inactive
              </span>
            )}

            {/* Linked-account clip — hover shows the name on desktop (title),
                tap reveals it on mobile (popover). */}
            {goal.linked_account && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowLink(v => !v) }}
                className="relative flex-none text-muted hover:text-cyan cursor-help select-none"
                title={`Linked to ${goal.linked_account}`}
                aria-label={`Linked to ${goal.linked_account}`}
              >
                📎
                {showLink && (
                  <span className="absolute left-1/2 top-full z-40 mt-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-cyan/30 bg-navy px-2.5 py-1 font-dm text-[11px] text-cyan shadow-xl">
                    Linked to {goal.linked_account}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Row 2: balance */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-sora text-xl font-bold text-cyan tabular-nums">{fmtAmt(goal.current_balance)}</span>
            {goal.target_amount != null && (
              <span className="font-dm text-xs text-soft">
                / {fmtAmt(goal.target_amount)}
              </span>
            )}
          </div>

          {/* Row 3: progress bar (only when target set) */}
          {pct != null && (
            <div className="mb-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/60">
                <div
                  className="h-full rounded-full bg-white/85 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Row 4: meta line (target date + required monthly) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
            {goal.target_date && (
              <span className="font-dm text-[11px] text-muted">
                Target {fmtDateFull(goal.target_date)}
              </span>
            )}
            {goal.required_monthly_saving != null && goal.required_monthly_saving > 0 && (
              <span className="font-dm text-[11px] text-soft">
                Need <span className="text-white font-medium">{fmtAmt(goal.required_monthly_saving)}</span>/mo
              </span>
            )}
            {goal.required_monthly_saving === 0 && goal.target_amount != null && (
              <span className="font-dm text-[11px] text-green">Target reached 🎉</span>
            )}
          </div>
        </button>
      </div>

      {/* Gear — top right, absolute so it doesn't interfere with body tap */}
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Goal settings"
        className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg text-soft hover:bg-panel hover:text-white transition-colors"
      >
        
        {/* settings gear icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="origin-center"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>


      </button>

      {/* Tap-away layer (mobile): closes the linked-account popover */}
      {showLink && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); setShowLink(false) }}
          className="fixed inset-0 z-30 cursor-default"
        />
      )}
    </div>
  )
}
