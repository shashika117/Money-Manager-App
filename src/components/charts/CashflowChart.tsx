import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { MonthlySummary } from '@/hooks/useMonthlyCashflow'

// ── Props ──────────────────────────────────────────────────────────
interface CashflowChartProps {
  data:          MonthlySummary[]
  selectedYear:  number
  selectedMonth: number
  onSelectMonth: (year: number, month: number) => void
  isLoading?:    boolean
  className?:    string
}

// ── Helpers ────────────────────────────────────────────────────────
/*
function fmtK(n: number): string {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${(a / 1_000_000).toFixed(1)}M`
  if (a >= 10_000)    return `${Math.round(a / 1_000)}K`
  if (a >= 1_000)     return `${(a / 1_000).toFixed(1)}K`
  return a.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
*/

// ── CashflowChart ──────────────────────────────────────────────────
export function CashflowChart({
  data,
  selectedYear,
  selectedMonth,
  onSelectMonth,
  isLoading = false,
  className,
}: CashflowChartProps) {
  const containerRef               = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisible] = useState(5)
  const [windowStart,  setStart]   = useState(0)

  // ── Responsive: measure container width ──────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      setVisible(w >= 560 ? 7 : w >= 420 ? 6 : w >= 300 ? 5 : 4)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── Seed windowStart: current month near right edge ──────────────
  useEffect(() => {
    if (data.length === 0) return
    const now = new Date()
    const idx  = data.findIndex(d => d.year === now.getFullYear() && d.month === now.getMonth() + 1)
    const tgt  = idx !== -1 ? idx : data.length - 1
    setStart(Math.max(0, tgt - visibleCount + 2))
  }, [data.length, visibleCount])

  // ── Sync windowStart when external month selection changes ────────
  useEffect(() => {
    const idx = data.findIndex(d => d.year === selectedYear && d.month === selectedMonth)
    if (idx === -1) return
    const maxStart = Math.max(0, data.length - visibleCount)
    if (idx < windowStart) {
      setStart(Math.max(0, idx))
    } else if (idx >= windowStart + visibleCount) {
      setStart(Math.min(maxStart, idx - visibleCount + 2))
    }
  }, [selectedYear, selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ──────────────────────────────────────────────────
  const visible   = data.slice(windowStart, windowStart + visibleCount)
  const n         = visible.length
  const maxVal    = Math.max(...data.map(d => Math.max(d.income, d.expense, Math.abs(d.net))), 1)
  const canPrev   = windowStart > 0
  const canNext   = windowStart + visibleCount < data.length
  const CHART_H   = 216  // px — total bar area height

  // ── Loading skeleton ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={cn('rounded-xl bg-card border border-line p-3', className)}>
        <div className="flex gap-1 items-center" style={{ height: CHART_H }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-8 rounded-t-sm bg-panel animate-pulse" style={{ height: `${30 + i * 10}%` }} />
              <div className="w-8 rounded-b-sm bg-panel animate-pulse" style={{ height: `${20 + i * 6}%` }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (data.length === 0) return null

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className={cn('rounded-xl bg-card border border-line p-3', className)}>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-2">
        <span className="font-dm text-[10px] text-muted uppercase tracking-wide">Cashflow</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green/70" />
          <span className="font-dm text-[10px] text-soft">Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red/70" />
          <span className="font-dm text-[10px] text-soft">Expense</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-amber rounded-full" />
          <span className="font-dm text-[10px] text-soft">Net</span>
        </div>
      </div>

      {/* Bars row */}
      <div className="flex items-center gap-1" ref={containerRef}>

        {/* ‹ Prev */}
        <button
          onClick={() => setStart(s => Math.max(0, s - 1))}
          disabled={!canPrev}
          className={cn(
            'flex-none h-8 w-6 flex items-center justify-center rounded font-sora text-base transition-colors',
            canPrev ? 'text-soft hover:text-white hover:bg-panel' : 'text-line cursor-default',
          )}
        >
          ‹
        </button>

        {/* ── Bar + SVG area ── */}
        <div className="flex-1 relative" style={{ height: CHART_H }}>

          {/* Pillar buttons */}
          <div className="flex h-full">
            {visible.map((d) => {
              const isSel       = d.year === selectedYear && d.month === selectedMonth
              const incomeRatio  = d.income  / maxVal
              const expenseRatio = d.expense / maxVal

              return (
                <button
                  key={`${d.year}-${d.month}`}
                  type="button"
                  onClick={() => onSelectMonth(d.year, d.month)}
                  className={cn(
                    'flex-1 flex flex-col items-center rounded touch-manipulation',
                    'transition-all duration-200',
                    isSel ? 'opacity-100' : 'opacity-50 hover:opacity-75',
                  )}
                >
                  {/* Upper half — income grows UP from centre */}
                  <div className="flex-1 w-full flex items-end justify-center pb-px">
                    <div
                      style={{
                        height:   `${Math.max(incomeRatio * 92, d.income > 0 ? 3 : 0)}%`,
                        width:    isSel ? '62%' : '50%',
                        minHeight: d.income > 0 ? 2 : 0,
                      }}
                      className={cn(
                        'rounded-t transition-all duration-700 ease-out',
                        isSel
                          ? 'bg-green shadow-[0_-2px_8px_rgba(16,185,129,0.35)]'
                          : 'bg-green/60',
                      )}
                    />
                  </div>

                  {/* Lower half — expense grows DOWN from centre */}
                  <div className="flex-1 w-full flex items-start justify-center pt-px">
                    <div
                      style={{
                        height:   `${Math.max(expenseRatio * 92, d.expense > 0 ? 3 : 0)}%`,
                        width:    isSel ? '62%' : '50%',
                        minHeight: d.expense > 0 ? 2 : 0,
                      }}
                      className={cn(
                        'rounded-b transition-all duration-700 ease-out',
                        isSel
                          ? 'bg-red shadow-[0_2px_8px_rgba(239,68,68,0.35)]'
                          : 'bg-red/60',
                      )}
                    />
                  </div>
                </button>
              )
            })}
          </div>

          {/* SVG overlay — zero line + net polyline */}
          {n > 0 && (
            <svg
              viewBox={`0 0 ${n} 1`}
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 2 }}
            >
              {/* Zero / centre line */}
              <line
                x1="0" y1="0.5"
                x2={n} y2="0.5"
                stroke="#1e2d45"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />

              {/* Net total polyline */}
              {n > 1 && (
                <polyline
                  points={visible.map((d, i) => {
                    const clamped = Math.max(-maxVal, Math.min(maxVal, d.net))
                    const x = i + 0.5
                    const y = 0.5 - (clamped / maxVal) * 0.44
                    return `${x},${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
            </svg>
          )}

          {/* Net dots — perfectly circular CSS divs */}
          {visible.map((d, i) => {
            const clamped = Math.max(-maxVal, Math.min(maxVal, d.net))
            const x       = (i + 0.5) / n * 100
            const y       = (0.5 - (clamped / maxVal) * 0.44) * 100
            const isSel   = d.year === selectedYear && d.month === selectedMonth

            return (
              <div
                key={`dot-${i}`}
                className={cn(
                  'absolute rounded-full bg-amber border-2 border-card pointer-events-none',
                  '-translate-x-1/2 -translate-y-1/2 transition-all duration-500',
                  isSel ? 'w-3 h-3' : 'w-2 h-2',
                )}
                style={{ left: `${x}%`, top: `${y}%`, zIndex: 3 }}
              />
            )
          })}
        </div>

        {/* › Next */}
        <button
          onClick={() => setStart(s => Math.min(Math.max(0, data.length - visibleCount), s + 1))}
          disabled={!canNext}
          className={cn(
            'flex-none h-8 w-6 flex items-center justify-center rounded font-sora text-base transition-colors',
            canNext ? 'text-soft hover:text-white hover:bg-panel' : 'text-line cursor-default',
          )}
        >
          ›
        </button>
      </div>

      {/* Month labels row — aligned with the bars */}
      <div className="flex mt-1">
        <div className="w-7 flex-none" /> {/* aligns with ‹ arrow */}
        {visible.map((d, i) => {
          const isSel = d.year === selectedYear && d.month === selectedMonth
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectMonth(d.year, d.month)}
              className={cn(
                'flex-1 text-center font-dm py-0.5 touch-manipulation transition-colors',
                isSel ? 'text-green font-semibold text-[10px]' : 'text-muted text-[9px] hover:text-soft',
              )}
            >
              {d.label}
            </button>
          )
        })}
        <div className="w-7 flex-none" /> {/* aligns with › arrow */}
      </div>
    </div>
  )
}
