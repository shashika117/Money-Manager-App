// src/pages/dashboard/AnalyticsPage.tsx
//
// Analytics page shell. Owns ALL shared state and derives every child's
// parameters from it:
//
//   tab        'spend' | 'earn'                (Hierarchy filter is spend-only)
//   months     applied Period selection (1-6 contiguous months)
//   hierarchy  'group' | 'category'            (spend only)
//   focusStack Focus[] — the drill path; last entry is the active Focus.
//              The donut's back-arrow pops one level (exact, not inferred).
//   colMonth   a month isolated by clicking a column-chart x-axis label
//              (null = whole range). Drives the donut + history table.
//
// Layout
//   Laptop (lg+): master chart full width on top, then a 1:1 row —
//                 donut left, history table right.
//   Mobile:       no master chart. Donut on top, history table below.
//
// NOTE: default export — App.tsx lazy-loads this route.

import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  type AnalyticsTab, type Hierarchy, type Focus,
  donutView, resolveScope, focusOnClick, isTerminalClick,
  currentYM, periodBounds,
} from '@/lib/analyticsScope'
import { PeriodFilter }    from '@/components/analytics/PeriodFilter'
import { HierarchyFilter } from '@/components/analytics/HierarchyFilter'
import { AnalyticsDonut }  from '@/components/analytics/AnalyticsDonut'
import { MasterChart }     from '@/components/analytics/MasterChart'
import { AnalyticsHistoryTable } from '@/components/analytics/AnalyticsHistoryTable'

function useIsLaptop() {
  const [isLaptop, setIsLaptop] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsLaptop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isLaptop
}

export default function AnalyticsPage() {
  const isLaptop = useIsLaptop()

  // ── Shared state ──────────────────────────────────────────────────
  const [tab, setTab]             = useState<AnalyticsTab>('spend')
  const [months, setMonths]       = useState<string[]>([currentYM()])
  const [hierarchy, setHierarchy] = useState<Hierarchy>('group')
  const [focusStack, setStack]    = useState<Focus[]>([{ kind: 'total' }])
  const [colMonth, setColMonth]   = useState<string | null>(null)

  const focus     = focusStack[focusStack.length - 1]
  const isRange   = months.length > 1
  const bounds    = useMemo(() => periodBounds(months), [months])
  const view      = useMemo(() => donutView(tab, hierarchy, focus), [tab, hierarchy, focus])
  const scopeKey  = useMemo(() => resolveScope(tab, hierarchy, focus), [tab, hierarchy, focus])

  // Changing tab / hierarchy / period invalidates the drill path.
  function resetDrill() { setStack([{ kind: 'total' }]) }

  function switchTab(t: AnalyticsTab) {
    if (t === tab) return
    setTab(t); resetDrill(); setColMonth(null)   // period persists across tabs (per spec)
  }
  function changeHierarchy(h: Hierarchy) {
    if (h === hierarchy) return
    setHierarchy(h); resetDrill()
  }
  function changePeriod(m: string[]) {
    setMonths(m); resetDrill(); setColMonth(null)
  }

  // Donut / column bucket click → drill (or just select, if terminal).
  function selectBucket(bucket: string) {
    const next = focusOnClick(tab, view, bucket)
    if (isTerminalClick(view, bucket)) {
      // Terminal: replace the top of the stack so the charts/table
      // re-scope, but the donut stays on the same level.
      setStack(s => {
        const base = s[s.length - 1].kind === 'subcategory' ? s.slice(0, -1) : s
        return [...base, next]
      })
      return
    }
    setStack(s => [...s, next])
  }
  function drillBack() {
    setStack(s => (s.length > 1 ? s.slice(0, -1) : s))
  }

  // A column-chart month label isolates that month (click again = clear).
  function toggleColMonth(m: string) {
    setColMonth(prev => (prev === m ? null : m))
  }

  // The donut / table honour an isolated column month; otherwise the range.
  const activeMonth = colMonth ?? (isRange ? null : months[0])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in">

      {/* ══ HEADER ══ */}
      <div className="flex-none border-b border-line bg-card px-4 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>

        {/* Row 1: title + (laptop) tabs + filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-sora text-xl font-bold text-white leading-none">Analytics</h1>

          {/* Laptop: tabs sit right beside the page name */}
          {isLaptop && <Tabs tab={tab} onChange={switchTab} />}

          <div className="ml-auto flex items-center gap-2">
            {tab === 'spend' && (
              <HierarchyFilter value={hierarchy} onChange={changeHierarchy} />
            )}
            <PeriodFilter months={months} onChange={changePeriod} />
          </div>
        </div>

        {/* Row 2 (mobile): tabs below the page name */}
        {!isLaptop && (
          <div className="mt-3">
            <Tabs tab={tab} onChange={switchTab} />
          </div>
        )}
      </div>

      {/* ══ BODY ══ */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-safe-bottom px-4 py-4">
        <div className="flex flex-col gap-4">

          {/* Master chart — laptop only, full width */}
          {isLaptop && (
            <MasterChart
              tab={tab}
              months={months}
              bounds={bounds}
              hierarchy={hierarchy}
              view={view}
              focus={focus}
              scope={scopeKey.scope}
              scopeKeyName={scopeKey.key}
              colMonth={colMonth}
              onSelectBucket={selectBucket}
              onToggleMonth={toggleColMonth}
            />
          )}

          {/* Donut + History */}
          <div className={cn(isLaptop ? 'flex gap-4 items-start' : 'flex flex-col gap-4')}>
            <div className={cn(isLaptop ? 'w-1/2' : 'w-full')}>
              <AnalyticsDonut
                tab={tab}
                bounds={bounds}
                view={view}
                focus={focus}
                activeMonth={activeMonth}
                canDrillBack={focusStack.length > 1}
                onSelectBucket={selectBucket}
                onDrillBack={drillBack}
              />
            </div>

            <div className={cn(isLaptop ? 'w-1/2' : 'w-full')}>
              <AnalyticsHistoryTable
                tab={tab}
                bounds={bounds}
                months={months}
                scope={scopeKey.scope}
                scopeKeyName={scopeKey.key}
                colMonth={colMonth}
                onSelectMonth={toggleColMonth}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tabs ────────────────────────────────────────────────────────────
function Tabs({ tab, onChange }: { tab: AnalyticsTab; onChange: (t: AnalyticsTab) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-panel p-1">
      <TabBtn active={tab === 'spend'} onClick={() => onChange('spend')}>Spending</TabBtn>
      <TabBtn active={tab === 'earn'}  onClick={() => onChange('earn')}>Earning</TabBtn>
    </div>
  )
}

function TabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn('rounded-lg px-4 py-1.5 font-dm text-sm font-medium transition-colors touch-manipulation',
        active ? 'bg-blue text-white shadow-sm shadow-blue/30' : 'text-soft hover:text-white')}>
      {children}
    </button>
  )
}
