// src/components/goals/GoalSavingsTable.tsx
//
// The Goal Savings Table: a 4-month slot with month sections, each an
// isolated bordered card containing dateless Monthly Allocation rows
// plus date groups of Sinking Funds + Funds Transfer rows.
//
// Sticky headers: the month header pins to the top of the scroll body
// (top-0) and the date header pins just below it (top-[42px]) while the
// rows underneath scroll. For sticky to resolve against the scroll body
// (not the card), the month card and date block must NOT be
// overflow-hidden; rounded corners are handled by rounding the header's
// top and clipping only the innermost rows container instead.
//
// Row / header tap routing:
//   • Month header      → open allocation panel, pre-filled to that month
//   • Monthly Allocation (linked)   → TransactionDetailPanel (as a transfer)
//   •                    (manual)   → allocation panel, pre-filled for edit
//   • Sinking Funds     → TransactionDetailPanel
//   • Funds Transfer    → EditGoalTransferSheet

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { fmtAmt, fmtSignedAmt } from '@/lib/goalFormat'
import {
  useGoalSavingsTable,
  slotLabel,
  type GoalMonthSection,
  type GoalDateGroup,
} from '@/hooks/useGoalSavingsTable'
import type { GoalActivityRecord } from '@/hooks/useGoalActivity'
import type { Transaction } from '@/hooks/useTransactions'
import { FourMonthPicker } from '@/components/goals/FourMonthPicker'
import { EditGoalTransferSheet } from '@/components/goals/EditGoalTransferSheet'
import { GoalAllocationPanel } from '@/components/goals/GoalAllocationPanel'
import { TransactionDetailPanel } from '@/components/layout/TransactionDetailPanel'

// Sticky offsets (px). Month header ≈ 41px tall; date header pins under it.
const MONTH_HEADER_H = 42

// Adapt a fact_goal activity row into the Transaction shape the detail
// panel consumes. Two cases reach the panel:
//
//  • sinking_fund  — a real expense. Key off source_transaction_id and
//                    flag is_sinking_funds so the panel shows/edits the
//                    Sinking Funds expense.
//  • linked allocation — this row was CREATED BY a transfer into a
//                    goal-linked account. The underlying record is a
//                    TRANSFER, so we shape it as one (is_transfer + the
//                    shared transfer_group_id). The panel then fetches
//                    the transfer group and shows From/To/amount, and
//                    Edit opens the Transfer editor — not an Expense.
function toTxnShape(rec: GoalActivityRecord): Transaction {
  const isLinkedAllocation = rec.kind === 'allocation' && rec.is_linked
  const isSinking          = rec.kind === 'sinking_fund'

  return {
    id:                isSinking ? (rec.source_transaction_id ?? rec.id) : rec.id,
    date:              rec.date,
    master_account:    rec.master_account ?? '',
    ex_sub_category:   isLinkedAllocation ? 'Transfer' : rec.ex_sub_category,
    singed_amount:     rec.singed_amount,
    note:              rec.note,
    goal:              rec.goal,
    user_id:           rec.user_id,
    transfer_group_id: rec.transfer_group_id,
    created_at:        rec.created_at,
    updated_at:        rec.created_at,
    category:          isLinkedAllocation ? 'Transfer' : rec.ex_sub_category,
    group_name:        '',
    txn_type:          isLinkedAllocation ? 'Transfer' : 'Expense',
    rollover_enabled:  false,
    display_category:  isLinkedAllocation ? 'Transfer In' : rec.ex_sub_category,
    display_subcategory: '',
    amount_color:      isLinkedAllocation ? 'gray' : (rec.singed_amount < 0 ? 'red' : 'green'),
    is_transfer:       isLinkedAllocation,   // ← routes the panel to the transfer branch
    is_transfer_fee:   false,
    is_income:         false,
    is_sinking_funds:  isSinking,
    is_loan_payment:   false,
  }
}

