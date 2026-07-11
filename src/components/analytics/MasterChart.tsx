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
//                   Clicking a bar drills (synced with the donut).
//                   Clicking an x-axis month label isolates that month
//                   (others muted) and pushes it into the donut.
//
// Both inherit the Period + Hierarchy filters and the donut's drill focus.

import { useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { fmtAmt, fmtCompact } from '@/lib/analyticsFormat'
import { bucketColor, muted } from '@/lib/analyticsColors'
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
          <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
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
            <Tooltip content={<AreaTip />} cursor={{ stroke: '#1e2d45', strokeWidth: 1 }} />

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

// Pulsing ring for "today".
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

function AreaTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const cur = payload.find((p: any) => p.dataKey === 'current')?.value
  const avg = payload.find((p: any) => p.dataKey === 'average')?.value
  return (
    <div className="rounded-xl border border-line bg-navy px-3 py-2 shadow-xl">
      <p className="font-sora text-xs font-semibold text-white mb-1">Day {label}</p>
      {cur != null && (
        <p className="font-dm text-[11px] text-soft">
          This month: <span className="font-sora font-semibold text-white tabular-nums">{fmtAmt(cur)}</span>
        </p>
      )}
      {avg != null && (
        <p className="font-dm text-[11px] text-soft">
          3-month avg: <span className="font-sora font-semibold text-white tabular-nums">{fmtAmt(avg)}</span>
        </p>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// COLUMN — month range
// ════════════════════════════════════════════════════════════════════
function ColumnView({
  tab, months, bounds, view, focus, colMonth, onToggleMonth,
}: Props) {
  const { data: rows = [], isLoading, isError } = useAnalyticsBreakdown({
    tab, start: bounds.start, endExclusive: bounds.endExclusive, view,
  })

  const monthKeys = useMemo(
    () => enumerateMonths(months[0], months[months.length - 1]),
    [months],
  )
  const { buckets, data } = useMemo(() => toColumns(rows, monthKeys, 6), [rows, monthKeys])

  // Clicking a bar does the SAME thing as clicking its month label: isolate
  // that month (drilling from a bar was too easy to trigger by accident —
  // drilling now lives solely in the donut's legend).
  const isolateAt = (index: number) => {
    const m = data[index]?.month
    if (typeof m === 'string') onToggleMonth(m)
  }

  return (
    <>
      <Header
        title={`${focusLabel(focus)} · by month`}
        subtitle={colMonth
          ? `Isolating ${monthShort(colMonth)} — tap it again to clear`
          : 'Tap a month (bar or label) to isolate it · drill down from the donut legend'}
        legend={
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-end">
            {buckets.map(b => (
              <LegendKey key={b} color={bucketColor(view.dimension, b)} label={b} />
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
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }} barGap={2} barCategoryGap="22%">
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
            <Tooltip content={<ColumnTip />} cursor={{ fill: '#111e33', opacity: 0.5 }} />

            {buckets.map(b => {
              const base = bucketColor(view.dimension, b)
              return (
                <Bar key={b} dataKey={b} radius={[3, 3, 0, 0]}
                  isAnimationActive animationDuration={600}
                  onClick={(_: any, index: number) => isolateAt(index)}
                  cursor="pointer">
                  {data.map((row, i) => {
                    const dim = colMonth != null && row.month !== colMonth
                    return <Cell key={i} fill={dim ? muted(base, 0.25) : base} />
                  })}
                </Bar>
              )
            })}
          </BarChart>
        </ResponsiveContainer>
      )}
    </>
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
        onClick={() => onToggleMonth(m)}
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

function ColumnTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((p: any) => Number(p.value) > 0)
  if (rows.length === 0) return null
  return (
    <div className="rounded-xl border border-line bg-navy px-3 py-2 shadow-xl">
      <p className="font-sora text-xs font-semibold text-white mb-1">{monthShort(label)}</p>
      {rows.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm flex-none" style={{ background: p.color }} />
          <span className="font-dm text-[11px] text-soft flex-1">{p.dataKey}</span>
          <span className="font-sora text-[11px] font-semibold text-white tabular-nums">{fmtAmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Shared chrome ───────────────────────────────────────────────────
function Header({ title, subtitle, legend }: {
  title: string; subtitle: string; legend: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-3">
      <div className="min-w-0">
        <p className="font-sora text-sm font-bold text-white truncate">{title}</p>
        <p className="font-dm text-[11px] text-muted truncate">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3 flex-none">{legend}</div>
    </div>
  )
}

function LegendKey({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {dashed
        ? <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: color }} />
        : <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}
      <span className="font-dm text-[10px] text-soft whitespace-nowrap">{label}</span>
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
