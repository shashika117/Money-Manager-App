// src/components/budget/SummaryCards.tsx
//
// The static 1/4-width summary block: Left to Budget KPI, Budget card, Actual card, Summary card.
// Stays in place while the table scrolls (parent applies sticky positioning).

import { cn } from '@/lib/utils'
import { fmtAmt, fmtAmtSigned, signColor, nwsColor, savingActualColor, expenseRemainingColor } from '@/lib/budgetFormat'
import { ProgressBar } from '@/components/budget/ProgressBar'
import type { BudgetSummary } from '@/hooks/useBudgetSummary'

interface SummaryCardsProps {
  summary: BudgetSummary | undefined
  month:   string
  loading: boolean
}

// Safe percentage: returns 0 when the denominator is 0 (avoids NaN/Infinity).
function pct(part: number, whole: number): number {
  if (!whole) return 0
  return (part / whole) * 100
}

export function SummaryCards({ summary, month, loading }: SummaryCardsProps) {
  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green border-t-transparent" />
      </div>
    )
  }

  // ── Budget card percentages: component / budget POOL ──────────────
  const budgetPool = summary.budget_needs + summary.budget_wants + summary.budget_save
  const bPctNeeds = pct(summary.budget_needs, budgetPool)
  const bPctWants = pct(summary.budget_wants, budgetPool)
  const bPctSave  = pct(summary.budget_save,  budgetPool)

  // ── Actual card percentages: component / relative pool ────────────
  const actualPool = summary.actual_needs + summary.actual_wants + summary.actual_save
  const aPctNeeds = pct(summary.actual_needs, actualPool)
  const aPctWants = pct(summary.actual_wants, actualPool)
  const aPctSave  = pct(summary.actual_save,  actualPool)

  // ── Logic for Left to Budget formatting ───────────────────────────
  const ltb = summary.left_to_budget

  return (
    <div className="flex flex-col gap-3">

      {/* ── 1. LEFT TO BUDGET CARD (Isolated Standalone Card) ── */}
      {(() => {
        // Define dynamic color classes based on the sign of ltb
          const textColor = ltb < 0 ? 'text-red-500' : signColor(ltb)
  
          let bgAndBorderColor = 'border-line bg-card' // Default for zero 
          if (ltb < 0) {
            bgAndBorderColor = 'border-red-500/30 bg-red-500/5'
          } else if (ltb > 0) {
            bgAndBorderColor = 'border-green-500/20 bg-green-500/5'
          }
  return (
    <div className={cn('rounded-2xl border p-4 text-center transition-colors', bgAndBorderColor)}>
  {/* Value Text */}
  <p className={cn('font-sora text-xl font-bold', textColor)}>
    {fmtAmtSigned(ltb)}
  </p>
  
  {/* Label Text */}
  <p className={cn('font-dm text-[10px] uppercase tracking-wider mt-1 transition-colors opacity-80', textColor)}>
    Left to budget
  </p>
</div>
  )
})()}




      {/* ── 2. BUDGET CARD ── */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📊</span>
          <span className="font-sora text-sm font-bold text-white/85">Budget</span>
        </div>

        <DetailRow label="Needs" value={summary.budget_needs} percent={bPctNeeds} />
        <DetailRow label="Wants" value={summary.budget_wants} percent={bPctWants} />
        <DetailRow label="Save"  value={summary.budget_save}  percent={bPctSave} />
        <NwsRow score={summary.budget_nws} />
      </div>

      {/* ── 3. ACTUAL CARD ── */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">💸</span>
          <span className="font-sora text-sm font-bold text-white/85">Actual</span>
        </div>

        <DetailRow label="Needs" value={summary.actual_needs} percent={aPctNeeds} />
        <DetailRow label="Wants" value={summary.actual_wants} percent={aPctWants} />
        <DetailRow label="Save"  value={summary.actual_save}  percent={aPctSave}
                   colorClass={ summary.actual_save < 0 
            ? savingActualColor(summary.actual_save) 
            : 'text-white'
          } />
        <NwsRow score={summary.actual_nws} />
      </div>

      {/* ── 4. SUMMARY CARD ── */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">📑</span>
          <span className="font-sora text-sm font-bold text-white/85">Summary</span>
        </div>

        <SummaryBar
          label="Income" kind="income" month={month}
          actual={summary.actual_income} budget={summary.budget_income}
          actualWord="earned" budgetWord="budget"
        />
        <SummaryBar
          label="Expenses" kind="expense" month={month}
          actual={summary.actual_expense} budget={summary.budget_expense}
          actualWord="spent" budgetWord="budget"
        />
        <SummaryBar
          label="Savings" kind="saving" month={month}
          actual={summary.actual_save} budget={summary.budget_save}
          actualWord="saved" budgetWord="budget"
        />
      </div>
    </div>
  )
}

// ── Detail row (Needs / Wants / Save) ─────────────────────────────
function DetailRow({ label, value, percent, signed, colorClass }: {
  label: string; value: number; percent?: number; signed?: boolean; colorClass?: string
}) {
  const cls = colorClass ?? (signed ? signColor(value) : 'text-white')

  const totalWidth = "min-w-[140px]" 
  const pipeWidth  = "24px"          
  const textWidth  = "26px"          

  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="font-dm text-xs text-soft">{label}</span>
      
      <div
        className={cn("grid items-center font-dm text-xs tabular-nums", totalWidth)}
        style={{ gridTemplateColumns: `1fr ${pipeWidth} ${textWidth}` }}
      >
        <span className={cn('text-right', cls)}>{fmtAmt(value)}</span>
        {percent !== undefined ? (
          <>
            <span className="text-soft/30 text-center">|</span>
            <span className="text-soft text-left pl-0.5">{Math.round(percent)}%</span>
          </>
        ) : (
          <>
            <span />
            <span />
          </>
        )}
      </div>
    </div>
  )
}

// ── NWS score row ─────────────────────────────────────────────────
function NwsRow({ score }: { score: number }) {
  return (
    <div className="flex items-center justify-between pt-2 mt-1 border-t border-line">
      <span className="font-dm text-sm text-soft">NWS Score</span>
      <span className="font-sora text-base font-bold" style={{ color: nwsColor(score) }}>
        {score.toFixed(0)}%
      </span>
    </div>
  )
}

// ── Summary progress bar block ────────────────────────────────────
// 1. Added 'actualExpense' to the component props type definition
function SummaryBar({ label, kind, month, actual, budget, actualWord, budgetWord }: {
  label: string
  kind: 'income' | 'expense' | 'saving'
  month: string
  actual: number
  budget: number
  actualWord: string
  budgetWord: string
  
}) {
  const remaining = budget - actual

  // 2. Updated the conditional logic to use your new function
  const actualColor =
    kind === 'income'   ? 'text-green'
    : kind === 'saving' ? 'text-cyan'
    : expenseRemainingColor(remaining) // <-- Changed this line

  return (
    <div className="mb-4 last:mb-0">
      <p className="font-dm text-sm text-soft mb-1.5">{label}</p>
      <ProgressBar actual={actual} effectiveBudget={budget} kind={kind} month={month} height={8} />
      <div className="flex items-center justify-between mt-1.5">
        <span className={cn('font-sora text-sm font-bold', actualColor)}>
          {fmtAmt(actual)} <span className="font-dm text-[11px] font-normal text-muted">{actualWord}</span>
        </span>
        <span className="font-dm text-xs text-soft">
          {fmtAmt(budget)} <span className="text-muted">{budgetWord}</span>
        </span>
      </div>
    </div>
  )
}