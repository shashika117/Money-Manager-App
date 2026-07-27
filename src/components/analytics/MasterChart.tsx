// src/components/analytics/MasterChart.tsx
//
// The full-width chart above the donut (laptop only).
//
//   Single month  → AREA chart: this month's daily cumulative (solid) vs the
//                   REAL current month's prior-3-month daily-cumulative
//                   average (dashed). Blinking ring marks today (current
//                   month only; a past month draws the full month, no ring).
//
//   Month range   → CLUSTERED COLUMN chart: one cluster per month, one bar
//                   per bucket at the CURRENT drill level (top-6 + Other).
//                   Clicking a bar shows that bucket's per-month trend
//                   (value labels + dashed line) and dims everything else.
//                   Clicking the SAME bar/legend row again, or clicking
//                   the background, clears the selection.
//                   Clicking an x-axis month label isolates that month.

import React, { useMemo, useState, type ReactNode } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, Bar, Line, LabelList,
  XAxis, YAxis, CartesianGrid, ReferenceDot, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'

import { fmtAmt, fmtCompact } from '@/lib/analyticsFormat'
import { bucketColor, OTHER_COLOR } from '@/lib/analyticsColors' 
import {
  type AnalyticsTab, type Hierarchy, type DonutView, type Focus,
  focusLabel, monthShort, enumerateMonths,
} from '@/lib/analyticsScope'
import { useAreaChartData } from '@/hooks/useAnalyticsDaily'
import { useAnalyticsBreakdown, toColumns } from '@/hooks/useAnalyticsBreakdown'

const CHART_H = 260

interface Props {
  tab:          AnalyticsTab
  months:       string[]
  bounds:       { start: string; endExclusive: string }
  hierarchy:    Hierarchy
  view:         DonutView
  focus:        Focus
  selection:    Focus | null
  scope:        string
  scopeKeyName: string | null
  colMonth:     string | null
  onToggleMonth: (m: string) => void
}

