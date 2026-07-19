import { useState, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { NetWorthDataPoint, NetWorthPeriod } from '@/hooks/useNetWorthHistory'

function fmtK(n: number): string {
  const a = Math.abs(n), s = n < 0 ? '-' : ''
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toFixed(2)} Mn`
  if (a >= 1_000)     return `${s}${(a / 1_000).toFixed(2)} K`
  return `${s}${a.toFixed(2)}`
}
function fmtFull(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
function fmtFull2(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Down-sample daily data to one point per month (last day of month)
function bucketByMonth(data: NetWorthDataPoint[]): NetWorthDataPoint[] {
  const map = new Map<string, NetWorthDataPoint>()
  for (const d of data) map.set(d.period_date.slice(0, 7), d)
  return Array.from(map.values())
}

interface Props { data: NetWorthDataPoint[]; period: NetWorthPeriod; isLoading: boolean }

const VB_H = 280
const PAD  = { top: 20, right: 12, bottom: 28, left: 12 }

export function NetWorthBreakdownChart({ data, isLoading }: Props) {  //  period was passed. but not declared. so, i removed this
  const wrapRef   = useRef<HTMLDivElement>(null)
  const [vbW, setVbW] = useState(800)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [clickIdx, setClickIdx] = useState<number | null>(null)

  // Track actual container width → 1:1 coordinate mapping
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new ResizeObserver(e => setVbW(Math.floor(e[0].contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Outside click dismisses comparison card
  useEffect(() => {
    if (clickIdx === null) return
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setClickIdx(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [clickIdx])

  const cols = useMemo(() => bucketByMonth(data), [data])

  const geo = useMemo(() => {
    if (!cols.length || vbW < 1) return null
    const maxA = Math.max(...cols.map(d => d.assets), 1)
    const maxL = Math.max(...cols.map(d => Math.abs(d.liability)), 1)
    const maxN = Math.max(...cols.map(d => Math.abs(d.net_worth)), 1)
    const top    = Math.max(maxA, maxN) * 1.08
    const bottom = Math.max(maxL, 1)  * 1.08
    const total  = top + bottom

    const plotW  = vbW - PAD.left - PAD.right
    const plotH  = VB_H - PAD.top - PAD.bottom
    const zeroY  = PAD.top + (top / total) * plotH
    const slot   = plotW / cols.length
    const barW   = Math.min(slot * 0.5, 36)

    const xC    = (i: number) => PAD.left + slot * i + slot / 2
    const assetH = (v: number) => (v / total) * plotH
    const liabH  = (v: number) => (Math.abs(v) / total) * plotH
    const netY   = (v: number) => zeroY - (v / total) * plotH

    const netPath = cols.map((d, i) =>
      `${i ? 'L' : 'M'}${xC(i).toFixed(1)},${netY(d.net_worth).toFixed(1)}`
    ).join(' ')

    return { plotH, zeroY, slot, barW, xC, assetH, liabH, netY, netPath }
  }, [cols, vbW])

  if (isLoading) return (
    <div className="flex items-center justify-center" style={{ height: VB_H + 48 }}>
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue border-t-transparent" />
    </div>
  )
  if (!geo || !cols.length) return (
    <div className="flex items-center justify-center text-soft font-dm text-sm" style={{ height: VB_H + 48 }}>
      No breakdown data for this period yet.
    </div>
  )

  // Comparison: clicked vs previous month
  const cmp = clickIdx !== null && clickIdx > 0 ? (() => {
    const cur = cols[clickIdx], prev = cols[clickIdx - 1]
    return {
      cur, prev,
      dAsset: cur.assets    - prev.assets,
      // liability stored negative → dLiab > 0 = debt reduced = GOOD (green)
      dLiab:  cur.liability - prev.liability,
      dNet:   cur.net_worth - prev.net_worth,
    }
  })() : null

  const active = hoverIdx ?? clickIdx

  // Max visible x-axis labels without crowding
  const labelEvery = Math.max(1, Math.ceil(cols.length / 8))

  return (
    <div ref={wrapRef} className="relative select-none">

      {/* Comparison card */}
      {cmp && (
        <div className="absolute top-0 left-0 z-20 rounded-xl border border-line bg-navy/95 backdrop-blur px-3.5 py-2.5 shadow-xl animate-fade-in-scale w-max">
          <p className="font-dm text-[10px] uppercase tracking-wider text-white mb-2 text-left">
            {new Date(cmp.cur.period_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} vs {new Date(cmp.prev.period_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
          
          {/* 2-Column Grid Layout */}
          <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
            <DiffRow label="Assets"    value={cmp.dAsset} goodIfUp />
            <DiffRow label="Liability" value={cmp.dLiab}  goodIfUp invertArrow />
            <DiffRow label="Net Worth" value={cmp.dNet}   goodIfUp />
          </div>
        </div>
      )}

      {/* Hover value card — positioned at hover column using pixel coords */}
      {active !== null && (
      <div
      className="absolute z-20 rounded-lg border border-line bg-navy/95 backdrop-blur px-2.5 py-1.5 shadow-lg pointer-events-none animate-fade-in w-max"
      style={{
        left:      geo.xC(active),
        top:       PAD.top,
        transform: 'translate(+25%, -20%)',
      }}
    >
      {/* Title / Period Date */}
      <p className="font-sora text-[10px] text-white text-left mb-1.5 font-semibold">
        {fmtFull2(cols[active].period_date)}
      </p>
    
      {/* 2-Column Left-Aligned Grid */}
      <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-[10px] font-sora">
        <span className="text-green text-left">Assets</span>
        <span className="text-green text-left">{fmtK(cols[active].assets)}</span>
  
        <span className="text-red text-left">Liability</span>
        <span className="text-red text-left">{fmtK(Math.abs(cols[active].liability))}</span>
  
        <span className="text-soft text-left">Net Worth</span>
        <span className="text-soft text-left">{fmtK(cols[active].net_worth)}</span>
      </div>
    </div>
    )}


      {/* SVG — vbW matches container width exactly */}
      <svg
        viewBox={`0 0 ${vbW} ${VB_H}`}
        width={vbW}
        height={VB_H}
        className="block touch-none relative z-10"
        onPointerLeave={() => setHoverIdx(null)}
      >
        {/* Zero line */}
        <line x1={PAD.left} y1={geo.zeroY} x2={vbW - PAD.right} y2={geo.zeroY}
          stroke="#1e2d45" strokeWidth="1" />

        {/* Columns */}
        {cols.map((d, i) => {
          const cx  = geo.xC(i)
          const aH  = geo.assetH(d.assets)
          const lH  = geo.liabH(d.liability)
          const sel = active === i
          return (
            <g key={i}
              onPointerEnter={() => setHoverIdx(i)}
              onPointerDown={() => setClickIdx(p => p === i ? null : i)}
              cursor="pointer">
              <rect x={cx - geo.slot / 2} y={PAD.top} width={geo.slot} height={geo.plotH} fill="transparent" />
              {/* Asset bar up */}
              <rect x={cx - geo.barW / 2} y={geo.zeroY - aH} width={geo.barW} height={aH} rx="2"
                fill={sel ? '#10b981' : '#10b98155'} style={{ transition: 'fill 0.15s' }} />
              {/* Liability bar down */}
              <rect x={cx - geo.barW / 2} y={geo.zeroY} width={geo.barW} height={lH} rx="2"
                fill={sel ? '#ef4444' : '#ef444455'} style={{ transition: 'fill 0.15s' }} />
              {/* X-axis date label — show every N-th to avoid crowding */}
              {i % labelEvery === 0 && (
                <text x={cx} y={VB_H - 4} textAnchor="middle"
                  fill={sel ? '#10b981' : '#4b5563'} fontSize="10"
                  fontFamily="'DM Sans', sans-serif" fontWeight={sel ? '600' : '400'}>
                  {fmtLabel(d.period_date)}
                </text>
              )}
            </g>
          )
        })}

        {/* Hover/selected x-axis label */}
        {active !== null && active % labelEvery !== 0 && (
          <text x={geo.xC(active)} y={VB_H - 4} textAnchor="middle"
            fill="#10b981" fontSize="10" fontWeight="600"
            fontFamily="'DM Sans', sans-serif">
            {fmtLabel(cols[active].period_date)}
          </text>
        )}

        {/* Net worth line */}
        <path d={geo.netPath} fill="none" stroke="#f59e0b" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" />

        {/* Net dots */}
        {cols.map((d, i) => (
          <circle key={i} cx={geo.xC(i)} cy={geo.netY(d.net_worth)}
            r={active === i ? 4 : 2.5}
            fill="#f59e0b" stroke="#080d1a" strokeWidth="1.5"
            pointerEvents="none" style={{ transition: 'r 0.15s' }} />
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-1">
        <Legend color="bg-green/70" label="Assets" />
        <Legend color="bg-red/70"   label="Liability" />
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full bg-amber" />
          <span className="font-dm text-[10px] text-soft">Net Worth</span>
        </div>
      </div>
      <p className="text-center font-dm text-[10px] text-muted mt-1">
        Click a column to compare with the previous month
      </p>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('inline-block h-2.5 w-2.5 rounded-sm', color)} />
      <span className="font-dm text-[10px] text-soft">{label}</span>
    </div>
  )
}

function DiffRow({ 
  label, 
  value, 
  goodIfUp, 
  invertArrow = false 
}: { 
  label: string; 
  value: number; 
  goodIfUp: boolean; 
  invertArrow?: boolean 
}) {
  const up = value >= 0
  const isGood = goodIfUp ? up : !up
  
  const arrow = invertArrow ? (up ? '▼' : '▲') : (up ? '▲' : '▼')
  
  return (
    <>
      <span className="font-dm text-[10px] text-soft text-left flex items-center">
        {label}
      </span>
      {/* CHANGED: text-right to text-left, added flex and gap-1.5 for perfect left alignment */}
      <span className={cn('font-dm text-[11px] font-semibold text-left flex items-center gap-1.5', isGood ? 'text-green' : 'text-red')}>
        <span>{arrow}</span>
        <span>{fmtFull(value)}</span>
      </span>
    </>
  )
}
