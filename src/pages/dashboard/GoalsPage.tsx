// src/pages/dashboard/GoalsPage.tsx
//
// Goals page orchestration.
//   Header: "Goals" title + Show-all toggle switch + "+" create button.
//   Laptop (lg+): two columns — left 3/5 = Goal Cards, right 2/5 =
//     Left-to-Save card (top) then Goal Savings Table (sticky).
//   Mobile: stacked — Left-to-Save on top, then Goal Cards, then table.
//   Sticky cyan FAB opens the two-tab allocation/share panel.
//
// Layout mirrors BudgetPage/TransactionsPage exactly so it scrolls
// correctly inside DashboardLayout's <main className="main-content-area">:
//   root  = flex flex-col flex-1 min-h-0 overflow-hidden
//   header= flex-none
//   body  = flex-1 min-h-0 overflow-y-auto   ← this makes cards scroll

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useGoalsEnriched, type EnrichedGoal } from '@/hooks/useGoalsEnriched'
import { GoalCardsSection } from '@/components/goals/GoalCardsSection'
import { LeftToSaveCard } from '@/components/goals/LeftToSaveCard'
import { GoalSavingsTable } from '@/components/goals/GoalSavingsTable'
import { GoalFormPanel } from '@/components/goals/GoalFormPanel'
import { GoalAllocationPanel } from '@/components/goals/GoalAllocationPanel'

// Matches Tailwind's lg breakpoint (1024px) — chart + 2-col layout gate.
function useIsLaptop() {
  const [isLaptop, setIsLaptop] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsLaptop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isLaptop
}

export default function GoalsPage() {
  const isLaptop = useIsLaptop()
  const { goals, isLoading, isError } = useGoalsEnriched()

  const [showAll, setShowAll] = useState(false)
  const [formGoal, setFormGoal] = useState<EnrichedGoal | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)

  const visibleGoals = showAll ? goals : goals.filter(g => g.is_active)

  function openCreate() { setFormGoal(null); setFormOpen(true) }
  function openEdit(goal: EnrichedGoal) { setFormGoal(goal); setFormOpen(true) }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in">

      {/* ── Header (sticky, non-scrolling) ── */}
      <div className="flex-none flex items-center justify-between border-b border-line bg-card px-4 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <h1 className="font-sora text-xl font-bold text-white leading-none">Goals</h1>
        <div className="flex items-center gap-3">
          {/* Show-all toggle switch (matches Budget page pattern, cyan) */}
          <button onClick={() => setShowAll(v => !v)}
            className="flex items-center gap-2 touch-manipulation" aria-pressed={showAll}>
            <span className={cn('font-dm text-[11px]', showAll ? 'text-cyan' : 'text-soft')}>
              Show all
            </span>
            <span className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              showAll ? 'bg-cyan' : 'bg-line')}>
              <span className={cn('absolute h-3.5 w-3.5 rounded-full bg-white transition-transform',
                showAll ? 'translate-x-[18px]' : 'translate-x-[3px]')} />
            </span>
          </button>

          <button onClick={openCreate} aria-label="Create goal"
            className="flex h-9 w-9 items-center justify-center rounded-lg font-sora text-2xl font-light opacity-70 text-cyan hover:opacity-100 transition-opacity">
            +
          </button>
        </div>
      </div>

      {/* ── Body (the scroll container — cards + right column live here) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-safe-bottom px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          </div>
        ) : isError ? (
          <div className="py-24 text-center">
            <p className="font-sora text-sm text-red mb-1">Couldn't load goals</p>
            <p className="font-dm text-xs text-soft">Check your connection and try again.</p>
          </div>
        ) : isLaptop ? (
          // ── Laptop: two columns — cards left, Left-to-Save + table right ──
          <div className="flex gap-5 items-start">
            <div className="w-3/5">
              <GoalCardsSection goals={visibleGoals} isLaptop onOpenSettings={openEdit} />
            </div>
            <div className="w-2/5 sticky top-0 flex flex-col gap-5">
              <LeftToSaveCard />
              <GoalSavingsTable />
            </div>
          </div>
        ) : (
          // ── Mobile: Left-to-Save on top, then cards, then table ──
          <div className="flex flex-col gap-5">
            <LeftToSaveCard />
            <GoalCardsSection goals={visibleGoals} isLaptop={false} onOpenSettings={openEdit} />
            <GoalSavingsTable />
          </div>
        )}
      </div>

      {/* ── Sticky cyan FAB — position synced with the Transactions FAB ── */}
      {/* Transactions uses <FAB> = `fixed right-5 z-40 bottom-24 md:bottom-6`. */}
      <button onClick={() => setFabOpen(true)} aria-label="Allocate or share funds"
        className="fixed right-5 z-40 bottom-24 md:bottom-6 h-14 w-14 rounded-full bg-cyan shadow-lg shadow-cyan/30 flex items-center justify-center font-sora text-2xl font-light text-navy transition-all active:scale-90 touch-manipulation">
        +
      </button>

      {/* ── Panels ── */}
      {formOpen && <GoalFormPanel goal={formGoal} onClose={() => setFormOpen(false)} />}
      {fabOpen && <GoalAllocationPanel onClose={() => setFabOpen(false)} />}
    </div>
  )
}
