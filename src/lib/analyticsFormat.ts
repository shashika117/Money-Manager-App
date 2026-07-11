// src/lib/analyticsFormat.ts
//
// Number / label formatting for the Analytics page. en-US grouping to
// match the rest of the app (248,500.00).

import { monthLabel, monthShort, splitYM } from '@/lib/analyticsScope'

export function fmtAmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Compact form for chart axes / the donut centre (1.2M, 248.5K, 940).
export function fmtCompact(n: number): string {
  const v = Math.abs(n)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}K`
  return v.toFixed(0)
}

export function fmtPct(part: number, total: number): string {
  if (total <= 0) return '0.0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

// The Period filter button's label.
//   single month        → 'Jul 2026'
//   range, same year    → 'Apr – Jun 2026'
//   range, across years → 'Nov 2025 – Feb 2026'
export function periodLabel(months: string[]): string {
  if (months.length === 0) return '—'
  if (months.length === 1) return monthLabel(months[0])

  const first = months[0]
  const last  = months[months.length - 1]
  const fy = splitYM(first).year
  const ly = splitYM(last).year

  return fy === ly
    ? `${monthShort(first)} – ${monthShort(last)} ${ly}`
    : `${monthLabel(first)} – ${monthLabel(last)}`
}