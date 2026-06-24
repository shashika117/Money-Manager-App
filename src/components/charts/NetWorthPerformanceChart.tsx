import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { NetWorthDataPoint, NetWorthPeriod } from '@/hooks/useNetWorthHistory'

// ── Compact chart amounts ─────────────────────────────────────────
function fmtK(n: number): string {
  const a = Math.abs(n)
  const s = n < 0 ? '-' : ''
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toFixed(2)} Mn`
  if (a >= 1_000)     return `${s}${(a / 1_000).toFixed(2)} K`
  return `${s}${a.toFixed(2)}`
}
function fmtFull(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDateLabel(dateStr: string, monthly: boolean): string {
  const d = new Date(dateStr + 'T00:00:00')
  return monthly
    ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function fmtDateFull(dateStr: string, monthly: boolean): string {
  const d = new Date(dateStr + 'T00:00:00')
  return monthly
    ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Props { data: NetWorthDataPoint[]; period: NetWorthPeriod; isLoading: boolean }

const VB_H = 280
const PAD  = { top: 20, right: 20, bottom: 24, left: 14 }

export function NetWorthPerformanceChart({ data, period, isLoading }: Props) {
  const wrapRef  = useRef<HTMLDivElement>(null)
  const svgRef   = useRef<SVGSVGElement>(null)
  const [vbW, setVbW] = useState(800)   // tracks actual rendered width
  const monthly  = period === 'ALL'

  // ── ResizeObserver: keep vbW = actual container pixel width ──────
  // With viewBox="0 0 {vbW} {VB_H}" and the SVG at exactly {vbW}×{VB_H}
  // pixels, every SVG coordinate maps 1:1 to a DOM pixel → perfect alignment.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new ResizeObserver(e => setVbW(Math.floor(e[0].contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── Chart geometry ────────────────────────────────────────────────
  const geo = useMemo(() => {
    if (!data.length || vbW < 1) return null
    const vals = data.map(d => d.net_worth)
    const mn = Math.min(...vals), mx = Math.max(...vals)
    const rng = mx - mn || 1
    const yMin = mn - rng * 0.08, yMax = mx + rng * 0.08, yRng = yMax - yMin
    const plotW = vbW - PAD.left - PAD.right
    const plotH = VB_H - PAD.top  - PAD.bottom

    const xOf = (i: number) => PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
    const yOf = (v: number) => PAD.top + plotH - ((v - yMin) / yRng) * plotH
    const pts  = data.map((d, i) => ({ x: xOf(i), y: yOf(d.net_worth) }))

    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const area = `${line} L${pts.at(-1)!.x.toFixed(1)},${(PAD.top + plotH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`
    return { pts, line, area, plotH }
  }, [data, vbW])

  // ── Pointer → nearest index ───────────────────────────────────────
  const idxOf = useCallback((clientX: number): number | null => {
    if (!svgRef.current || !geo || !data.length) return null
    const rect = svgRef.current.getBoundingClientRect()
    // vbW = rect.width exactly → SVG px = DOM px; no scaling correction needed
    const x = clientX - rect.left
    let best = 0, bestD = Infinity
    geo.pts.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bestD) { bestD = d; best = i } })
    return best
  }, [geo, data.length])

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [selected, setSelected] = useState<number[]>([])

  function onMove(e: React.PointerEvent)  { setHoverIdx(idxOf(e.clientX)) }
  function onLeave()                       { setHoverIdx(null) }
  function onDown(e: React.PointerEvent)  {
    const idx = idxOf(e.clientX)
    if (idx === null) return
    setSelected(prev =>
      prev.length === 0 ? [idx] : prev.length === 1 ? (prev[0] === idx ? prev : [prev[0], idx]) : [prev[1], idx]
    )
  }
  function clearSel() { setSelected([]) }

  if (isLoading) return (
    <div className="flex items-center justify-center" style={{ height: VB_H + 24 }}>
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-green border-t-transparent" />
    </div>
  )
  if (!geo || !data.length) return (
    <div className="flex items-center justify-center text-soft font-dm text-sm" style={{ height: VB_H + 24 }}>
      No net worth data for this period yet.
    </div>
  )

  // Comparison data
  const cmp = selected.length === 2 ? (() => {
    const [a, b] = [...selected].sort((x, y) => x - y)
    const from = data[a].net_worth, to = data[b].net_worth
    const diff = to - from, pct = from ? (diff / Math.abs(from)) * 100 : 0
    return { diff, pct, aIdx: a, bIdx: b, pos: +(diff >= 0) }
  })() : null

  const activeIdx = hoverIdx ?? (selected.length ? selected[selected.length - 1] : null)
  const last = geo.pts.at(-1)!

  return (
    <div ref={wrapRef} className="relative select-none">
      {/* Comparison card */}
      {cmp && (
        <div className="absolute top-0 left-0 z-20 rounded-xl border border-line bg-navy/95 backdrop-blur px-3.5 py-2.5 shadow-xl animate-fade-in-scale">
          <p className="font-dm text-[10px] uppercase tracking-wider text-muted mb-1">
            {fmtDateFull(data[cmp.aIdx].period_date, monthly)} → {fmtDateFull(data[cmp.bIdx].period_date, monthly)}
          </p>
          <div className="flex items-center gap-2">
            <span className={cn('font-sora text-lg font-bold', cmp.pos ? 'text-green' : 'text-red')}>
              {cmp.pos ? '▲' : '▼'} {fmtFull(cmp.diff)}
            </span>
            <span className={cn('font-dm text-xs font-semibold', cmp.pos ? 'text-green' : 'text-red')}>
              {cmp.pos ? '+' : '−'}{Math.abs(cmp.pct).toFixed(1)}%
            </span>
          </div>
          <button onClick={clearSel} className="mt-1.5 font-dm text-[10px] text-soft hover:text-white">Clear ✕</button>
        </div>
      )}

      {/* Hover / selection value label — positioned using actual pixel coords */}
      {activeIdx !== null && (
        <div
          className="absolute z-20 rounded-lg border border-line bg-navy/95 backdrop-blur px-2.5 py-1.5 shadow-lg pointer-events-none animate-fade-in"
          style={{
            left:      geo.pts[activeIdx].x,
            top:       geo.pts[activeIdx].y,
            transform: 'translate(-50%, -135%)',  // well above the line
          }}
        >
          <p className="font-sora text-sm font-bold text-white whitespace-nowrap">{fmtK(data[activeIdx].net_worth)}</p>
          <p className="font-dm text-[9px] text-soft text-center">{fmtDateFull(data[activeIdx].period_date, monthly)}</p>
        </div>
      )}

      {/* Outside-click backdrop to clear selection */}
      {selected.length > 0 && (
        <div className="fixed inset-0 z-0" onClick={clearSel} />
      )}

      {/* SVG — vbW matches container width exactly → 1:1 coordinate mapping */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${vbW} ${VB_H}`}
        width={vbW}
        height={VB_H}
        className="block relative z-10 touch-none"
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onPointerDown={onDown}
      >
        <defs>
          <linearGradient id="nwArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#10b981" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={geo.area} fill="url(#nwArea)" />

        {/* Net worth line */}
        <path d={geo.line} fill="none" stroke="#10b981" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Hover guide */}
        {hoverIdx !== null && (
          <g pointerEvents="none">
            <line x1={geo.pts[hoverIdx].x} y1={PAD.top}
                  x2={geo.pts[hoverIdx].x} y2={PAD.top + geo.plotH}
                  stroke="#1e2d45" strokeWidth="1" strokeDasharray="3 3" />
            {/* X-axis date label aligned under hover position */}
            <text x={geo.pts[hoverIdx].x} y={VB_H - 4} textAnchor="middle"
              fill="#10b981" fontSize="10" fontWeight="600" fontFamily="'DM Sans', sans-serif">
              {fmtDateLabel(data[hoverIdx].period_date, monthly)}
            </text>
          </g>
        )}

        {/* Selected markers */}
        {selected.map(i => (
          <circle key={i} cx={geo.pts[i].x} cy={geo.pts[i].y} r="5"
            fill="#f59e0b" stroke="#080d1a" strokeWidth="2" pointerEvents="none" />
        ))}

        {/* Hover dot */}
        {hoverIdx !== null && (
          <circle cx={geo.pts[hoverIdx].x} cy={geo.pts[hoverIdx].y} r="4"
            fill="#10b981" stroke="#080d1a" strokeWidth="2" pointerEvents="none" />
        )}

        {/* Animated "now" ring at the last point */}
        <circle cx={last.x} cy={last.y} r="6"
          fill="none" stroke="#10b981" strokeWidth="2.5" pointerEvents="none">
          <animate attributeName="r"       values="6;10;6" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0;1"  dur="2.2s" repeatCount="indefinite" />
        </circle>
        <circle cx={last.x} cy={last.y} r="3" fill="#10b981" pointerEvents="none" />
      </svg>

      {/* Static x-axis end labels */}
      <div className="flex justify-between px-1 mt-0.5">
        <span className="font-dm text-[10px] text-muted">{fmtDateLabel(data[0].period_date, monthly)}</span>
        <span className="font-dm text-[10px] text-muted">{fmtDateLabel(data.at(-1)!.period_date, monthly)}</span>
      </div>

      <p className="text-center font-dm text-[10px] text-muted mt-1">
        {!selected.length && 'Click two points to compare'}
        {selected.length === 1 && 'Click a second point to compare'}
        {selected.length === 2 && 'Click empty space to clear'}
      </p>
    </div>
  )
}
