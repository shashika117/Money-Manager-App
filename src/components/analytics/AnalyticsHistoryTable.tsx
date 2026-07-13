// src/components/analytics/AnalyticsHistoryTable.tsx
//
// The combined history table: the Transactions table's exact row UI, plus
// Monthly Allocation rows from fact_goal (spend tab). Sensitive to both
// filters, the donut drill, and the column chart's isolated month.
//
// Month-card row: only shown when the Period filter holds a RANGE. Tapping
// a card isolates that month (and, being the same state the column chart
// uses, keeps the two in sync). Tapping the active card clears it.
//
// Tap routing (mirrors the parent tables; date headers are NOT tappable):
//   • Monthly Allocation, manual  → GoalAllocationPanel, pre-filled
//   • Monthly Allocation, linked  → TransactionDetailPanel (as a transfer)
//   • everything else             → TransactionDetailPanel

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { monthShort } from '@/lib/analyticsScope'
import type { AnalyticsTab } from '@/lib/analyticsScope'
import { GROUP_COLORS } from '@/lib/analyticsColors'
import {
  useAnalyticsHistory, type AnalyticsRow,
} from '@/hooks/useAnalyticsHistory'
import type { Transaction, DateGroup } from '@/hooks/useTransactions'
import { TransactionTable }       from '@/components/layout/TransactionTable'
import { TransactionDetailPanel } from '@/components/layout/TransactionDetailPanel'
import { GoalAllocationPanel }    from '@/components/goals/GoalAllocationPanel'

interface Props {
  tab:          AnalyticsTab
  bounds:       { start: string; endExclusive: string }
  months:       string[]
  scope:        string
  scopeKeyName: string | null
  colMonth:     string | null
  onSelectMonth: (m: string) => void
}

export function AnalyticsHistoryTable({
  tab, bounds, months, scope, scopeKeyName, colMonth, onSelectMonth,
}: Props) {
  const isRange = months.length > 1

  const { groups, isLoading, isError } = useAnalyticsHistory({
    tab,
    start:        bounds.start,
    endExclusive: bounds.endExclusive,
    scope,
    key:          scopeKeyName,
    monthFilter:  colMonth,
  })

  // Routed panels
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null)
  const [allocPanel, setAllocPanel] = useState<
    { month: string; goal: string; amount: number; note?: string } | null
  >(null)

  function handleTap(txn: Transaction) {
    const row = txn as AnalyticsRow
    // Manual Monthly Allocation → open the allocation manager, pre-filled.
    if (row.alloc?.manual) {
      setAllocPanel({
        month:  row.alloc.month,
        goal:   row.alloc.goal,
        amount: row.alloc.amount,
        note:   row.alloc.note ?? undefined,
      })
      return
    }
    // Linked allocation (shaped as a transfer) and every other row.
    setDetailTxn(txn)
  }

  // Spending rows are colour-coded by their group so Needs / Wants / Save
  // are distinguishable at a glance: the Amount takes the group colour and
  // the row gets a soft left→right wash of it. The Earning tab has only one
  // kind of row, so it keeps the default (green) styling.
  const rowAccent = useCallback((txn: Transaction): string | null => {
    if (tab !== 'spend') return null
    return GROUP_COLORS[txn.group_name] ?? null   // Needs=pink, Wants=amber, Save=cyan
  }, [tab])

  return (
    <div className="rounded-2xl border border-line bg-card overflow-hidden flex flex-col">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line flex-none">
        <span className="font-sora text-sm font-bold text-soft">
          {tab === 'earn' ? 'Income history' : 'Spending history'}
        </span>
        {colMonth && (
          <span className="font-dm text-[11px] text-blue">{monthShort(colMonth)} only</span>
        )}
      </div>

      {/* Month cards — RANGE MODE ONLY */}
      {isRange && (
        <div className="flex-none flex gap-1.5 overflow-x-auto px-3 py-2.5 border-b border-line bg-navy/40">
          {months.map(m => {
            const active = colMonth === m
            return (
              <button key={m} onClick={() => onSelectMonth(m)}
                className={cn(
                  'flex-none rounded-lg border px-3 py-1.5 font-dm text-xs transition-all touch-manipulation',
                  active
                    ? 'border-blue bg-blue/15 text-blue font-semibold'
                    : 'border-line bg-navy text-soft hover:text-white hover:border-soft',
                )}>
                {monthShort(m)}
              </button>
            )
          })}
        </div>
      )}

      {/* Body — the parent table's exact row UI. No onDateGroupSelect → date
          headers render non-interactive, per spec. */}
      <div className="flex-1 min-h-[560px] max-h-[560px] overflow-y-auto">
        <TransactionTable
          groups={groups as unknown as DateGroup[]}
          onSelectTransaction={handleTap}
          isLoading={isLoading}
          isError={isError}
          rowAccent={rowAccent}
          hideDateTotals
        />
      </div>

      {/* Routed panels */}
      <TransactionDetailPanel transaction={detailTxn} onClose={() => setDetailTxn(null)} />
      {allocPanel && (
        <GoalAllocationPanel
          initialTab="allocate"
          initialMonth={allocPanel.month}
          initialGoal={allocPanel.goal}
          initialAmount={allocPanel.amount}
          initialNote={allocPanel.note}
          onClose={() => setAllocPanel(null)}
        />
      )}
    </div>
  )
}
