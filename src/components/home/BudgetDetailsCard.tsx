// src/components/home/BudgetDetailsCard.tsx
//
// Subcategories by "Remaining to spend", ascending (most overspent first).
//   • Expense subcategories only (Income and Savings/goals excluded).
//   • Rollover toggle (default OFF) picks WHICH POPULATION is shown —
//     rollover-ON subcats or rollover-OFF subcats. The two never blend.
//   • Rows 1-6  = the ticked subcategories of that population, ascending.
//   • Row 7     = "All others" — the summed Remaining of every subcategory
//                 in the population that is NOT in rows 1-6. That includes
//                 both the spill-over beyond 6 AND anything the user
//                 unticked in the picker (unticking DISPLACES into row 7,
//                 it never deletes the amount).
//   • The ⌄ picker lists only the current population, and its selection is
//     stored separately per population, household-shared.

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  fmtAmt, signColor, monthKey,
} from '@/lib/budgetFormat'
import { useBudgetTable, type BudgetRow } from '@/hooks/useBudgetTable'
import { useHomePrefs, useSetHomePref, type HomePrefKey } from '@/hooks/useHomePrefs'
import { HomeCard, CheckboxPicker } from '@/components/home/HomeCard'

const TOP_N = 6

export function BudgetDetailsCard() {
  const now   = new Date()
  const month = monthKey(now.getFullYear(), now.getMonth() + 1)

  const { data: rows = [], isLoading } = useBudgetTable(month)
  const { data: prefs } = useHomePrefs()
  const setPref = useSetHomePref()

  const [rollover, setRollover]     = useState(false)   // default OFF
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null)

  const prefKey: HomePrefKey = rollover ? 'subcats_rollover_on' : 'subcats_rollover_off'

  // The population: Expense subcategories matching the toggle.
  const population = useMemo<BudgetRow[]>(
    () => rows.filter(r => r.section === 'Expense' && r.rollover_enabled === rollover),
    [rows, rollover],
  )
  const popNames = useMemo(() => population.map(r => r.ex_sub_category), [population])

  // undefined = never configured → all ticked. [] = deliberately empty → respected.
  const stored   = prefs?.[prefKey]
  const selected = useMemo(
    () => (stored !== undefined ? stored : popNames),
    [stored, popNames],
  )
  const selSet = useMemo(() => new Set(selected), [selected])

  // Rows 1-6: ticked members, ascending Remaining (most negative first).
  const top = useMemo(() => {
    return population
      .filter(r => selSet.has(r.ex_sub_category))
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, TOP_N)
  }, [population, selSet])

  // Row 7: everything else in the population (spill-over + unticked).
  const topSet = useMemo(() => new Set(top.map(r => r.ex_sub_category)), [top])
  const restRows  = population.filter(r => !topSet.has(r.ex_sub_category))
  const restTotal = restRows.reduce((s, r) => s + r.remaining, 0)

  function toggleSubcat(name: string) {
    const next = selSet.has(name)
      ? selected.filter(n => n !== name)
      : [...selected, name]
    setPref.mutate({ key: prefKey, value: next })
  }

  return (
    <HomeCard
      title="Budget Details"
      subtitle={`Remaining to spend · rollover ${rollover ? 'on' : 'off'}`}
      to="/budget"
      onOpenPicker={setPickerRect}
    >
      <div className="px-3 pb-3">
        {/* Rollover toggle */}
        <div className="flex items-center justify-end pb-2">
          <RolloverToggle value={rollover} onChange={setRollover} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-green border-t-transparent" />
          </div>
        ) : population.length === 0 ? (
          <p className="py-6 text-center font-dm text-xs text-muted">
            No rollover-{rollover ? 'on' : 'off'} subcategories this month.
          </p>
        ) : (
          <div className="flex flex-col">
            {top.map(r => (
              <div key={r.ex_sub_category}
                className="flex items-center justify-between gap-3 px-1 py-1.5">
                <span className="font-dm text-xs text-white truncate">{r.ex_sub_category}</span>
                <span className={cn(
                  'font-sora text-xs font-semibold tabular-nums flex-none',
                  signColor(r.remaining),
                )}>
                  {fmtAmt(r.remaining)}
                </span>
              </div>
            ))}

            {/* Row 7 — everything not in the top 6 */}
            {restRows.length > 0 && (
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-line px-1 pt-2">
                <span className="font-dm text-xs text-soft truncate">
                  All others
                  <span className="ml-1 text-muted">({restRows.length})</span>
                </span>
                <span className={cn(
                  'font-sora text-xs font-semibold tabular-nums flex-none',
                  signColor(restTotal),
                )}>
                  {fmtAmt(restTotal)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {pickerRect && (
        <CheckboxPicker
          title="Show subcategories"
          options={popNames}
          selected={selected}
          rect={pickerRect}
          onToggle={toggleSubcat}
          onClose={() => setPickerRect(null)}
          emptyHint={`No rollover-${rollover ? 'on' : 'off'} subcategories.`}
          footer={
            <div className="flex items-center justify-between">
              <span className="font-dm text-[11px] text-soft">Rollover subcategories</span>
              <RolloverToggle value={rollover} onChange={setRollover} />
            </div>
          }
        />
      )}
    </HomeCard>
  )
}

// ── Rollover on/off switch ──────────────────────────────────────────
function RolloverToggle({ value, onChange }: {
  value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      aria-pressed={value}
      className="flex items-center gap-1.5 touch-manipulation">
      <span className={cn('font-dm text-[10px]', value ? 'text-blue' : 'text-soft')}>
        Rollover
      </span>
      <span className={cn(
        'relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
        value ? 'bg-blue' : 'bg-line',
      )}>
        <span className={cn(
          'absolute h-2.5 w-2.5 rounded-full bg-white transition-transform',
          value ? 'translate-x-[15px]' : 'translate-x-[3px]',
        )} />
      </span>
    </button>
  )
}
