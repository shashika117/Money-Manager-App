// src/components/home/SpendingAreaCard.tsx
//
// A compact, read-only version of the Analytics area chart: this month's
// daily cumulative spending vs the average of the last 3 months, with the
// blinking "today" ring.
//
// Scope = 'spend_total_cats' → Needs + Wants only (Save EXCLUDED), per spec.
// No interactivity beyond the hover tooltip. Laptop only (the Home page
// simply doesn't render this card on mobile).

import { useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot,
} from 'recharts'
import { fmtAmt, fmtCompact } from '@/lib/analyticsFormat'
import { currentYM } from '@/lib/analyticsScope'
import { useAreaChartData } from '@/hooks/useAnalyticsDaily'
import { HomeCard } from '@/components/home/HomeCard'

const CHART_H = 190
const LINE    = '#3b82f6'

export function SpendingAreaCard() {
  const selectedYM = currentYM()

  const { points, todayDay, isLoading, isError } = useAreaChartData({
    tab:   'spend',
    scope: 'spend_total_cats',   // Needs + Wants, no Save
    key:   null,
    selectedYM,
  })

  const ringPoint = useMemo(() => {
    if (todayDay == null) return null
    const p = points.find(pt => pt.day === todayDay)
    return p && p.current != null ? { x: p.day, y: p.current } : null
  }, [points, todayDay])

  return (
    <HomeCard
      title="Cumulative Spending"
      subtitle="This month vs last 3-month average"
      to="/analytics"
    >
      <div className="px-2 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center" style={{ height: CHART_H }}>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue border-t-transparent" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center text-center" style={{ height: CHART_H }}>
            <p className="font-sora text-xs text-red">Couldn't load chart</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={CHART_H}>
            <ComposedChart data={points} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="homeAreaCur" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={LINE} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={LINE} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="homeAreaAvg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#9ca3af" stopOpacity={0.14} />
                  <stop offset="100%" stopColor="#9ca3af" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="#1e2d45" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#4b5563', fontSize: 9 }}
                axisLine={{ stroke: '#1e2d45' }} tickLine={false} interval={6} />
              <YAxis tickFormatter={fmtCompact} tick={{ fill: '#4b5563', fontSize: 9 }}
                axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<Tip />} cursor={{ stroke: '#1e2d45', strokeWidth: 1 }} />

              <Area type="monotone" dataKey="average" stroke="#9ca3af" strokeWidth={1.4}
                strokeDasharray="5 4" fill="url(#homeAreaAvg)" dot={false} connectNulls
                isAnimationActive animationDuration={700} />

              <Area type="monotone" dataKey="current" stroke={LINE} strokeWidth={2}
                fill="url(#homeAreaCur)" dot={false} connectNulls
                isAnimationActive animationDuration={700} />

              {ringPoint && (
                <ReferenceDot x={ringPoint.x} y={ringPoint.y} r={4}
                  shape={<BlinkRing color={LINE} />} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </HomeCard>
  )
}

function BlinkRing(props: any) {
  const { cx, cy, color } = props
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={color} stroke="#080d1a" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={4} fill="none" stroke={color} strokeWidth={2} opacity={0.7}>
        <animate attributeName="r" values="4;11;4" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0;0.7" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </g>
  )
}

function Tip({ active, payload, label }: any) {
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
