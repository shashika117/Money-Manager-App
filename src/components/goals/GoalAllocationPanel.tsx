// src/components/goals/GoalAllocationPanel.tsx
//
// The cyan FAB's two-tab window:
//   Tab 1 "Goal Fund Allocation Manager" — allocate money to a goal for
//         a month, with the once-per-month override flow and the
//         "add another?" continuation.
//   Tab 2 "Funds Share Manager" — transfer funds goal → goal, with the
//         from-goal balance-sufficiency check.
//
// Opened by the FAB, or by tapping a month-section header (which passes
// initialMonth / initialDate + an initialTab).

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn, todayLocal } from '@/lib/utils'
import { fmtAmt, fmtSignedAmt } from '@/lib/goalFormat'
import { useGoalsEnriched } from '@/hooks/useGoalsEnriched'
import {
  useGoalActivity,
  computeGoalBalances,
} from '@/hooks/useGoalActivity'
import {
  useUpsertMonthlyAllocation,
  useCreateGoalTransfer,
} from '@/hooks/useGoalMutations'
import { useLeftToSaveForMonth, useGoalBudgetForMonth } from '@/hooks/useGoalMisc'

type Tab = 'allocate' | 'share'

interface Props {
  onClose:      () => void
  initialTab?:  Tab
  initialMonth?: string   // 'YYYY-MM-01' — pre-fills allocate month
  initialDate?:  string   // 'YYYY-MM-DD' — pre-fills share date
  initialGoal?:  string   // pre-fills allocate goal (edit-from-table)
  initialAmount?: number  // pre-fills allocate amount (edit-from-table)
  initialNote?:  string   // pre-fills allocate note (edit-from-table)
}