export function GoalSavingsTable({ onActivePanelChange }: {
  onActivePanelChange?: (open: boolean) => void
} = {}) {
  const now = new Date()
  const [anchor, setAnchor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const { sections, isLoading, isError } = useGoalSavingsTable(anchor.year, anchor.month)

  // Slot selector popup
  const slotBtnRef = useRef<HTMLButtonElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)

  // Active sheet routing
  const [editTransfer, setEditTransfer] = useState<GoalActivityRecord | null>(null)
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null)
  const [allocPanel, setAllocPanel] = useState<
    { month: string; goal?: string; amount?: number; note?: string | null } | null
  >(null)

  // Tell the parent when any side panel is open, so it can hide the FAB
  // (the FAB would otherwise show through the panels' translucent overlay).
  const anyPanelOpen = !!(editTransfer || detailTxn || allocPanel)
  useEffect(() => {
    onActivePanelChange?.(anyPanelOpen)
    return () => onActivePanelChange?.(false)
  }, [anyPanelOpen, onActivePanelChange])

  function openPicker() {
    if (slotBtnRef.current) {
      const rect = slotBtnRef.current.getBoundingClientRect()
      const w = 288, margin = 8
      const cl = rect.left + rect.width / 2 - w / 2
      setPickerPos({ top: rect.bottom + 6, left: Math.max(margin, Math.min(cl, window.innerWidth - w - margin)) })
    }
    setPickerOpen(true)
  }

  function routeRecord(rec: GoalActivityRecord) {
    if (rec.kind === 'allocation') {
      if (rec.is_linked) {
        setDetailTxn(toTxnShape(rec))                    // linked → TransactionDetailPanel (as a transfer)
      } else {
        // manual → open the allocation manager PRE-FILLED for editing,
        // so the user sees the month's Left-to-Save + summary table too.
        setAllocPanel({
          month:  rec.date.slice(0, 7) + '-01',
          goal:   rec.goal,
          amount: Math.abs(rec.singed_amount),
          note:   rec.note,
        })
      }
    } else if (rec.kind === 'sinking_fund') {
      setDetailTxn(toTxnShape(rec))                      // → TransactionDetailPanel
    } else {
      setEditTransfer(rec)                               // funds_transfer → edit sheet
    }
  }

  return (
    <div className="bg-navy overflow-hidden">
      {/* 4-month selector header (table title bar — stays above the scroll) */}
      <div className="flex items-center justify-between px-4 py-3 rounded-t-2xl border-b border-line bg-gradient-to-t from-line/30 to-transparent">
        <span className="font-sora text-sm font-bold text-soft">Goal Activities</span>
        <button ref={slotBtnRef} onClick={openPicker}
          className="font-sora text-sm font-semibold text-white hover:text-cyan transition-colors select-none">
          {slotLabel(anchor.year, anchor.month)}
        </button>
      </div>

      {/* Body — THIS is the scroll container the sticky headers pin to */}
      <div className="max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          </div>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="font-sora text-sm text-red mb-1">Couldn't load goal activity</p>
            <p className="font-dm text-xs text-soft">Check your connection and try again.</p>
          </div>
        ) : sections.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-dm text-sm text-soft">No months to show in this period.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-3 animate-fade-in">
            {sections.map(section => (
              <MonthSection key={section.month} section={section}
                onHeaderTap={() => setAllocPanel({ month: section.month })}
                onRecordTap={routeRecord} />
            ))}
          </div>
        )}
      </div>

      {/* Slot picker */}
      {pickerOpen && pickerPos && (
        <FourMonthPicker
          anchorYear={anchor.year} anchorMonth={anchor.month} pos={pickerPos}
          onSelect={(y, m) => setAnchor({ year: y, month: m })}
          onClose={() => { setPickerOpen(false); setPickerPos(null) }} />
      )}

      {/* Routed sheets */}
      {editTransfer && <EditGoalTransferSheet record={editTransfer} onClose={() => setEditTransfer(null)} />}
      {allocPanel && (
        <GoalAllocationPanel
          initialTab="allocate"
          initialMonth={allocPanel.month}
          initialGoal={allocPanel.goal}
          initialAmount={allocPanel.amount}
          initialNote={allocPanel.note ?? undefined}
          onClose={() => setAllocPanel(null)} />
      )}
      <TransactionDetailPanel transaction={detailTxn} onClose={() => setDetailTxn(null)} />
    </div>
  )
}

