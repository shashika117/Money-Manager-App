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

/**
 * Horizontal progress bar:
 *  - fill width  = actual / effectiveBudget (clamped 0..100%)
 *  - fill colour = progressColor(ratio, kind)
 *  - today-marker "|" shown only when month === current real month
 *
 * For Savings with a negative actual (net withdrawal), the bar shows
 * empty (0%) and the colour logic treats it as the low end.
 */
export function ProgressBar({
  actual, effectiveBudget, kind, month, className, height = 6,
}: ProgressBarProps) {
  const safeBudget = effectiveBudget === 0 ? 0 : effectiveBudget
  // ratio: if no budget, treat any actual as "full" so it isn't a dead bar
  const ratio = safeBudget > 0
    ? actual / safeBudget
    : (actual > 0 ? 1 : 0)

  const pct       = Math.max(0, Math.min(1, ratio)) * 100
  const color     = progressColor(ratio, kind)
  const marker    = todayMarkerRatio(month)   // 0..1 or null

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
