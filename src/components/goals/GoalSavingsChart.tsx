// src/components/goals/GoalSavingsChart.tsx
//
// Cumulative-balance line+area chart for one goal, adapted from
// NetWorthPerformanceChart. Cyan identity (Savings). Period slicers
// 3M / 6M / 12M / ALL, hover value card, animated "today" ring.
// Laptop-only (parent gates on breakpoint).

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useGoalChart } from '@/hooks/useGoalMisc'
import type { GoalChartPeriod } from '@/hooks/useGoalActivity'

function fmtK(n: number): string {
  const a = Math.abs(n); const s = n < 0 ? '-' : ''
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toFixed(2)} Mn`
  if (a >= 1_000)     return `${s}${(a / 1_000).toFixed(2)} K`
  return `${s}${a.toFixed(2)}`
}
function fmtLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
function fmtFull(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const VB_H = 240
const PAD  = { top: 20, right: 20, bottom: 24, left: 14 }
const PERIODS: GoalChartPeriod[] = ['3M', '6M', '12M', 'ALL']

interface Props { goalName: string }

export function GoalSavingsChart({ goalName }: Props) {
  const [period, setPeriod] = useState<GoalChartPeriod>('6M')
  const { series: data, isLoading } = useGoalChart(goalName, period)

  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef  = useRef<SVGSVGElement>(null)
  const [vbW, setVbW] = useState(600)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new ResizeObserver(e => setVbW(Math.floor(e[0].contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const geo = useMemo(() => {
    if (!data.length || vbW < 1) return null
    const vals = data.map(d => d.balance)
    const mn = Math.min(...vals), mx = Math.max(...vals)
    const rng = mx - mn || 1
    const yMin = mn - rng * 0.08, yMax = mx + rng * 0.08, yRng = yMax - yMin
    const plotW = vbW - PAD.left - PAD.right
    const plotH = VB_H - PAD.top - PAD.bottom
    const xOf = (i: number) => PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
    const yOf = (v: number) => PAD.top + plotH - ((v - yMin) / yRng) * plotH
    const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.balance) }))
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    const area = `${line} L${pts.at(-1)!.x.toFixed(1)},${(PAD.top + plotH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`
    return { pts, line, area, plotH }
  }, [data, vbW])

  const idxOf = useCallback((clientX: number): number | null => {
    if (!svgRef.current || !geo || !data.length) return null
    const rect = svgRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    let best = 0, bestD = Infinity
    geo.pts.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bestD) { bestD = d; best = i } })
    return best
  }, [geo, data.length])

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      {/* Period slicers */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-sora text-xs font-bold text-white">{goalName} · balance</span>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn('rounded-lg px-2.5 py-1 font-dm text-[11px] font-medium transition-colors',
                period === p ? 'bg-cyan/15 text-cyan' : 'text-soft hover:text-white')}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="relative select-none">
        {isLoading ? (
          <div className="flex items-center justify-center" style={{ height: VB_H }}>
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          </div>
        ) : !geo || !data.length ? (
          <div className="flex items-center justify-center font-dm text-sm text-soft" style={{ height: VB_H }}>
            No savings activity for this period yet.
          </div>
        ) : (
          <>
            {hoverIdx !== null && (
              <div className="absolute z-20 rounded-lg border border-line bg-navy/95 backdrop-blur px-2.5 py-1.5 shadow-lg pointer-events-none animate-fade-in"
                style={{ left: geo.pts[hoverIdx].x, top: geo.pts[hoverIdx].y, transform: 'translate(-50%, -135%)' }}>
                <p className="font-sora text-sm font-bold text-white whitespace-nowrap">{fmtK(data[hoverIdx].balance)}</p>
                <p className="font-dm text-[9px] text-soft text-center">{fmtFull(data[hoverIdx].period_date)}</p>
              </div>
            )}

            <svg ref={svgRef} viewBox={`0 0 ${vbW} ${VB_H}`} width={vbW} height={VB_H}
              className="block relative z-10 touch-none"
              onPointerMove={e => setHoverIdx(idxOf(e.clientX))}
              onPointerLeave={() => setHoverIdx(null)}>
              <defs>
                <linearGradient id="goalArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path d={geo.area} fill="url(#goalArea)" />
              <path d={geo.line} fill="none" stroke="#22d3ee" strokeWidth="2.5"
                strokeLinejoin="round" strokeLinecap="round" />

              {hoverIdx !== null && (
                <g pointerEvents="none">
                  <line x1={geo.pts[hoverIdx].x} y1={PAD.top} x2={geo.pts[hoverIdx].x} y2={PAD.top + geo.plotH}
                    stroke="#1e2d45" strokeWidth="1" strokeDasharray="3 3" />
                  <text x={geo.pts[hoverIdx].x} y={VB_H - 4} textAnchor="middle"
                    fill="#22d3ee" fontSize="10" fontWeight="600" fontFamily="'DM Sans', sans-serif">
                    {fmtLabel(data[hoverIdx].period_date)}
                  </text>
                  <circle cx={geo.pts[hoverIdx].x} cy={geo.pts[hoverIdx].y} r="4"
                    fill="#22d3ee" stroke="#080d1a" strokeWidth="2" />
                </g>
              )}

              {/* Animated "today" ring at the latest point */}
              <circle cx={geo.pts.at(-1)!.x} cy={geo.pts.at(-1)!.y} r="6"
                fill="none" stroke="#22d3ee" strokeWidth="2.5" pointerEvents="none">
                <animate attributeName="r"       values="6;10;6" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0;1"  dur="2.2s" repeatCount="indefinite" />
              </circle>
              <circle cx={geo.pts.at(-1)!.x} cy={geo.pts.at(-1)!.y} r="3" fill="#22d3ee" pointerEvents="none" />
            </svg>

            <div className="flex justify-between px-1 mt-0.5">
              <span className="font-dm text-[10px] text-muted">{fmtLabel(data[0].period_date)}</span>
              <span className="font-dm text-[10px] text-muted">{fmtLabel(data.at(-1)!.period_date)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
