// src/components/budget/SummaryCards.tsx
//
// The static 1/4-width summary block: Budget card, Actual card, Summary card.
// Stays in place while the table scrolls (parent applies sticky positioning).

import { cn } from '@/lib/utils'
import { fmtAmt, signColor, nwsColor } from '@/lib/budgetFormat'
import { ProgressBar } from '@/components/budget/ProgressBar'
import type { BudgetSummary } from '@/hooks/useBudgetSummary'

interface SummaryCardsProps {
  summary: BudgetSummary | undefined
  month:   string
  loading: boolean
}

export function SummaryCards({ summary, month, loading }: SummaryCardsProps) {
  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">

      {/* ── BUDGET CARD ── */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📊</span>
          <span className="font-sora text-sm font-bold text-white">Budget</span>
        </div>

        {/* Left-to-budget (card in card) */}
        <div className="rounded-xl bg-navy/60 border border-line py-4 px-3 text-center mb-3">
          <p className={cn('font-sora text-2xl font-bold', signColor(summary.left_to_budget))}>
            {fmtAmt(summary.left_to_budget)}
          </p>
          <p className="font-dm text-[10px] uppercase tracking-wider text-soft mt-1">Left to budget</p>
        </div>

        <DetailRow label="Needs" value={summary.budget_needs} />
        <DetailRow label="Wants" value={summary.budget_wants} />
        <DetailRow label="Save"  value={summary.budget_save} />
        <NwsRow score={summary.budget_nws} />
      </div>

      {/* ── ACTUAL CARD ── */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">💸</span>
          <span className="font-sora text-sm font-bold text-white">Actual</span>
        </div>

        <div className="rounded-xl bg-navy/60 border border-line py-4 px-3 text-center mb-3">
          <p className={cn('font-sora text-2xl font-bold', signColor(summary.left_to_save))}>
            {fmtAmt(summary.left_to_save)}
          </p>
          <p className="font-dm text-[10px] uppercase tracking-wider text-soft mt-1">Left to save</p>
        </div>

        <DetailRow label="Needs" value={summary.actual_needs} />
        <DetailRow label="Wants" value={summary.actual_wants} />
        <DetailRow label="Save"  value={summary.actual_save} signed />
        <NwsRow score={summary.actual_nws} />
      </div>

      {/* ── SUMMARY CARD ── */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">📑</span>
          <span className="font-sora text-sm font-bold text-white">Summary</span>
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
function DetailRow({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  // signed=true → colour by sign (Actual Save can be negative). Else neutral.
  return (
    <div className="flex items-center justify-between py-1">
      <span className="font-dm text-sm text-soft">{label}</span>
      <span className={cn('font-dm text-sm', signed ? signColor(value) : 'text-white')}>
        {fmtAmt(value)}
      </span>
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
function SummaryBar({ label, kind, month, actual, budget, actualWord, budgetWord }: {
  label: string
  kind: 'income' | 'expense' | 'saving'
  month: string
  actual: number
  budget: number
  actualWord: string
  budgetWord: string
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="font-dm text-sm text-white mb-1.5">{label}</p>
      <ProgressBar actual={actual} effectiveBudget={budget} kind={kind} month={month} height={8} />
      <div className="flex items-center justify-between mt-1.5">
        <span className={cn('font-dm text-xs', signColor(actual))}>
          {fmtAmt(actual)} <span className="text-muted">{actualWord}</span>
        </span>
        <span className="font-dm text-xs text-soft">
          {fmtAmt(budget)} <span className="text-muted">{budgetWord}</span>
        </span>
      </div>
    </div>
  )
}
