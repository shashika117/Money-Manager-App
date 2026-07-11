// src/components/home/NwsGaugeCard.tsx
//
// The Actual NWS score as a clean, minimalist needle gauge.
//
// Design (per spec): NO heavy coloured bands behind the arc. The track is
// a single neutral arc; the NEEDLE, the progress arc and the numeric value
// all take their colour from nwsColor(score) — so the gauge's colour is
// itself the status signal (red → amber → green as the score climbs).

import { useMemo } from 'react'
import { useBudgetSummary } from '@/hooks/useBudgetSummary'
import { nwsColor, monthKey } from '@/lib/budgetFormat'
import { HomeCard } from '@/components/home/HomeCard'

// Geometry: a 180° arc from left (-180°) to right (0°).
const W = 220, H = 124
const CX = W / 2, CY = 108
const R = 84

function polar(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

// score 0..100 → angle -180..0
function scoreToAngle(score: number): number {
  const t = Math.max(0, Math.min(100, score)) / 100
  return -180 + t * 180
}

function arc(from: number, to: number, r: number): string {
  const a = polar(r, from)
  const b = polar(r, to)
  const large = Math.abs(to - from) > 180 ? 1 : 0
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`
}

export function NwsGaugeCard() {
  const now   = new Date()
  const month = monthKey(now.getFullYear(), now.getMonth() + 1)
  const { data: summary, isLoading } = useBudgetSummary(month)

  const score = summary?.actual_nws ?? 0
  const color = nwsColor(score)
  const angle = useMemo(() => scoreToAngle(score), [score])

  const needle    = polar(R - 14, angle)
  const needleEnd = polar(8, angle + 180)   // small tail past the hub

  return (
    <HomeCard title="NWS Score" subtitle="Actual · this month" to="/budget">
      <div className="flex flex-col items-center px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center" style={{ height: H }}>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-green border-t-transparent" />
          </div>
        ) : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[220px] animate-fade-in-scale"
              style={{ height: H }}>
              {/* Neutral track */}
              <path d={arc(-180, 0, R)} fill="none" stroke="#1e2d45"
                strokeWidth={10} strokeLinecap="round" />

              {/* Progress arc — colour = status */}
              <path d={arc(-180, angle, R)} fill="none" stroke={color}
                strokeWidth={10} strokeLinecap="round"
                style={{ transition: 'stroke 600ms ease, d 600ms ease' }} />

              {/* End-of-scale ticks */}
              <text x={CX - R} y={CY + 16} textAnchor="middle"
                style={{ fill: '#4b5563', fontSize: 9 }}>0</text>
              <text x={CX + R} y={CY + 16} textAnchor="middle"
                style={{ fill: '#4b5563', fontSize: 9 }}>100</text>

              {/* Needle */}
              <line
                x1={needleEnd.x} y1={needleEnd.y}
                x2={needle.x}    y2={needle.y}
                stroke={color} strokeWidth={2.5} strokeLinecap="round"
                style={{ transition: 'all 600ms cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
              {/* Hub */}
              <circle cx={CX} cy={CY} r={6} fill="#0f1929" stroke={color} strokeWidth={2.5} />
            </svg>

            {/* Numeric value */}
            <div className="-mt-3 text-center">
              <p className="font-sora text-2xl font-bold tabular-nums leading-none"
                style={{ color }}>
                {score.toFixed(0)}%
              </p>
              <p className="mt-1 font-dm text-[10px] uppercase tracking-wider text-muted">
                Needs · Wants · Save
              </p>
            </div>
          </>
        )}
      </div>
    </HomeCard>
  )
}
