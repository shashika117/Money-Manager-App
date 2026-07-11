// src/hooks/useAnalyticsBreakdown.ts
//
// Wraps get_analytics_breakdown → one row per (month, bucket). Powers the
// donut (sum across the range, or a single month) and the column chart
// (per-month clusters, top-6 + Other). Selection/hierarchy changes refetch;
// the pure `toDonut` / `toColumns` derivations run on the cached rows.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AnalyticsTab, DonutView } from '@/lib/analyticsScope'

export interface BreakdownRow {
  month:  string   // 'YYYY-MM'
  bucket: string
  amount: number
}

export function useAnalyticsBreakdown(params: {
  tab:          AnalyticsTab
  start:        string        // 'YYYY-MM-01'
  endExclusive: string        // 'YYYY-MM-01'
  view:         DonutView
  enabled?:     boolean
}) {
  const { tab, start, endExclusive, view, enabled = true } = params

  return useQuery<BreakdownRow[]>({
    queryKey: [
      'analytics_breakdown', tab, start, endExclusive,
      view.dimension, view.filterGroup, view.filterCategory,
    ],
    queryFn: async () => {
      // The generated types make the DEFAULT NULL params optional
      // (string | undefined), so map null → undefined. Omitting them
      // lets Postgres apply its own NULL default — same result.
      const { data, error } = await supabase.rpc('get_analytics_breakdown', {
        p_start:           start,
        p_end:             endExclusive,
        p_tab:             tab,
        p_dimension:       view.dimension,
        p_filter_group:    view.filterGroup    ?? undefined,
        p_filter_category: view.filterCategory ?? undefined,
      })
      if (error) throw error
      return (data as { month: string; bucket: string; amount: number }[] ?? []).map(r => ({
        month:  String(r.month).slice(0, 7),   // 'YYYY-MM'
        bucket: r.bucket,
        amount: Number(r.amount),
      }))
    },
    enabled,
    staleTime: 1000 * 60,
  })
}

// ── Donut: sum across the whole range, or isolate one month ─────────
export interface DonutSlice { bucket: string; amount: number }

export function toDonut(rows: BreakdownRow[], monthYM?: string | null): DonutSlice[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (monthYM && r.month !== monthYM) continue
    map.set(r.bucket, (map.get(r.bucket) ?? 0) + r.amount)
  }
  return Array.from(map.entries())
    .map(([bucket, amount]) => ({ bucket, amount }))
    .filter(s => s.amount > 0)              // legend: non-zero rows only
    .sort((a, b) => b.amount - a.amount)
}

export function donutTotal(slices: DonutSlice[]): number {
  return slices.reduce((s, d) => s + d.amount, 0)
}

// ── Column chart: top-N buckets by RANGE total (+ Other), per month ──
// Returns recharts-ready rows: [{ month, [bucket]: value, ... }].
export interface ColumnData {
  buckets:   string[]                              // ordered; may include the spill bucket
  data:      Record<string, number | string>[]     // one row per month
  otherKey:  string | null                         // the spill bucket's label, if any
}

// The spill bucket is normally called "Other" — but a REAL category can
// also be named "Other" (transfer fees map to it). If that real category
// is among the kept buckets, a second literal 'Other' would collide:
// duplicate legend rows and duplicate React keys. Fall back to a label
// that can't clash.
function pickOtherLabel(taken: Set<string>): string {
  if (!taken.has('Other')) return 'Other'
  let label = 'Other (rest)'
  let n = 2
  while (taken.has(label)) label = `Other (rest ${n++})`
  return label
}

export function toColumns(rows: BreakdownRow[], monthKeys: string[], topN = 6): ColumnData {
  // Rank buckets by their total across the whole selected range so the SAME
  // buckets appear in every month's cluster (stable columns + colors).
  const totals = new Map<string, number>()
  for (const r of rows) totals.set(r.bucket, (totals.get(r.bucket) ?? 0) + r.amount)

  const ranked = Array.from(totals.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  const keep     = ranked.slice(0, topN).map(([b]) => b)
  const keepSet  = new Set(keep)
  const hasOther = ranked.length > topN
  const otherKey = hasOther ? pickOtherLabel(keepSet) : null
  const buckets  = otherKey ? [...keep, otherKey] : keep

  // Fold each month's rows into kept buckets (spill → the Other bucket).
  const cell = new Map<string, number>()   // key = `${month}|${bucket}`
  for (const r of rows) {
    const b = keepSet.has(r.bucket) ? r.bucket : otherKey
    if (!b) continue                        // no spill bucket → nothing to fold into
    const k = `${r.month}|${b}`
    cell.set(k, (cell.get(k) ?? 0) + r.amount)
  }

  const data = monthKeys.map(m => {
    const row: Record<string, number | string> = { month: m }
    for (const b of buckets) row[b] = cell.get(`${m}|${b}`) ?? 0
    return row
  })

  return { buckets, data, otherKey }
}