export function GoalAllocationPanel({
  onClose, initialTab = 'allocate', initialMonth, initialDate,
  initialGoal, initialAmount, initialNote,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [isClosing, setIsClosing] = useState(false)

  function handleClose() {
    setIsClosing(true)
    setTimeout(() => { setIsClosing(false); onClose() }, 240)
  }

  return (
    <>
      <div className={cn('fixed inset-0 z-50 bg-black/70', isClosing ? 'animate-fade-out' : 'animate-fade-in')}
        onClick={handleClose} aria-hidden="true" />
      <div className={cn(
        'fixed z-50 bg-card flex flex-col overflow-hidden',
        'bottom-0 left-0 right-0 rounded-t-2xl max-h-[92dvh]',
        'md:inset-y-0 md:left-auto md:right-0 md:w-[26rem] md:rounded-none md:rounded-l-2xl md:max-h-none md:h-full md:border-l md:border-line',
        isClosing ? 'animate-slide-down md:animate-slide-out-right' : 'animate-slide-up md:animate-slide-in-right',
      )}>
        <div className="flex justify-center pt-3 pb-1 md:hidden flex-none">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>

        {/* Header + tabs */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-line flex-none">
          <h2 className="font-sora text-base font-semibold text-white">Manage Goals</h2>
          <button onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel font-dm text-soft hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="flex gap-1.5 rounded-xl bg-panel p-1 mx-5 mt-4 flex-none">
          <TabButton active={tab === 'allocate'} onClick={() => setTab('allocate')}>Allocate</TabButton>
          <TabButton active={tab === 'share'}    onClick={() => setTab('share')}>Share</TabButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          {tab === 'allocate'
            ? <AllocateTab
                initialMonth={initialMonth} initialGoal={initialGoal}
                initialAmount={initialAmount} initialNote={initialNote}
                onDone={onClose} />
            : <ShareTab initialDate={initialDate} onDone={onClose} />}
        </div>
      </div>
    </>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('flex-1 rounded-lg py-2 font-dm text-sm font-medium transition-colors',
        active ? 'bg-cyan text-navy' : 'text-soft hover:text-white')}>
      {children}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════
// TAB 1 — Goal Fund Allocation Manager
// ════════════════════════════════════════════════════════════════
const allocSchema = z.object({
  month:  z.string().min(1, 'Pick a month'),
  goal:   z.string().min(1, 'Select a goal'),
  amount: z.string().min(1, 'Enter an amount')
    .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, { message: 'Amount must be greater than 0' }),
  note:   z.string().optional(),
})
type AllocForm = z.infer<typeof allocSchema>

function monthInputValue(monthKey?: string): string {
  // <input type="month"> wants 'YYYY-MM'
  if (monthKey) return monthKey.slice(0, 7)
  return todayLocal().slice(0, 7)
}

function AllocateTab({ initialMonth, initialGoal, initialAmount, initialNote, onDone }: {
  initialMonth?: string; initialGoal?: string; initialAmount?: number; initialNote?: string
  onDone: () => void
}) {
  const { goals } = useGoalsEnriched()
  const upsert = useUpsertMonthlyAllocation()

  const [overridePrompt, setOverridePrompt] = useState<AllocForm | null>(null)
  const [addAnother, setAddAnother] = useState(false)

  const {
    register, handleSubmit, watch, reset, formState: { errors },
  } = useForm<AllocForm>({
    resolver: zodResolver(allocSchema),
    defaultValues: {
      month:  monthInputValue(initialMonth),
      goal:   initialGoal ?? '',
      amount: initialAmount != null ? String(initialAmount) : '',
      note:   initialNote ?? '',
    },
  })

  const watchMonth = watch('month')
  const watchGoal  = watch('goal')

  // Left-to-Save for the selected month (live)
  const monthKey = `${watchMonth}-01`
  const { data: leftToSave } = useLeftToSaveForMonth(watchMonth ? monthKey : null)

  // Per-goal budget for the selected month (from goal_budget_data).
  const { data: budgetMap } = useGoalBudgetForMonth(watchMonth ? monthKey : null)

  // Goals selectable for allocation: active AND NOT account-linked
  // (linked goals get their allocations automatically from transfers).
  const selectableGoals = useMemo(
    () => goals.filter(g => g.is_active && !g.linked_account),
    [goals],
  )

  async function doSave(form: AllocForm, force: boolean) {
    // month input gives 'YYYY-MM' → normalise to first-of-month date
    const date = `${form.month}-01`
    const res = await upsert.mutateAsync({
      date, goal_name: form.goal, amount: parseFloat(form.amount), note: form.note, force,
    })
    if (res.status === 'exists' && !force) {
      setOverridePrompt(form)   // ask to override
      return
    }
    // success (created / updated)
    setOverridePrompt(null)
    setAddAnother(true)
    reset({ month: form.month, goal: '', amount: '', note: '' })   // keep month per spec
  }

  async function onSubmit(form: AllocForm) {
    try { await doSave(form, false) }
    catch (err) { console.error('Allocation failed:', err) }
  }

  if (addAnother) {
    return (
      <div className="flex flex-col gap-4 py-6 text-center animate-fade-in">
        <p className="text-3xl">✅</p>
        <p className="font-sora text-sm font-semibold text-white">Allocation saved</p>
        <p className="font-dm text-sm text-soft">Add another allocation?</p>
        <div className="flex gap-3 mt-2">
          <button onClick={() => setAddAnother(false)}
            className="flex-1 rounded-xl bg-cyan py-3 font-sora text-sm font-semibold text-navy hover:opacity-90">
            Yes, add another
          </button>
          <button onClick={onDone}
            className="flex-1 rounded-xl border border-line py-3 font-dm text-sm text-soft hover:text-white">
            No, close
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Field label="Month" error={errors.month?.message}>
        <input type="month" {...register('month')} className={inputCls(!!errors.month)} />
      </Field>

      {/* Left to Save for the selected month */}
      <div className="flex items-center justify-between rounded-xl border border-cyan/25 bg-cyan/5 px-4 py-2.5">
        <span className="font-dm text-xs uppercase tracking-wider text-soft">Left to Save this month</span>
        <span className={cn('font-sora text-sm font-bold tabular-nums',
          leftToSave == null ? 'text-muted' : leftToSave < 0 ? 'text-red' : 'text-green')}>
          {leftToSave == null ? '—' : fmtSignedAmt(leftToSave)}
        </span>
      </div>

      {/* Existing allocations summary for the chosen month */}
      <MonthAllocationSummary month={`${watchMonth}-01`} />

      <Field label="Goal" error={errors.goal?.message}>
        <div className="relative">
          <select {...register('goal')} className={cn(inputCls(!!errors.goal), 'appearance-none pr-10')}>
            <option value="" disabled>Select a goal…</option>
            {selectableGoals.map(g => {
              // Month-specific budget from goal_budget_data (not template_budget).
              const b = budgetMap?.get(g.goal_name)
              const budget = b != null ? `   —   Budget ${fmtAmt(b)}` : ''
              return <option key={g.id} value={g.goal_name}>{g.goal_name}{budget}</option>
            })}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
        </div>
        {/* Distinct, prominent budget line for the SELECTED goal (this month) */}
        {(() => {
          const b = watchGoal ? budgetMap?.get(watchGoal) : undefined
          if (b != null) {
            return (
              <p className="mt-1.5 font-dm text-xs text-soft">
                Budget for this month:{' '}
                <span className="font-sora font-semibold text-cyan tabular-nums">{fmtAmt(b)}</span>
              </p>
            )
          }
          return null
        })()}
        {selectableGoals.length === 0 && (
          <p className="mt-1 font-dm text-xs text-muted">
            No goals available. Account-linked goals are funded automatically via transfers.
          </p>
        )}
      </Field>

      <Field label="Amount" error={errors.amount?.message}>
        <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
          {...register('amount')} className={inputCls(!!errors.amount)} />
      </Field>

      <Field label="Note" hint="optional">
        <input type="text" placeholder="Add a note…" {...register('note')} className={inputCls(false)} />
      </Field>

      {upsert.isError && (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
          <p className="font-dm text-sm text-red">{upsert.error?.message ?? 'Could not save. Try again.'}</p>
        </div>
      )}

      <button type="submit" disabled={upsert.isPending}
        className={cn('mt-1 w-full rounded-xl bg-cyan py-4 font-sora text-sm font-semibold text-navy transition-all active:scale-[0.98]',
          upsert.isPending ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90')}>
        {upsert.isPending ? 'Saving…' : 'Save allocation'}
      </button>

      {/* Override confirmation */}
      {overridePrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 animate-fade-in" onClick={() => setOverridePrompt(null)}>
          <div className="mx-6 max-w-sm rounded-2xl border border-line bg-card p-5 animate-fade-in-scale" onClick={e => e.stopPropagation()}>
            <p className="font-sora text-sm font-semibold text-amber mb-2">Override existing allocation?</p>
            <p className="font-dm text-sm text-soft leading-relaxed mb-4">
              This will replace the existing allocation for <span className="text-white">{overridePrompt.goal}</span> with{' '}
              <span className="text-white">{fmtAmt(parseFloat(overridePrompt.amount))}</span>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => doSave(overridePrompt, true)}
                className="flex-1 rounded-xl bg-amber py-3 font-sora text-sm font-semibold text-white hover:opacity-90">
                Override
              </button>
              <button onClick={() => setOverridePrompt(null)}
                className="flex-1 rounded-xl border border-line py-3 font-dm text-sm text-soft hover:text-white">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

// Small uneditable 3-column summary of a month's existing allocations
function MonthAllocationSummary({ month }: { month: string }) {
  const { data: activity = [] } = useGoalActivity()
  // Month-specific budget per goal (from goal_budget_data), keyed to this month.
  const { data: budgetMap } = useGoalBudgetForMonth(month)

  const [y, m] = month.split('-').map(Number)
  const rows = useMemo(() => {
    if (!y || !m) return []
    const start = new Date(y, m - 1, 1), end = new Date(y, m, 1)
    const allocs = activity.filter(r =>
      r.kind === 'allocation' &&
      new Date(r.date + 'T00:00:00') >= start &&
      new Date(r.date + 'T00:00:00') <  end)
    // group by goal
    const byGoal = new Map<string, number>()
    for (const a of allocs) byGoal.set(a.goal, (byGoal.get(a.goal) ?? 0) + a.singed_amount)
    return Array.from(byGoal.entries()).map(([goal, actual]) => {
      const budget = budgetMap?.get(goal)
      return { goal, budget: budget ?? null, actual }
    })
  }, [activity, budgetMap, y, m])

  if (rows.length === 0) {
    return <p className="-mt-1 font-dm text-xs text-muted">No allocations yet this month.</p>
  }

  const totalBudget = rows.reduce((s, r) => s + (r.budget ?? 0), 0)
  const totalActual = rows.reduce((s, r) => s + r.actual, 0)

  return (
    <div className="-mt-1 rounded-xl border border-line bg-navy/40 px-3 py-2.5">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-right">
        <span className="text-left font-dm text-[10px] uppercase tracking-wider text-muted">Goal</span>
        <span className="font-dm text-[10px] uppercase tracking-wider text-muted">Budget</span>
        <span className="font-dm text-[10px] uppercase tracking-wider text-muted">Actual</span>
        {rows.map(r => (
          <FragmentRow key={r.goal} goal={r.goal} budget={r.budget} actual={r.actual} />
        ))}
        <span className="text-left font-dm text-xs font-semibold text-white pt-1 border-t border-line/60">Total</span>
        <span className="font-sora text-xs font-semibold text-white pt-1 border-t border-line/60 tabular-nums">{fmtAmt(totalBudget)}</span>
        <span className="font-sora text-xs font-semibold text-cyan pt-1 border-t border-line/60 tabular-nums">{fmtAmt(totalActual)}</span>
      </div>
    </div>
  )
}

function FragmentRow({ goal, budget, actual }: { goal: string; budget: number | null; actual: number }) {
  return (
    <>
      <span className="text-left font-dm text-xs text-soft truncate">{goal}</span>
      <span className="font-dm text-xs text-soft tabular-nums">{budget != null ? fmtAmt(budget) : '—'}</span>
      <span className="font-dm text-xs text-white tabular-nums">{fmtAmt(actual)}</span>
    </>
  )
}

// ════════════════════════════════════════════════════════════════
// TAB 2 — Funds Share Manager (goal → goal)
// ════════════════════════════════════════════════════════════════
const shareSchema = z.object({
  date:      z.string().min(1, 'Pick a date'),
  from_goal: z.string().min(1, 'Select a source goal'),
  to_goal:   z.string().min(1, 'Select a destination goal'),
  amount:    z.string().min(1, 'Enter an amount')
    .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, { message: 'Amount must be greater than 0' }),
  note:      z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.from_goal && d.to_goal && d.from_goal === d.to_goal) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pick two different goals', path: ['to_goal'] })
  }
})
type ShareForm = z.infer<typeof shareSchema>

function ShareTab({ initialDate, onDone }: { initialDate?: string; onDone: () => void }) {
  const { goals } = useGoalsEnriched()
  const { data: activity = [] } = useGoalActivity()
  const createTransfer = useCreateGoalTransfer()

  const {
    register, handleSubmit, watch, formState: { errors },
  } = useForm<ShareForm>({
    resolver: zodResolver(shareSchema),
    defaultValues: { date: initialDate ?? todayLocal(), from_goal: '', to_goal: '', amount: '', note: '' },
  })

  const activeGoals = useMemo(() => goals.filter(g => g.is_active), [goals])
  const watchFrom = watch('from_goal')
  const watchTo   = watch('to_goal')

  // Live current balance of the chosen source goal (client-side)
  const fromBalance = useMemo(() => {
    if (!watchFrom) return null
    return computeGoalBalances(activity).get(watchFrom) ?? 0
  }, [watchFrom, activity])

  async function onSubmit(form: ShareForm) {
    try {
      await createTransfer.mutateAsync({
        date: form.date, from_goal: form.from_goal, to_goal: form.to_goal,
        amount: parseFloat(form.amount), note: form.note,
      })
      onDone()
    } catch (err) {
      console.error('Goal transfer failed:', err)   // insufficient-balance surfaces below
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Field label="Date" error={errors.date?.message}>
        <input type="date" {...register('date')} className={inputCls(!!errors.date)} />
      </Field>

      <Field label="From goal" error={errors.from_goal?.message}>
        <div className="relative">
          <select {...register('from_goal')} className={cn(inputCls(!!errors.from_goal), 'appearance-none pr-10')}>
            <option value="" disabled>Move funds from…</option>
            {activeGoals.map(g => <option key={g.id} value={g.goal_name}>{g.goal_name}</option>)}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
        </div>
        {fromBalance != null && (
          <p className="mt-1 font-dm text-xs text-soft">
            Current balance: <span className={cn('font-medium', fromBalance < 0 ? 'text-red' : 'text-cyan')}>{fmtSignedAmt(fromBalance)}</span>
          </p>
        )}
      </Field>

      <Field label="To goal" error={errors.to_goal?.message}>
        <div className="relative">
          <select {...register('to_goal')} className={cn(inputCls(!!errors.to_goal), 'appearance-none pr-10')}>
            <option value="" disabled>Move funds to…</option>
            {activeGoals.filter(g => g.goal_name !== watchFrom).map(g =>
              <option key={g.id} value={g.goal_name}>{g.goal_name}</option>)}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
        </div>
      </Field>

      <Field label="Amount" error={errors.amount?.message}>
        <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
          {...register('amount')} className={inputCls(!!errors.amount)} />
      </Field>

      <Field label="Note" hint="optional">
        <input type="text" placeholder="Add a note…" {...register('note')} className={inputCls(false)} />
      </Field>

      {watchFrom && watchTo && (
        <p className="-mt-1 font-dm text-xs text-muted">{watchFrom} → {watchTo}</p>
      )}

      {createTransfer.isError && (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
          <p className="font-dm text-sm text-red">{createTransfer.error?.message ?? 'Transfer failed. Try again.'}</p>
        </div>
      )}

      <button type="submit" disabled={createTransfer.isPending}
        className={cn('mt-1 w-full rounded-xl bg-cyan py-4 font-sora text-sm font-semibold text-navy transition-all active:scale-[0.98]',
          createTransfer.isPending ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90')}>
        {createTransfer.isPending ? 'Sharing…' : 'Share funds'}
      </button>
    </form>
  )
}

// ── Shared field helpers (local copies to keep this file standalone) ─
function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
        {label} {hint && <span className="normal-case text-muted">({hint})</span>}
      </label>
      {children}
      {error && <p className="mt-1 font-dm text-xs text-red">{error}</p>}
    </div>
  )
}
function inputCls(hasError: boolean) {
  return cn(
    'w-full rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white outline-none transition-colors focus:border-cyan',
    hasError ? 'border-red' : 'border-line',
  )
}
