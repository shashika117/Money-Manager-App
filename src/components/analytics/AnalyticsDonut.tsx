// src/components/analytics/AnalyticsDonut.tsx
//
// The donut chart + legend.
//   • Slices = the current DonutView (group / category / subcategory,
//     or income categories on the Earning tab).
//   • Legend lists only NON-ZERO buckets; legend rows are clickable and
//     are the ONLY drill control (slices are hover-only).
//   • Hover a slice OR a legend row → every OTHER slice + legend row
//     recedes, and a floating card shows name / amount / percentage.
//   • Centre hole shows the total of the visible slices.
//   • Back arrow appears below the donut chart, top-left of the legend.
//
// Pure SVG (no recharts) so the hover-mute and legend sync stay exact.

import { useState, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { fmtAmt, fmtCompact, fmtPct } from '@/lib/analyticsFormat'
import { bucketColor } from '@/lib/analyticsColors'
import type { AnalyticsTab, DonutView, Focus } from '@/lib/analyticsScope'
import { focusLabel } from '@/lib/analyticsScope'
import {
  useAnalyticsBreakdown, toDonut, donutTotal, type DonutSlice,
} from '@/hooks/useAnalyticsBreakdown'

const SIZE   = 240
const R_OUT  = 108
const R_IN   = 70
const CX     = SIZE / 2
const CY     = SIZE / 2
const GAP    = 0.018   // radians of padding between slices

// How far non-hovered elements recede. Higher = more visible.
const DIM_SLICE = 0.50   // was 0.22 — muted slices were effectively invisible

interface Props {
  tab:           AnalyticsTab
  bounds:        { start: string; endExclusive: string }
  view:          DonutView
  focus:         Focus              // the DRILL focus (what the donut shows)
  selection:     Focus | null       // a terminal pick — highlights a legend row
  activeMonth:   string | null      // isolate one month ('YYYY-MM'), or null = whole range
  canDrillBack:  boolean
  animKey:       number             // bump → replay the slide
  animDir:       'down' | 'back'    // drill in → slide from right; back → from left
  onSelectBucket: (bucket: string) => void
  onDrillBack:    () => void
}

export function AnalyticsDonut({
  tab, bounds, view, focus, selection, activeMonth, canDrillBack,
  animKey, animDir, onSelectBucket, onDrillBack,
}: Props) {
  const { data: rows = [], isLoading, isError } = useAnalyticsBreakdown({
    tab, start: bounds.start, endExclusive: bounds.endExclusive, view,
  })

  const slices = useMemo(() => toDonut(rows, activeMonth), [rows, activeMonth])
  const total  = useMemo(() => donutTotal(slices), [slices])

  const [hover, setHover] = useState<string | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  function moveTip(e: React.MouseEvent) {
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top })
  }

  const arcs = useMemo(() => buildArcs(slices, total), [slices, total])

  // ── Stale-hover guard ──────────────────────────────────────────────
  // Clicking a legend row sets `hover` to that bucket, then drills — which
  // swaps in a whole NEW set of buckets. The old `hover` value now matches
  // nothing, so every slice would fail the `hover !== bucket` test and dim.
  // (The legend button also unmounts mid-click, so its onMouseLeave never
  // fires to clear it.) Treating a hover that isn't in the current slices
  // as "no hover" means a stale value can never mute anything.
  const hoverActive = hover && slices.some(s => s.bucket === hover) ? hover : null
  const hovered = hoverActive ? slices.find(s => s.bucket === hoverActive) ?? null : null

  // Belt-and-braces: drop the hover whenever the drill level changes.
  useEffect(() => {
    setHover(null)
    setTip(null)
  }, [view.dimension, view.filterGroup, view.filterCategory, animKey])

  // Clear hover as we drill, so nothing lingers into the next level.
  function handleSelect(bucket: string) {
    setHover(null)
    setTip(null)
    onSelectBucket(bucket)
  }

  // A terminal pick (Save / subcategory / income category) highlights its
  // legend row without moving the donut.
  const selectedBucket = selection && selection.kind !== 'total' ? selection.name : null

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      {/* Header: title only (Back button lives below the ring) */}
      <div className="flex items-center gap-2 mb-2 min-h-[28px]">
        <div className="min-w-0">
          <p className="font-sora text-sm font-bold text-soft truncate">
            {tab === 'earn' ? 'Income by category' : donutTitle(view, focus)}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center" style={{ height: SIZE }}>
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <p className="font-sora text-sm text-red mb-1">Couldn't load breakdown</p>
          <p className="font-dm text-xs text-soft">Check your connection and try again.</p>
        </div>
      ) : slices.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-3xl">📊</span>
          <p className="mt-2 font-dm text-sm text-soft">No data for this period.</p>
        </div>
      ) : (
        <div
          key={animKey}
          className={animDir === 'down' ? 'animate-slide-from-right' : 'animate-slide-from-left'}
        >
          {/* ── Ring ── */}
          <div ref={wrapRef} className="relative mx-auto" style={{ width: SIZE, height: SIZE }}
            onMouseLeave={() => { setHover(null); setTip(null) }}>
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
              {arcs.map(a => {
                const color  = bucketColor(view.dimension, a.bucket)
                const isDim  = hoverActive !== null && hoverActive !== a.bucket
                const isHot  = hoverActive === a.bucket

                const common = {
                  // Muted slices stay clearly readable — recessed, not gone.
                  opacity: isDim ? DIM_SLICE : 1,
                  style: {
                    transform: isHot ? 'scale(1.03)' : 'scale(1)',
                    transformOrigin: `${CX}px ${CY}px`,
                    transition: 'opacity 200ms, transform 200ms',
                  } as React.CSSProperties,
                  onMouseEnter: () => setHover(a.bucket),
                  onMouseMove:  moveTip,
                }

                return a.ring ? (
                  <circle key={a.bucket} cx={CX} cy={CY} r={MID_R}
                    fill="none" stroke={color} strokeWidth={BAND_W} {...common} />
                ) : (
                  <path key={a.bucket} d={a.path} fill={color} {...common} />
                )
              })}
            </svg>

            {/* Centre total */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-dm text-[10px] uppercase tracking-wider text-muted">
                {hovered ? hovered.bucket : 'Total'}
              </span>
              <span className="font-sora text-xl font-bold text-white tabular-nums mt-0.5">
                {fmtCompact(hovered ? hovered.amount : total)}
              </span>
              {hovered && (
                <span className="font-dm text-[11px] text-soft mt-0.5">
                  {fmtPct(hovered.amount, total)}
                </span>
              )}
            </div>

            {/* Hover card */}
            {hovered && tip && (
              <div className="pointer-events-none absolute z-20 rounded-xl border border-line bg-navy px-3 py-2 shadow-xl animate-fade-in"
                style={{
                  left: Math.min(tip.x + 12, SIZE - 130),
                  top:  Math.max(tip.y - 44, 0),
                }}>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm flex-none"
                    style={{ background: bucketColor(view.dimension, hovered.bucket) }} />
                  <span className="font-sora text-xs font-semibold text-white whitespace-nowrap">
                    {hovered.bucket}
                  </span>
                </div>
                <p className="mt-0.5 font-sora text-sm font-bold text-white tabular-nums whitespace-nowrap">
                  {fmtAmt(hovered.amount)}
                </p>
                <p className="font-dm text-[11px] text-soft">{fmtPct(hovered.amount, total)}</p>
              </div>
            )}
          </div>

          {/* ── Back Button Row ── */}
          {canDrillBack && (
            <div className="mt-4 flex justify-flex-start px-2">
              <button onClick={onDrillBack} aria-label="Back"
                className="h-7 w-7 flex-none flex items-center justify-center rounded-lg border border-line bg-navy font-sora text-sm text-soft hover:text-white hover:border-soft transition-colors">
                ←
              </button>
            </div>
          )}

          {/* ── Legend — THE drill control (dynamic mt depending on back button) ── */}
          <div className={cn(
            "flex flex-col gap-0.5 max-h-[220px] overflow-y-auto",
            canDrillBack ? "mt-2" : "mt-4"
          )}>
            {slices.map(s => {
              const color = bucketColor(view.dimension, s.bucket)
              const isDim = hoverActive !== null && hoverActive !== s.bucket
              const isSel = selectedBucket === s.bucket
              return (
                <button key={s.bucket}
                  onClick={() => handleSelect(s.bucket)}
                  onMouseEnter={() => setHover(s.bucket)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all duration-200',
                    // Softer recede — muted rows stay legible.
                    isDim ? 'opacity-50' : 'opacity-100',
                    isSel ? 'bg-panel ring-1 ring-inset' : 'hover:bg-panel',
                  )}
                  style={isSel ? { boxShadow: `inset 0 0 0 1px ${color}` } : undefined}>
                  <span className="h-2.5 w-2.5 rounded-sm flex-none" style={{ background: color }} />
                  <span className="font-dm text-xs text-white truncate flex-1 min-w-0">{s.bucket}</span>
                  <span className="font-sora text-xs text-soft tabular-nums flex-none">{fmtAmt(s.amount)}</span>
                  <span className="font-dm text-[10px] text-muted tabular-nums flex-none w-12 text-right">
                    {fmtPct(s.amount, total)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Title reflecting the current drill level ────────────────────────
function donutTitle(view: DonutView, focus: Focus): string {
  if (view.dimension === 'group')       return 'Spending by group'
  if (view.dimension === 'category')    return view.filterGroup ? `${view.filterGroup} · categories` : 'Spending by category'
  return `${view.filterCategory ?? focusLabel(focus)} · subcategories`
}

// ── Arc geometry ────────────────────────────────────────────────────
interface Arc {
  bucket: string
  path?:  string
  ring?:  boolean
}

const MID_R  = (R_OUT + R_IN) / 2
const BAND_W = R_OUT - R_IN

function buildArcs(slices: DonutSlice[], total: number): Arc[] {
  if (total <= 0) return []

  if (slices.length === 1) {
    return [{ bucket: slices[0].bucket, ring: true }]
  }

  let angle = -Math.PI / 2
  return slices.map(s => {
    const sweep = (s.amount / total) * Math.PI * 2
    const gap = Math.min(GAP, sweep * 0.35)
    const a0  = angle + gap / 2
    const a1  = angle + sweep - gap / 2
    angle += sweep

    return { bucket: s.bucket, path: arcPath(a0, a1) }
  })
}

function arcPath(a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0
  const p = (r: number, a: number) => [CX + r * Math.cos(a), CY + r * Math.sin(a)]
  const [x0o, y0o] = p(R_OUT, a0)
  const [x1o, y1o] = p(R_OUT, a1)
  const [x1i, y1i] = p(R_IN,  a1)
  const [x0i, y0i] = p(R_IN,  a0)
  return [
    `M ${x0o} ${y0o}`,
    `A ${R_OUT} ${R_OUT} 0 ${large} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${R_IN} ${R_IN} 0 ${large} 0 ${x0i} ${y0i}`,
    'Z',
  ].join(' ')
}
