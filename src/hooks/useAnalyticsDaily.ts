// src/hooks/useAnalyticsDaily.ts
//
// Wraps get_analytics_daily → plain daily sums for one resolved scope.
// useAreaChartData composes two of these (selected month + the REAL current
// month's prior-3-month window) and derives the two cumulative curves:
//   • current : selected month's daily cumulative (stops at today only when
//               the selected month IS the current month; else full month)
//   • average : prior-3-months daily cumulative, averaged per day-of-month
//               over the months that actually have that day.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  type AnalyticsTab,
  currentYM, addMonths, splitYM, daysInMonth, firstOfMonth, priorThreeBounds,
} from '@/lib/analyticsScope'

export interface DailyRow { d: string; amount: number }

export function useAnalyticsDaily(params: {
  tab:          AnalyticsTab
  start:        string        // 'YYYY-MM-01'
  endExclusive: string        // 'YYYY-MM-01'
  scope:        string
  key:          string | null
  enabled?:     boolean
}) {
  const { tab, start, endExclusive, scope, key, enabled = true } = params

  return useQuery<DailyRow[]>({
    queryKey: ['analytics_daily', tab, start, endExclusive, scope, key],
    queryFn: async () => {
      // p_key has a DEFAULT NULL → generated type is optional (string |
      // undefined). Map null → undefined; Postgres still sees NULL.
      const { data, error } = await supabase.rpc('get_analytics_daily', {
        p_start: start,
        p_end:   endExclusive,
        p_tab:   tab,
        p_scope: scope,
        p_key:   key ?? undefined,
      })
      if (error) throw error
      return (data as { d: string; amount: number }[] ?? []).map(r => ({
        d: String(r.d).slice(0, 10), amount: Number(r.amount),
      }))
    },
    enabled,
    staleTime: 1000 * 60,
  })
}

export interface AreaPoint {
  day:     number
  current: number | null   // selected month cumulative (null after today in current month)
  average: number | null   // prior-3-month cumulative average for this day-of-month
}

// Build a day-indexed cumulative array [0..dim] from daily rows of ONE month.
function cumulativeForMonth(rows: DailyRow[], ymKey: string): number[] {
  const { year, month } = splitYM(ymKey)
  const dim = daysInMonth(year, month)
  const daily = new Array(dim + 1).fill(0)
  for (const r of rows) {
    if (r.d.slice(0, 7) !== ymKey) continue
    const day = Number(r.d.slice(8, 10))
    if (day >= 1 && day <= dim) daily[day] += r.amount
  }
  const cum = new Array(dim + 1).fill(0)
  for (let d = 1; d <= dim; d++) cum[d] = cum[d - 1] + daily[d]
  return cum
}

export function useAreaChartData(params: {
  tab:        AnalyticsTab
  scope:      string
  key:        string | null
  selectedYM: string          // single selected month 'YYYY-MM'
  enabled?:   boolean
}) {
  const { tab, scope, key, selectedYM, enabled = true } = params

  // Selected-month window
  const selStart = firstOfMonth(selectedYM)
  const selEnd   = firstOfMonth(addMonths(selectedYM, 1))

  // Prior-3-month window — always relative to the REAL current month.
  const prior = priorThreeBounds()

  const selQ = useAnalyticsDaily({ tab, start: selStart, endExclusive: selEnd, scope, key, enabled })
  const avgQ = useAnalyticsDaily({ tab, start: prior.start, endExclusive: prior.endExclusive, scope, key, enabled })

  const cur          = currentYM()
  const isCurrent    = selectedYM === cur
  const todayDay     = isCurrent ? new Date().getDate() : null

  const points = useMemo<AreaPoint[]>(() => {
    const { year, month } = splitYM(selectedYM)
    const dim = daysInMonth(year, month)

    // Selected month cumulative
    const selCum = cumulativeForMonth(selQ.data ?? [], selectedYM)

    // Prior 3 months, each cumulative by day
    const priorCum = prior.months.map(mk => cumulativeForMonth(avgQ.data ?? [], mk))

    const pts: AreaPoint[] = []
    for (let d = 1; d <= dim; d++) {
      // average over prior months that actually have day d
      let sum = 0, count = 0
      for (const cum of priorCum) {
        if (d < cum.length) { sum += cum[d]; count++ }
      }
      const average = count > 0 ? sum / count : null

      let current: number | null = selCum[d] ?? 0
      if (isCurrent && todayDay != null && d > todayDay) current = null   // straight line stops at today

      pts.push({ day: d, current, average })
    }
    return pts
  }, [selQ.data, avgQ.data, selectedYM, isCurrent, todayDay, prior.months])

  return {
    points,
    todayDay,                                   // ring position; null for a past month
    isLoading: selQ.isLoading || avgQ.isLoading,
    isError:   selQ.isError   || avgQ.isError,
    hasData:   (selQ.data?.length ?? 0) > 0 || (avgQ.data?.length ?? 0) > 0,
  }
}