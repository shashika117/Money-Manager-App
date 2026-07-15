// src\components\budget\BudgetTable.tsx

// The 3/4-width sectional budget table.
//   • Three sticky section headers (Income / Expenses / Savings) that
//     pin perfectly at top-0 and push each other away on scroll.
//   • Per-section group outline colours (green / red / cyan).
//   • Inline-editable Budget cells; read-only Actual & Remaining cells
//     open contextual popups, coloured per-section.
//   • Per-row progress bars; group total rows.

import { useState, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { fmtAmtSigned, type ProgressKind,
  savingActualColor, incomeRemainingColor, savingRemainingColor, expenseRemainingColor,
} from '@/lib/budgetFormat'
import { ProgressBar } from '@/components/budget/ProgressBar'
import {
  BudgetEditPopup, RemainingPopup, ActualCalendarPopup,
} from '@/components/budget/BudgetCellPopups'
import {
  type BudgetRow, type BudgetSection,
  groupBudgetRows, filterEmptyRows, type CategoryGroup,
} from '@/hooks/useBudgetTable'
import { useUpsertBudget, useUpsertGoalBudget } from '@/hooks/useBudgetMutations'

interface BudgetTableProps {
  rows:    BudgetRow[]
  month:   string
  showAll: boolean
}

type OpenPopup =
  | { kind: 'budget';    row: BudgetRow; rect: DOMRect }
  | { kind: 'actual';    row: BudgetRow; rect: DOMRect }
  | { kind: 'remaining'; row: BudgetRow; rect: DOMRect }
  | null

const HEADER_H = 40

export function BudgetTable({ rows, month, showAll }: BudgetTableProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [popup, setPopup] = useState<OpenPopup>(null)

  const upsertBudget     = useUpsertBudget()
  const upsertGoalBudget = useUpsertGoalBudget()

  const toggle = (key: string) =>
    setCollapsed(p => { const s = new Set(p); s.has(key) ? s.delete(key) : s.add(key); return s })

  const incomeGroups  = useMemo(() => groupBudgetRows(rows, 'Income'),  [rows])
  const expenseGroups = useMemo(() => groupBudgetRows(rows, 'Expense'), [rows])
  const savingsGroups = useMemo(() => groupBudgetRows(rows, 'Savings'), [rows])

  function handleSaveBudget(row: BudgetRow, amount: number, applyFuture: boolean) {
    if (row.section === 'Savings') {
      upsertGoalBudget.mutate({ month, goal_name: row.ex_sub_category, amount, applyFuture })
    } else {
      upsertBudget.mutate({ month, ex_sub_category: row.ex_sub_category, amount, applyFuture })
    }
  }

  const saving = upsertBudget.isPending || upsertGoalBudget.isPending

  return (
    <div className="relative">
      {/* INCOME */}
      <Section
        title="Income" stickyTop={0}
        groups={incomeGroups} section="Income" kind="income"
        collapsed={collapsed} toggle={toggle} showAll={showAll}
        month={month} onCellClick={setPopup}
      />

      {/* EXPENSES */}
      <Section
        title="Expenses" stickyTop={0}
        groups={expenseGroups} section="Expense" kind="expense"
        collapsed={collapsed} toggle={toggle} showAll={showAll}
        month={month} onCellClick={setPopup}
      />

      {/* SAVINGS */}
      <Section
        title="Savings" stickyTop={0}
        groups={savingsGroups} section="Savings" kind="saving"
        collapsed={collapsed} toggle={toggle} showAll={showAll}
        month={month} onCellClick={setPopup}
      />

      {/* Popups */}
      {popup?.kind === 'budget' && (
        <BudgetEditPopup
          row={popup.row} month={month} anchorRect={popup.rect}
          onClose={() => setPopup(null)}
          onSave={(amt, af) => { handleSaveBudget(popup.row, amt, af); setPopup(null) }}
          saving={saving}
        />
      )}
      {popup?.kind === 'remaining' && (
        <RemainingPopup row={popup.row} anchorRect={popup.rect} onClose={() => setPopup(null)} />
      )}
      {popup?.kind === 'actual' && (
        <ActualCalendarPopup row={popup.row} month={month} anchorRect={popup.rect} onClose={() => setPopup(null)} />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// SECTION (sticky header + column labels integrated)
// ════════════════════════════════════════════════════════════════
function Section({
  title, stickyTop, groups, section, kind,
  collapsed, toggle, showAll, month, onCellClick,
}: {
  title: string
  stickyTop: number
  groups: CategoryGroup[]
  section: BudgetSection
  kind: ProgressKind
  collapsed: Set<string>
  toggle: (k: string) => void
  showAll: boolean
  month: string
  onCellClick: (p: OpenPopup) => void
}) {
  return (
    <div className="mb-5">
      {/* Sticky section header - Responsive Grid Ratios with Premium Gradient Anchor Line */}
      <div
        className={cn(
          "sticky z-30 grid grid-cols-[1.4fr_2fr] md:grid-cols-[3fr_5fr] items-center bg-navy/95 backdrop-blur px-3 bg-gradient-to-t to-transparent transition-all",
          kind === 'income' && 'from-green/30 border-b border-green/30',
          kind === 'expense' && 'from-amber/30 border-b border-amber/30',
          kind === 'saving' && 'from-cyan/30 border-b border-cyan/30'
        )}
        style={{ top: stickyTop, height: HEADER_H }}
      >
        <span className="font-sora text-sm font-bold uppercase tracking-widest text-soft">
          {title}
        </span>
        <div className="grid grid-cols-[1fr_1.2fr_1.2fr] md:grid-cols-[0.8fr_2.1fr_2.1fr] text-right pr-1.5">
          <span className="font-sora text-[10px] font-bold uppercase tracking-widest text-soft/60 pr-1.5">Budget</span>
          <span className="font-sora text-[10px] font-bold uppercase tracking-widest text-soft/60 pr-1.5">Actual</span>
          <span className="font-sora text-[10px] font-bold uppercase tracking-widest text-soft/60 pr-2.5">Remaining</span>
        </div>
      </div>

      {/* Category groups wrapper */}
      <div className="flex flex-col gap-5 px-1 pt-2">
        {groups.map(group => (
          <CategoryBox
            key={group.key}
            group={group} section={section} kind={kind}
            collapsed={collapsed.has(group.key)}
            onToggle={() => toggle(group.key)}
            showAll={showAll} month={month} onCellClick={onCellClick}
          />
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// CATEGORY BOX (isolated rounded group with total row + subrows)
// ════════════════════════════════════════════════════════════════
function CategoryBox({
  group, section, kind, collapsed, onToggle, showAll, month, onCellClick,
}: {
  group: CategoryGroup
  section: BudgetSection
  kind: ProgressKind
  collapsed: boolean
  onToggle: () => void
  showAll: boolean
  month: string
  onCellClick: (p: OpenPopup) => void
}) {
  const visibleRows = filterEmptyRows(group.rows, showAll)
  if (!showAll && visibleRows.length === 0) return null

  const outline = 'border-line'

  return (
    <div className={cn('rounded-xl border', outline)}>
      {/* Group total row - Now Cascading Sticky underneath the Section Header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full grid grid-cols-[1.4fr_2fr] md:grid-cols-[3fr_5fr] items-center px-3 py-2.5 bg-panel/95 backdrop-blur hover:bg-panel/80 transition-colors sticky z-20 border-b border-line/40",
          collapsed ? "rounded-xl" : "rounded-t-xl"
        )}
        style={{ top: HEADER_H }}
      >
        <span className="flex items-center gap-1.5 text-left min-w-0 truncate">
          <span className={cn('font-sora text-[10px] text-muted transition-transform', collapsed ? '' : 'rotate-90')}>

        {/* drop down arrow */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="15" 
          height="15" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="rotate-270 origin-center"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>


          </span>
          <span className="font-sora text-xs font-bold text-white truncate">{group.label}</span>
        </span>
        <div className="grid grid-cols-[1fr_1.2fr_1.2fr] md:grid-cols-[0.8fr_2.1fr_2.1fr] items-center text-right pr-1.5">
          <TotalCell value={group.budget} />
          <TotalCell value={group.actual} colorClass={
          section === 'Savings' && group.actual < 0 
            ? savingActualColor(group.actual) 
            : 'text-white'
          } />

          <TotalCell value={group.remaining} colorClass={
            section === 'Income'   ? incomeRemainingColor(group.remaining)
            : section === 'Savings' ? savingRemainingColor(group.remaining)
            : expenseRemainingColor(group.remaining)
          } />
        </div>
      </button>

      {/* Sub rows */}
      {!collapsed && visibleRows.map(row => (
        <SubRow
          key={row.ex_sub_category}
          row={row} kind={kind} month={month} onCellClick={onCellClick}
        />
      ))}
    </div>
  )
}

// Group total cell. colorClass defaults to white when not provided.
function TotalCell({ value, colorClass }: { value: number; colorClass?: string }) {
  return (
    <span className={cn(
      'font-sora text-xs font-bold tabular-nums text-right w-full pr-1.5',
      colorClass ?? 'text-white',
    )}>
      {fmtAmtSigned(value)}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════
// SUB ROW (individual subcategory / goal)
// ════════════════════════════════════════════════════════════════
function SubRow({
  row, kind, month, onCellClick,
}: {
  row: BudgetRow
  kind: ProgressKind
  month: string
  onCellClick: (p: OpenPopup) => void
}) {
  const isNeed = row.group_name === 'Needs'

  const actualColor = row.section === 'Savings'
    ? savingActualColor(row.actual)
    : 'text-soft'

  const remainingColor =
    row.section === 'Income'   ? incomeRemainingColor(row.remaining)
    : row.section === 'Savings' ? savingRemainingColor(row.remaining)
    : expenseRemainingColor(row.remaining)

  return (
    <div className="px-3 py-2.5 border-t border-line/40 grid grid-cols-[1.4fr_2fr] md:grid-cols-[3fr_5fr] items-center">
      {/* Left Side: Label + badges */}
      <div className="flex items-center gap-1.5 min-w-0 pr-2">
        <span className={cn(
          'font-dm text-sm font-normal truncate',
          isNeed ? 'text-amber/80' : 'text-soft',
        )}>
          {row.ex_sub_category}
        </span>
        {row.rollover_enabled && (
          <span className="inline-flex items-center rounded-full border border-blue/30 bg-blue/10 px-1.5 py-0.5 font-dm text-[8px] text-blue whitespace-nowrap">
            ↻<span className="hidden sm:inline ml-0.5">Rollover</span>
          </span>
        )}
      </div>

      {/* Right Side: numbers + progress bar */}
      <div className="flex flex-col">
        <div className="grid grid-cols-[1fr_1.2fr_1.2fr] md:grid-cols-[0.8fr_2.1fr_2.1fr] items-center text-right pr-1.5">
          <BudgetCell row={row} onCellClick={onCellClick} />
          <ReadOnlyCell
            value={row.actual}
            colorClass={actualColor}
            className="font-normal"
            onClick={rect => onCellClick({ kind: 'actual', row, rect })}
          />
          <ReadOnlyCell
            value={row.remaining}
            colorClass={remainingColor}
            className="font-semibold"
            onClick={rect => onCellClick({ kind: 'remaining', row, rect })}
          />
        </div>

        <div className="pr-1.5 mt-2">
          <ProgressBar
            actual={row.section === 'Income' ? row.actual : Math.abs(row.actual)}
            effectiveBudget={row.effective_budget}
            kind={kind} month={month} height={5}
          />
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// INTERACTIVE DATA CELL ELEMENTS
//
// Each button is `w-full` with the number right-aligned. We capture the
// rect of an inner <span> wrapping the number (not the button) so the
// popup anchors exactly to the visible number on wide columns.
// ════════════════════════════════════════════════════════════════
function BudgetCell({
  row, onCellClick,
}: {
  row: BudgetRow
  onCellClick: (p: OpenPopup) => void
}) {
  const textRef = useRef<HTMLSpanElement>(null)

  function open() {
    if (textRef.current) {
      onCellClick({ kind: 'budget', row, rect: textRef.current.getBoundingClientRect() })
    }
  }

  return (
    <button
      onClick={open}
      className="font-sora text-xs font-normal tabular-nums text-right w-full rounded pr-1.5 py-1 text-soft hover:bg-panel/50 transition-all"
    >
      <span ref={textRef}>{fmtAmtSigned(row.budget)}</span>
    </button>
  )
}

function ReadOnlyCell({
  value, colorClass, className, onClick,
}: {
  value: number
  colorClass: string
  className?: string
  onClick: (rect: DOMRect) => void
}) {
  const textRef = useRef<HTMLSpanElement>(null)
  return (
    <button
      onClick={() => textRef.current && onClick(textRef.current.getBoundingClientRect())}
      className={cn(
        'font-sora text-xs tabular-nums text-right w-full rounded pr-1.5 py-1 hover:bg-panel/50 transition-colors',
        colorClass,
        className,
      )}
    >
      <span ref={textRef}>{fmtAmtSigned(value)}</span>
    </button>
  )
}