// ── Month section — isolated, rounded, bordered card w/ sticky header ─
function MonthSection({ section, onHeaderTap, onRecordTap }: {
  section: GoalMonthSection
  onHeaderTap: () => void
  onRecordTap: (rec: GoalActivityRecord) => void
}) {
  const fullyAllocated = Math.abs(section.left_to_save) < 0.005
  const hasDateGroups  = section.dateGroups.length > 0
  const hasAllocations = section.allocations.length > 0
  const hasContent     = hasAllocations || hasDateGroups

  return (
    // NOTE: no overflow-hidden here — that would trap sticky inside the
    // card. Rounded corners come from rounded-t on the header and the
    // rounded bottom on whichever block renders last.
    <div className="rounded-xl border border-line bg-card">
      {/* Sticky month header — its own bg; allocation rows share the tint */}
      <button onClick={onHeaderTap}
        className="sticky top-0 z-20 w-full flex items-center justify-between px-4 py-2.5 bg-panel rounded-t-xl text-left hover:bg-panel/90 transition-colors">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn('font-sora text-sm font-bold', fullyAllocated ? 'text-soft' : 'text-amber')}>
            {section.month_label}
          </span>
          {fullyAllocated
            ? <span className="text-sm">✔️</span>
            : <span className="font-dm text-[11px] text-muted truncate">Left to save = {fmtSignedAmt(section.left_to_save)}</span>}
        </div>
        <div className="flex items-center gap-3 flex-none">
          {section.total_allocated !== 0 && (
            <span className={cn('font-sora text-xs font-semibold tabular-nums', section.total_allocated < 0 ? 'text-red' : 'text-green')}>
              {fmtSignedAmt(section.total_allocated)}
            </span>
          )}
          {section.total_sinking !== 0 && (
            <span className={cn('font-sora text-xs font-semibold tabular-nums', section.total_sinking < 0 ? 'text-red' : 'text-green')}>
              {fmtSignedAmt(section.total_sinking)}
            </span>
          )}
        </div>
      </button>

      {/* Monthly Allocation rows — dateless; SAME bg tint as the header. */}
      {hasAllocations && (
        <div className={cn('bg-panel/50 border-t border-line/50', !hasDateGroups && 'rounded-b-xl overflow-hidden')}>
          {section.allocations.map(rec => (
            <AllocationRow key={rec.id} rec={rec} onTap={() => onRecordTap(rec)} />
          ))}
        </div>
      )}

      {/* Date groups — each isolated in its own bordered block, spaced.
          The p-2 padding keeps the card's rounded bottom corners clean. */}
      {hasDateGroups && (
        <div className="flex flex-col gap-2 p-2">
          {section.dateGroups.map(group => (
            <DateGroupBlock key={group.date} group={group} onRecordTap={onRecordTap} />
          ))}
        </div>
      )}

      {/* Empty month */}
      {!hasContent && (
        <div className="px-4 py-4 text-center border-t border-line/50 rounded-b-xl">
          <p className="font-dm text-xs text-muted">No activity this month.</p>
        </div>
      )}
    </div>
  )
}

// Collapse a transfer's two legs into one display row (keyed by
// transfer_group_id): show the negative "out" leg as the canonical row.
// Sinking-fund rows pass through untouched.
function dedupeTransfers(records: GoalActivityRecord[]): GoalActivityRecord[] {
  const seen = new Set<string>()
  const out: GoalActivityRecord[] = []
  for (const r of records) {
    if (r.kind === 'funds_transfer' && r.transfer_group_id) {
      if (seen.has(r.transfer_group_id)) continue
      seen.add(r.transfer_group_id)
      const pair = records.filter(x => x.transfer_group_id === r.transfer_group_id)
      out.push(pair.find(x => x.singed_amount < 0) ?? r)
    } else {
      out.push(r)
    }
  }
  return out
}

