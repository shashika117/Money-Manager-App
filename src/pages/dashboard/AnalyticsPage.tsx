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
  // Two DISTINCT concepts, deliberately kept apart:
  //
  //   drillStack — the donut's navigation path. Only NON-terminal clicks
  //                push here (Needs → Food → …). The donut renders the
  //                children of whatever is on top.
  //   selection  — a TERMINAL pick (Save, a subcategory, an income
  //                category). It re-scopes the area chart + history table
  //                but does NOT move the donut. It's a single slot, so
  //                clicking "Meal" five times just replaces it five times
  //                — and ONE back-arrow press clears it.
  //
  // Merging these was the old bug: five taps meant five back presses.
  const [tab, setTab]             = useState<AnalyticsTab>('spend')
  const [months, setMonths]       = useState<string[]>([currentYM()])
  const [hierarchy, setHierarchy] = useState<Hierarchy>('category')
  const [drillStack, setStack]    = useState<Focus[]>([{ kind: 'total' }])
  const [selection, setSelection] = useState<Focus | null>(null)
  const [colMonth, setColMonth]   = useState<string | null>(null)

  // Drill/back slide animation (uses the existing slideFromLeft/Right keyframes).
  const [anim, setAnim] = useState<{ key: number; dir: 'down' | 'back' }>({ key: 0, dir: 'down' })

  const drillFocus = drillStack[drillStack.length - 1]   // what the DONUT shows
  const focus      = selection ?? drillFocus             // what the CHART + TABLE scope to

  const isRange   = months.length > 1
  const bounds    = useMemo(() => periodBounds(months), [months])
  const view      = useMemo(() => donutView(tab, hierarchy, drillFocus), [tab, hierarchy, drillFocus])
  const scopeKey  = useMemo(() => resolveScope(tab, hierarchy, focus), [tab, hierarchy, focus])

  // Changing tab / hierarchy / period invalidates the drill path.
  function resetDrill() {
    setStack([{ kind: 'total' }])
    setSelection(null)
    setAnim(a => ({ key: a.key + 1, dir: 'back' }))
  }

  function switchTab(t: AnalyticsTab) {
    if (t === tab) return
    setTab(t); resetDrill(); setColMonth(null)   // period persists across tabs (per spec)
  }
  function changeHierarchy(h: Hierarchy) {
    if (h === hierarchy) return
    setHierarchy(h); resetDrill()
  }
  function changePeriod(m: string[]) {
  // Determine timeline direction (earlier month vs later month)
  const currentStart = months[0] ?? ''
  const nextStart = m[0] ?? ''
  const dir: 'down' | 'back' = nextStart < currentStart ? 'back' : 'down'

  setMonths(m)
  setColMonth(null)
  
  // Bump anim.key to trigger the CSS transition while keeping the drill state intact
  setAnim(a => ({ key: a.key + 1, dir }))
}

  // Legend-row click (slices are no longer clickable).
  function selectBucket(bucket: string) {
    const next = focusOnClick(tab, view, bucket)

    if (isTerminalClick(view, bucket)) {
      // Terminal: re-scope only. The donut stays put; repeat clicks just
      // overwrite this one slot, so back is always a single press.
      setSelection(next)
      return
    }

    // Real drill: descend one level.
    setSelection(null)
    setStack(s => [...s, next])
    setAnim(a => ({ key: a.key + 1, dir: 'down' }))
  }

  function drillBack() {
    // A terminal selection is the top-most "layer" — clear it first.
    if (selection) {
      setSelection(null)
      setAnim(a => ({ key: a.key + 1, dir: 'back' }))
      return
    }
    if (drillStack.length > 1) {
      setStack(s => s.slice(0, -1))
      setAnim(a => ({ key: a.key + 1, dir: 'back' }))
    }
  }

  const canDrillBack = drillStack.length > 1 || selection !== null

  // A column-chart month label (or bar) isolates that month; click again = clear.
  function toggleColMonth(m: string) {
    setColMonth(prev => (prev === m ? null : m))
  }

  // The donut / table honour an isolated column month; otherwise the range.
  const activeMonth = colMonth ?? (isRange ? null : months[0])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

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
                focus={drillFocus}
                selection={selection}
                activeMonth={activeMonth}
                canDrillBack={canDrillBack}
                animKey={anim.key}
                animDir={anim.dir}
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
