import { progressColor, todayMarkerRatio, type ProgressKind } from '@/lib/budgetFormat'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  actual:          number
  effectiveBudget: number
  kind:            ProgressKind
  month:           string     // 'YYYY-MM-01' — used for the today-marker
  className?:      string
  height?:         number     // px, default 6
}

export function ProgressBar({
  actual, effectiveBudget, kind, month, className, height = 6,
}: ProgressBarProps) {
  
  // 🎯 Calculate the ratio directly—simple, fast, and error-free!
  let ratio = 0
  if (effectiveBudget < 0) {
    ratio = 2 // If overspent from last month's rollover, force a maxed-out state
  } else if (effectiveBudget === 0) {
    ratio = actual > 0 ? 1 : 0
  } else {
    ratio = actual / effectiveBudget
  }

  const pct    = Math.max(0, Math.min(1, ratio)) * 100
  const color  = progressColor(ratio, kind)
  const marker = todayMarkerRatio(month)

  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-full bg-line/60', className)}
      style={{ height }}
    >
      {/* Fill */}
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />

      {/* Today marker — only on the current month */}
      {marker !== null && (
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white/80"
          style={{
            left:   `${marker * 100}%`,
            width:  2,
            height: height + 4,
          }}
          title="Today"
        />
      )}
    </div>
  )
}