// ── Date group inside a month — isolated block w/ sticky date header ─
function DateGroupBlock({ group, onRecordTap }: {
  group: GoalDateGroup
  onRecordTap: (rec: GoalActivityRecord) => void
}) {
  // Transfers net to zero within a day; the day total reflects only the
  // sinking-fund (expense) rows, which is what the user cares about.
  const total = group.records
    .filter(r => r.kind === 'sinking_fund')
    .reduce((s, r) => s + r.singed_amount, 0)
  const rows = dedupeTransfers(group.records)

  return (
    // No overflow-hidden here either — sticky date header must reach the
    // scroll body. The rows container below clips its own bottom corners.
    <div className="rounded-lg border border-line/70 bg-navy/40">
      {/* Sticky date header — opaque bg so rows don't bleed through when pinned */}
      <div className="sticky z-10 flex items-center justify-between px-3 py-1.5 bg-navy rounded-t-lg border-b border-line/50"
        style={{ top: MONTH_HEADER_H }}>
        <div className="flex items-baseline gap-1">
          <span className="font-sora text-sm font-bold tabular-nums text-white">{group.day_of_month}</span>
          <span className="font-sora text-xs font-semibold uppercase text-soft">{group.day_name},</span>
          <span className="font-dm text-xs text-muted">{group.month_year}</span>
        </div>
        {total !== 0 && (
          <span className={cn('font-sora text-xs font-semibold tabular-nums', total < 0 ? 'text-red' : 'text-soft')}>
            {fmtSignedAmt(total)}
          </span>
        )}
      </div>
      <div className="divide-y divide-line/40 rounded-b-lg overflow-hidden">
        {rows.map(rec =>
          rec.kind === 'funds_transfer'
            ? <TransferRow key={rec.id} rec={rec} allRecords={group.records} onTap={() => onRecordTap(rec)} />
            : <SinkingRow  key={rec.id} rec={rec} onTap={() => onRecordTap(rec)} />
        )}
      </div>
    </div>
  )
}

// ── Row: Monthly Allocation (goal | "Monthly Allocation" | amount) ──
function AllocationRow({ rec, onTap }: { rec: GoalActivityRecord; onTap: () => void }) {
  return (
    <button onClick={onTap}
      className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-panel transition-colors">
      <div className="w-5/12 flex-none flex items-center gap-1.5 min-w-0">
        <span className="font-sora text-sm font-semibold text-white truncate">{rec.goal}</span>
        {rec.is_linked && <span className="flex-none text-muted text-xs" title="From a linked-account transfer">📎</span>}
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-dm text-xs text-cyan">Monthly Allocation</span>
      </div>
      <div className="flex-none pl-2 text-right">
        <span className={cn('font-sora text-sm tabular-nums', rec.singed_amount < 0 ? 'text-red' : 'text-green')}>
          {fmtSignedAmt(rec.singed_amount)}
        </span>
      </div>
    </button>
  )
}

// ── Row: Sinking Funds (goal | account+note | red amount) ───────────
function SinkingRow({ rec, onTap }: { rec: GoalActivityRecord; onTap: () => void }) {
  return (
    <button onClick={onTap}
      className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-panel/40 transition-colors">
      <div className="w-5/12 flex-none min-w-0">
        <p className="font-sora text-sm font-semibold text-white truncate">{rec.goal}</p>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="font-dm text-sm text-white truncate">{rec.master_account ?? '—'}</p>
        {rec.note && <p className="font-dm text-[11px] text-muted truncate">{rec.note}</p>}
      </div>
      <div className="flex-none pl-2 self-center text-right">
        <span className="font-sora text-sm tabular-nums text-red">{fmtSignedAmt(rec.singed_amount)}</span>
      </div>
    </button>
  )
}

// ── Row: Funds Transfer (GoalA → GoalB | "Funds Transfer" | muted amt) ─
function TransferRow({ rec, allRecords, onTap }: {
  rec: GoalActivityRecord
  allRecords: GoalActivityRecord[]
  onTap: () => void
}) {
  const pair = allRecords.filter(x => x.transfer_group_id === rec.transfer_group_id && x.kind === 'funds_transfer')
  const fromGoal = pair.find(x => x.singed_amount < 0)?.goal ?? rec.goal
  const toGoal   = pair.find(x => x.singed_amount > 0)?.goal ?? ''
  const amount   = Math.abs(pair.find(x => x.singed_amount < 0)?.singed_amount ?? rec.singed_amount)

  return (
    <button onClick={onTap}
      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-panel/40 transition-colors">
      <div className="w-5/12 flex-none min-w-0">
        <p className="font-sora text-sm font-semibold text-soft truncate">
          {fromGoal} <span className="text-muted">→</span> {toGoal}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-dm text-xs text-muted">Funds Transfer</span>
      </div>
      <div className="flex-none pl-2 text-right">
        <span className="font-sora text-sm tabular-nums text-soft">{fmtAmt(amount)}</span>
      </div>
    </button>
  )
}
