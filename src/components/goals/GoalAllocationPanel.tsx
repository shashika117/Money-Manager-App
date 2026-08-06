// src/components/goals/GoalAllocationPanel.tsx


import { useState, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Select } from '@/components/forms/Select'
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
  useDeleteAllocation,
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
  /** Present ONLY when opened to edit an existing Monthly Allocation row
   *  (routed from GoalSavingsTable). Its presence — not initialGoal —
   *  is what puts the panel into edit mode: locks out the Share tab,
   *  changes the title, skips the "add another?" screen, and adds a
   *  Delete option. Never set for the FAB / month-header "add" paths. */
  editingId?:    string
}

export function GoalAllocationPanel({
  onClose, initialTab = 'allocate', initialMonth, initialDate,
  initialGoal, initialAmount, initialNote, editingId,
}: Props) {
  const isEditing = !!editingId
  const [tab, setTab] = useState<Tab>(isEditing ? 'allocate' : initialTab)
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
          <h2 className="font-sora text-base font-semibold text-white">
            {isEditing ? 'Edit Allocation' : 'Manage Goals'}
          </h2>
          <button onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel font-dm text-soft hover:text-white" aria-label="Close">✕</button>
        </div>

        {/* Tab switcher — hidden while editing: an existing allocation's
            "type" can't change to a goal-to-goal Share here. */}
        {!isEditing && (
          <div className="flex gap-1.5 rounded-xl bg-panel p-1 mx-5 mt-4 flex-none">
            <TabButton active={tab === 'allocate'} onClick={() => setTab('allocate')}>Allocate</TabButton>
            <TabButton active={tab === 'share'}    onClick={() => setTab('share')}>Share</TabButton>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 pt-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
          {tab === 'allocate'
            ? <AllocateTab
                editingId={editingId}
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
    .refine(v => !isNaN(parseFloat(v)), { message: 'Enter a valid number' }),
  note:   z.string().optional(),
})
type AllocForm = z.infer<typeof allocSchema>

function monthInputValue(monthKey?: string): string {
  if (monthKey) return monthKey.slice(0, 7)
  return todayLocal().slice(0, 7)
}

function AllocateTab({ editingId, initialMonth, initialGoal, initialAmount, initialNote, onDone }: {
  editingId?: string
  initialMonth?: string; initialGoal?: string; initialAmount?: number; initialNote?: string
  onDone: () => void
}) {
  const isEditing = !!editingId
  const { goals } = useGoalsEnriched()
  const upsert = useUpsertMonthlyAllocation()
  const del    = useDeleteAllocation()

  const [overridePrompt, setOverridePrompt] = useState<AllocForm | null>(null)
  const [addAnother, setAddAnother] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [cleanupError, setCleanupError] = useState<string | null>(null)

  const {
    register, handleSubmit, watch, control, reset, formState: { errors },
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
  const selectableGoals = useMemo(
    () => goals.filter(g => g.is_active && !g.linked_account),
    [goals],
  )

  // The record's ORIGINAL target, fixed at mount — used to tell "just
  // changed the amount/note" apart from "moved this to a different goal
  // or month". Only the latter is a genuine new target that needs its
  // own duplicate check; the former is unambiguously overwriting the
  // exact row already being edited.
  const originalGoal  = initialGoal ?? ''
  const originalMonth = monthInputValue(initialMonth)

  async function doSave(form: AllocForm, force: boolean) {
    const date = `${form.month}-01`
    const movedTarget = isEditing && (form.goal !== originalGoal || form.month !== originalMonth)
    const effectiveForce = (isEditing && !movedTarget) ? true : force

    const res = await upsert.mutateAsync({
      date, goal_name: form.goal, amount: parseFloat(form.amount), note: form.note, force: effectiveForce,
    })
    if (res.status === 'exists' && !effectiveForce) {
      setOverridePrompt(form)
      return
    }
    setOverridePrompt(null)

    if (isEditing && movedTarget) {
      // True move: the new target now holds the (possibly overridden)
      // data — remove the record at the OLD target so it doesn't linger
      // as a separate row. Only run after the new target's save is
      // confirmed successful, so a failed save never loses data.
      try {
        await del.mutateAsync(editingId!)
      } catch (err) {
        console.error('Failed to remove original allocation after move:', err)
        setCleanupError(
          'Saved to the new goal/month, but the original allocation could not be removed automatically. Please delete it manually.'
        )
        return
      }
    }

    if (isEditing) {
      onDone()   // edits close immediately — no "add another?" prompt
      return
    }

    setAddAnother(true)
    reset({ month: form.month, goal: '', amount: '', note: '' })
  }

  async function onSubmit(form: AllocForm) {
    setCleanupError(null)
    try { await doSave(form, false) }
    catch (err) { console.error('Allocation failed:', err) }
  }

  async function handleDelete() {
    if (!editingId) return
    try {
      await del.mutateAsync(editingId)
      onDone()
    } catch (err) {
      console.error('Allocation delete failed:', err)
    }
  }

  // ── Fresh-add success screen — unreachable while editing ──────────
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

  // ── Delete confirmation — edit mode only ───────────────────────────
  if (confirmDelete) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-4">
          <p className="font-sora text-sm font-semibold text-red mb-2">Delete this allocation?</p>
          <p className="font-dm text-xs text-soft leading-relaxed">
            This permanently removes {originalGoal || 'this goal'}'s allocation for {originalMonth}.
          </p>
        </div>
        <button onClick={handleDelete} disabled={del.isPending}
          className={cn('w-full rounded-xl bg-red py-4 font-sora text-sm font-semibold text-white transition-all active:scale-[0.98]',
            del.isPending ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90')}>
          {del.isPending ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button onClick={() => setConfirmDelete(false)}
          className="w-full rounded-xl border border-line py-3 font-dm text-sm text-soft hover:text-white">
          Cancel
        </button>
      </div>
    )
  }

  // ── Override confirmation — now an internal screen of the panel
  //     itself, not a viewport-centered floating modal (which is what
  //     made it appear off-center relative to the panel on laptop). ──
  if (overridePrompt) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-4">
          <p className="font-sora text-sm font-semibold text-amber mb-2">Override existing allocation?</p>
          <p className="font-dm text-sm text-soft leading-relaxed">
            This will replace the existing allocation for <span className="text-white">{overridePrompt.goal}</span> with{' '}
            <span className="text-white">{fmtAmt(parseFloat(overridePrompt.amount))}</span>.
          </p>
        </div>
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
        <Controller
          name="goal"
          control={control}
          render={({ field }) => (
            <Select
              options={selectableGoals.map(g => {
                const b = budgetMap?.get(g.goal_name)
                const budget = b != null ? `   —   Budget ${fmtAmt(b)}` : ''
                return { value: g.goal_name, label: `${g.goal_name}${budget}` }
              })}
              value={field.value}
              onChange={field.onChange}
              placeholder="Select a goal…"
              error={!!errors.goal}
              focusColorClass="focus:border-cyan"
              emptyLabel="No goals available."
            />
          )}
        />
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
        <input 
          type="number" 
          inputMode="decimal" 
          step="0.01" 
          placeholder="0.00"
          {...register('amount')} 
          className={cn(
            'w-full rounded-xl border bg-panel px-4 py-3',
            'font-sora text-base text-white outline-none transition-colors focus:border-cyan',
            errors.amount ? 'border-red' : 'border-line',
          )} 
        />
      </Field>

      <Field label="Note" hint="optional">
        <input type="text" placeholder="Add a note…" {...register('note')} className={inputCls(false)} />
      </Field>

      {upsert.isError && (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
          <p className="font-dm text-sm text-red">{upsert.error?.message ?? 'Could not save. Try again.'}</p>
        </div>
      )}

      {cleanupError && (
        <div className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3">
          <p className="font-dm text-sm text-amber leading-relaxed">{cleanupError}</p>
        </div>
      )}

      <button type="submit" disabled={upsert.isPending || del.isPending}
        className={cn('mt-1 w-full rounded-xl bg-cyan py-4 font-sora text-sm font-semibold text-navy transition-all active:scale-[0.98]',
          (upsert.isPending || del.isPending) ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90')}>
        {upsert.isPending || del.isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Save allocation'}
      </button>

      {isEditing && (
        <button type="button" onClick={() => setConfirmDelete(true)}
          className="w-full rounded-xl bg-red/10 border border-red/30 py-3.5 font-dm text-sm font-medium text-red hover:bg-red/20">
          Delete allocation
        </button>
      )}
    </form>
  )
}

// Small uneditable 3-column summary of a month's existing allocations
function MonthAllocationSummary({ month }: { month: string }) {
  const { data: activity = [] } = useGoalActivity()
  const { data: budgetMap } = useGoalBudgetForMonth(month)

  const [y, m] = month.split('-').map(Number)
  const rows = useMemo(() => {
    if (!y || !m) return []
    const start = new Date(y, m - 1, 1), end = new Date(y, m, 1)
    const allocs = activity.filter(r =>
      r.kind === 'allocation' &&
      new Date(r.date + 'T00:00:00') >= start &&
      new Date(r.date + 'T00:00:00') <  end)
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
    .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, { message: 'Amount must be 0 or greater' }),
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
    register, handleSubmit, watch, control, formState: { errors },
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
      console.error('Goal transfer failed:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Field label="Date" error={errors.date?.message}>
        <input type="date" {...register('date')} className={inputCls(!!errors.date)} />
      </Field>

      <Field label="From goal" error={errors.from_goal?.message}>
        <Controller
          name="from_goal"
          control={control}
          render={({ field }) => (
            <Select
              options={activeGoals
                .filter(g => g.goal_name !== watchTo)
                .map(g => ({ value: g.goal_name, label: g.goal_name }))}
              value={field.value}
              onChange={field.onChange}
              placeholder="Move funds from…"
              error={!!errors.from_goal}
              focusColorClass="focus:border-cyan"
            />
          )}
        />
        {fromBalance != null && (
          <p className="mt-1 font-dm text-xs text-soft">
            Current balance: <span className={cn('font-medium', fromBalance < 0 ? 'text-red' : 'text-cyan')}>{fmtSignedAmt(fromBalance)}</span>
          </p>
        )}
      </Field>

      <Field label="To goal" error={errors.to_goal?.message}>
        <Controller
          name="to_goal"
          control={control}
          render={({ field }) => (
            <Select
              options={activeGoals
                .filter(g => g.goal_name !== watchFrom)
                .map(g => ({ value: g.goal_name, label: g.goal_name }))}
              value={field.value}
              onChange={field.onChange}
              placeholder="Move funds to…"
              error={!!errors.to_goal}
              focusColorClass="focus:border-cyan"
            />
          )}
        />
      </Field>

      <Field label="Amount" error={errors.amount?.message}>
        <input 
          type="number" 
          inputMode="decimal" 
          step="0.01" 
          min="0"
          placeholder="0.00"
          {...register('amount')} 
          className={cn(
            'w-full rounded-xl border bg-panel px-4 py-3',
            'font-sora text-base text-white outline-none transition-colors focus:border-cyan',
            errors.amount ? 'border-red' : 'border-line',
          )} 
        />
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