export function MasterChart(props: Props) {
  const isRange = props.months.length > 1
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      {isRange ? <ColumnView {...props} /> : <AreaView {...props} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// AREA — single month
// ════════════════════════════════════════════════════════════════════
function AreaView({ tab, months, focus, scope, scopeKeyName }: Props) {
  const selectedYM = months[0]
  const { points, todayDay, isLoading, isError } = useAreaChartData({
    tab, scope, key: scopeKeyName, selectedYM,
  })

  const lineColor = tab === 'earn' ? '#12c483' : '#3b82f6'
  const label     = focusLabel(focus)

  // Ring sits on the last plotted point of the solid line.
  const ringPoint = useMemo(() => {
    if (todayDay == null) return null
    const p = points.find(pt => pt.day === todayDay)
    return p && p.current != null ? { x: p.day, y: p.current } : null
  }, [points, todayDay])

  return (
    <>
      <Header
        title={`${label} · daily cumulative`}
        subtitle="This month vs the average of the last 3 months"
        legend={
          <>
            <LegendKey color={lineColor} label="This month" />
            <LegendKey color="#9ca3af" label="3-month avg" dashed />
          </>
        }
      />

      {isLoading ? (
        <Skeleton />
      ) : isError ? (
        <ErrorBox />
      ) : (
        <ResponsiveContainer width="100%" height={CHART_H}>
          <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
            accessibilityLayer={false}>
            <defs>
              <linearGradient id="areaCur" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={lineColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="areaAvg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#9ca3af" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#9ca3af" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#1e2d45" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#4b5563', fontSize: 10 }}
              axisLine={{ stroke: '#1e2d45' }} tickLine={false} interval={4} />
            <YAxis tickFormatter={fmtCompact} tick={{ fill: '#4b5563', fontSize: 10 }}
              axisLine={false} tickLine={false} width={44} />

            {/* Dashed: prior-3-month cumulative average */}
            <Area type="monotone" dataKey="average" stroke="#9ca3af" strokeWidth={1.6}
              strokeDasharray="5 4" fill="url(#areaAvg)" dot={false} connectNulls
              isAnimationActive animationDuration={700} />

            {/* Solid: selected month cumulative */}
            <Area type="monotone" dataKey="current" stroke={lineColor} strokeWidth={2.2}
              fill="url(#areaCur)" dot={false} connectNulls
              isAnimationActive animationDuration={700} />

            {/* Blinking "today" ring */}
            {ringPoint && (
              <ReferenceDot x={ringPoint.x} y={ringPoint.y} r={5}
                fill={lineColor} stroke="#080d1a" strokeWidth={2}
                shape={<BlinkRing color={lineColor} />} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </>
  )
}

function BlinkRing(props: any) {
  const { cx, cy, color } = props
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#080d1a" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={5} fill="none" stroke={color} strokeWidth={2} opacity={0.7}>
        <animate attributeName="r" values="5;13;5" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0;0.7" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </g>
  )
}

// ════════════════════════════════════════════════════════════════════
// COLUMN — month range
// ════════════════════════════════════════════════════════════════════
function ColumnView({
  tab, months, bounds, view, focus, colMonth, onToggleMonth, selection,
}: Props) {
  const [activeBucket, setActiveBucket] = useState<string | null>(null)
  
  // Memory state ensures the trend line morphs/fades smoothly without snapping
  const [lastActiveBucket, setLastActiveBucket] = useState<string | null>(null)

  // Accepts Recharts payload events or standard React Mouse events.
  // Clicking the ALREADY-active bucket's own bar or legend row clears it
  // (same as clicking the background) instead of just re-selecting it.
  const handleSelect = (b: string | null, event?: any) => {
    if (event && event.stopPropagation) {
      event.stopPropagation() 
    }
    const next = (b !== null && activeBucket === b) ? null : b
    setActiveBucket(next)
    if (next) setLastActiveBucket(next)
  }

  const { data: rows = [], isLoading, isError } = useAnalyticsBreakdown({
    tab, start: bounds.start, endExclusive: bounds.endExclusive, view,
  })

  const monthKeys = useMemo(
    () => enumerateMonths(months[0], months[months.length - 1]),
    [months],
  )

  const selectedBucket = selection && selection.kind !== 'total' ? selection.name : null
  const scopedRows = useMemo(
    () => (selectedBucket ? rows.filter(r => r.bucket === selectedBucket) : rows),
    [rows, selectedBucket],
  )

  const { buckets, data, otherKey } = useMemo(() => toColumns(scopedRows, monthKeys, 6), [scopedRows, monthKeys])

  const colorOf = (b: string) => (b === otherKey ? OTHER_COLOR : bucketColor(view.dimension, b))

  const activeSafe = activeBucket && buckets.includes(activeBucket) ? activeBucket : null
  
  // Stable target for the <Line> component to prevent DOM unmount loops
  const lineTarget = (lastActiveBucket && buckets.includes(lastActiveBucket)) ? lastActiveBucket : buckets[0]
  const lineColor = lineTarget ? colorOf(lineTarget) : '#fff'

  return (
    <div onClick={() => handleSelect(null)} className="h-full w-full block cursor-default">
      {/* Clicking anywhere in this wrapper clears the selection */}
      
      <Header
        title={`${focusLabel(focus)} · by month`}
        subtitle={colMonth
          ? `Isolating ${monthShort(colMonth)} — tap it again to clear`
          : activeSafe
            ? `${activeSafe} — trend across every month`
            : 'Tap a month label to isolate it · Tap a column to view its trend'}
        legend={
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-end">
            {buckets.map(b => (
              <LegendKey
                key={b}
                color={colorOf(b)}
                label={b}
                dim={activeSafe != null && activeSafe !== b}
                onClick={(e) => handleSelect(b, e)}
              />
            ))}
          </div>
        }
      />

      {isLoading ? (
        <Skeleton />
      ) : isError ? (
        <ErrorBox />
      ) : data.length === 0 || buckets.length === 0 ? (
        <div className="flex items-center justify-center text-center" style={{ height: CHART_H }}>
          <p className="font-dm text-sm text-soft">No data for this period.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={CHART_H}>
          <ComposedChart
            data={data}
            margin={{ top: 26, right: 12, bottom: 4, left: 4 }}
            barGap={2}
            barCategoryGap="22%"
            accessibilityLayer={false}
            // Prevents clicks on empty chart areas from propagating incorrectly in some browsers
            onClick={(e: any) => {
              if (e && e.activePayload == null) handleSelect(null)
            }}
          >
            <CartesianGrid stroke="#1e2d45" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={monthShort}
              tick={(p: any) => <MonthTick {...p} colMonth={colMonth} onToggleMonth={onToggleMonth} />}
              axisLine={{ stroke: '#1e2d45' }}
              tickLine={false}
              height={30}
              interval={0}
            />
            <YAxis tickFormatter={fmtCompact} tick={{ fill: '#4b5563', fontSize: 10 }}
              axisLine={false} tickLine={false} width={44} />

            {buckets.map(b => {
              const base = colorOf(b)
              return (
                <Bar 
                  key={b} 
                  dataKey={b} 
                  radius={[3, 3, 0, 0]}
                  // THE TRICK: Disable Recharts animations ONLY for the clicked bar.
                  // Initial load (activeSafe is null): true -> 600ms growth animation runs.
                  // On click (activeSafe === b): false -> LabelList bypasses the timer and snaps instantly.
                  isAnimationActive={activeSafe !== b}
                  animationDuration={600}
                  onClick={(_data: any, _index: number, event: any) => handleSelect(b, event)}
                  cursor="pointer"
                >
                  {data.map((row, i) => {
                    let alpha = 1
                    if (colMonth != null && row.month !== colMonth) alpha = 0.25
                    else if (activeSafe != null && activeSafe !== b) alpha = 0.4
                    
                    return (
                      <Cell 
                        key={i} 
                        fill={base} 
                        fillOpacity={alpha} 
                        style={{ transition: 'fill-opacity 250ms ease-in-out' }} 
                      />
                    )
                  })}

                  {b === activeSafe && (
                    <LabelList
                      dataKey={b}
                      position="top"
                      offset={8}
                      formatter={(v: any) => fmtAmt(Number(v) || 0)}
                      style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 11, fill: '#fff', pointerEvents: 'none' }}
                    />
                  )}
                </Bar>
              )
            })}

            <Line
              dataKey={lineTarget} 
              type="monotone"
              stroke={lineColor}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 3, fill: lineColor, stroke: '#080d1a', strokeWidth: 1.5 }}
              activeDot={false}
              isAnimationActive={true} 
              animationDuration={600}
              connectNulls
              style={{
                pointerEvents: 'none',
                opacity: activeSafe ? 1 : 0,
                transition: 'opacity 400ms ease-in-out',
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// Clickable x-axis month label (isolates a month). 
function MonthTick({ x, y, payload, colMonth, onToggleMonth }: any) {
  const m        = payload.value as string
  const isActive = colMonth === m
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dy={14} textAnchor="middle"
        className="cursor-pointer select-none"
        onClick={(e) => {
          e.stopPropagation()
          onToggleMonth(m)
        }}
        style={{
          fill: isActive ? '#3b82f6' : '#9ca3af',
          fontSize: 11,
          fontWeight: isActive ? 700 : 500,
        }}
      >
        {monthShort(m)}
      </text>
    </g>
  )
}

// ── Shared chrome ───────────────────────────────────────────────────
function Header({ title, subtitle, legend }: {
  title: string; subtitle: string; legend: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-3 pointer-events-none">
      <div className="min-w-0">
        <p className="font-sora text-sm font-bold text-white truncate">{title}</p>
        <p className="font-dm text-[11px] text-muted truncate">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3 flex-none pointer-events-auto">{legend}</div>
    </div>
  )
}

function LegendKey({ color, label, dashed, dim, onClick }: {
  color: string; label: string; dashed?: boolean
  dim?: boolean
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 transition-opacity duration-150',
        onClick && 'cursor-pointer',
        dim ? 'opacity-50' : 'opacity-100',
      )}
    >
      {dashed
        ? <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: color }} />
        : <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}
      <span className="font-dm text-[10px] text-soft whitespace-nowrap select-none">{label}</span>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="flex items-end gap-2 animate-pulse" style={{ height: CHART_H }}>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex-1 rounded-t bg-panel" style={{ height: `${30 + (i % 4) * 15}%` }} />
      ))}
    </div>
  )
}

function ErrorBox() {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ height: CHART_H }}>
      <p className="font-sora text-sm text-red mb-1">Couldn't load chart data</p>
      <p className="font-dm text-xs text-soft">Check your connection and try again.</p>
    </div>
  )
}