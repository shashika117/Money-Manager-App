// src/components/goals/GoalFormPanel.tsx
//
// Create OR edit a goal. Right-side panel on laptop, bottom sheet on
// mobile (same responsive shell as TransactionDetailPanel).
//
// Fields: goal name, start date (create only), target amount, target
// date, is_active toggle, template_budget, linked account.
//
// Two save-guards (checked against the useGoalsEnriched cache, no query):
//   1. goal name unique          → "The [name] already exists"
//   2. account not already linked → "The [account] is already linked to [goal]"

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn, todayLocal } from '@/lib/utils'
import { useAccounts } from '@/hooks/useAccounts'
import {
  useGoalsEnriched,
  isGoalNameTaken,
  accountLinkedTo,
  type EnrichedGoal,
} from '@/hooks/useGoalsEnriched'
import { useCreateGoal, useUpdateGoal } from '@/hooks/useGoalMutations'

interface Props {
  goal:    EnrichedGoal | null   // null = create mode
  onClose: () => void
}

const schema = z.object({
  goal_name:       z.string().min(1, 'Enter a goal name'),
  created_at:      z.string().min(1, 'Pick a start date'),
  target_amount:   z.string().optional(),
  target_date:     z.string().optional(),
  template_budget: z.string().optional(),
  linked_account:  z.string().optional(),
  is_active:       z.boolean(),
})
type FormData = z.infer<typeof schema>

export function GoalFormPanel({ goal, onClose }: Props) {
  const isEdit = !!goal
  const [isClosing, setIsClosing] = useState(false)
  const [guardError, setGuardError] = useState<string | null>(null)

  const { data: accounts = [] } = useAccounts()
  const { goals } = useGoalsEnriched()
  const createGoal = useCreateGoal()
  const updateGoal = useUpdateGoal()
  const isSaving = createGoal.isPending || updateGoal.isPending

  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      goal_name:       goal?.goal_name ?? '',
      created_at:      goal?.created_at ?? todayLocal(),
      target_amount:   goal?.target_amount != null ? String(goal.target_amount) : '',
      target_date:     goal?.target_date ?? '',
      template_budget: goal?.template_budget != null ? String(goal.template_budget) : '',
      linked_account:  goal?.linked_account ?? '',
      is_active:       goal?.is_active ?? true,
    },
  })

  const watchActive = watch('is_active')

  function handleClose() {
    setIsClosing(true)
    setTimeout(() => { setIsClosing(false); onClose() }, 240)
  }

  async function onSubmit(form: FormData) {
    setGuardError(null)

    // Guard 1: unique name
    if (isGoalNameTaken(goals, form.goal_name, goal?.id)) {
      setGuardError(`The "${form.goal_name.trim()}" already exists.`)
      return
    }
    // Guard 2: account not already linked to a different goal
    const chosenAccount = form.linked_account || null
    if (chosenAccount) {
      const owner = accountLinkedTo(goals, chosenAccount, goal?.id)
      if (owner) {
        setGuardError(`The "${chosenAccount}" is already linked to the "${owner.goal_name}".`)
        return
      }
    }

    const payload = {
      goal_name:       form.goal_name.trim(),
      target_amount:   form.target_amount   ? parseFloat(form.target_amount)   : null,
      target_date:     form.target_date     || null,
      template_budget: form.template_budget ? parseFloat(form.template_budget) : null,
      linked_account:  chosenAccount,
      is_active:       form.is_active,
    }

    try {
      if (isEdit) {
        await updateGoal.mutateAsync({ id: goal!.id, ...payload })
      } else {
        // sort_order defaults to end of list
        const maxOrder = goals.reduce((m, g) => Math.max(m, g.sort_order), -1)
        await createGoal.mutateAsync({
          ...payload,
          created_at: form.created_at,
          sort_order: maxOrder + 1,
        })
      }
      onClose()
    } catch (err: any) {
      // DB unique-violation fallback (in case of a race the cache missed)
      const msg = String(err?.message ?? '')
      if (msg.includes('dim_goal_goal_name_key')) {
        setGuardError(`The "${form.goal_name.trim()}" already exists.`)
      } else if (msg.includes('linked_account')) {
        setGuardError(`That account is already linked to another goal.`)
      } else {
        setGuardError('Could not save the goal. Please try again.')
      }
    }
  }

  // Accounts already linked to OTHER goals — shown disabled in the dropdown
  const linkedElsewhere = new Set(
    goals.filter(g => g.id !== goal?.id && g.linked_account)
         .map(g => g.linked_account as string)
  )

  return (
    <>
      <div
        className={cn('fixed inset-0 z-50 bg-black/70', isClosing ? 'animate-fade-out' : 'animate-fade-in')}
        onClick={handleClose} aria-hidden="true"
      />
      <div className={cn(
        'fixed z-50 bg-card flex flex-col overflow-hidden',
        'bottom-0 left-0 right-0 rounded-t-2xl max-h-[92dvh]',
        'md:inset-y-0 md:left-auto md:right-0 md:w-96 md:rounded-none md:rounded-l-2xl md:max-h-none md:h-full md:border-l md:border-line',
        isClosing ? 'animate-slide-down md:animate-slide-out-right' : 'animate-slide-up md:animate-slide-in-right',
      )}>
        <div className="flex justify-center pt-3 pb-1 md:hidden flex-none">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-line flex-none">
          <h2 className="font-sora text-base font-semibold text-white">
            {isEdit ? 'Edit Goal' : 'New Goal'}
          </h2>
          <div className="flex items-center gap-3">
            {/* Active goal toggle switch — top-right corner */}
            <button type="button" onClick={() => setValue('is_active', !watchActive, { shouldDirty: true })}
              className="flex items-center gap-2 touch-manipulation" aria-pressed={watchActive}>
              <span className={cn('font-dm text-[11px]', watchActive ? 'text-cyan' : 'text-soft')}>
                {watchActive ? 'Active' : 'Inactive'}
              </span>
              <span className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                watchActive ? 'bg-cyan' : 'bg-line')}>
                <span className={cn('absolute h-3.5 w-3.5 rounded-full bg-white transition-transform',
                  watchActive ? 'translate-x-[18px]' : 'translate-x-[3px]')} />
              </span>
            </button>
            <button onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel font-dm text-soft hover:text-white" aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate
          className="flex-1 overflow-y-auto px-5 pt-4 flex flex-col gap-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>

          {/* is_active is controlled entirely via the header toggle (setValue). */}
          {!watchActive && (
            <p className="rounded-xl border border-amber/25 bg-amber/5 px-4 py-2.5 font-dm text-xs text-amber">
              Inactive goals are hidden from the forms and the default cards view.
            </p>
          )}

          <Field label="Goal name" error={errors.goal_name?.message}>
            <input type="text" placeholder="e.g. Emergency Fund" {...register('goal_name')}
              className={inputCls(!!errors.goal_name)} />
          </Field>

          {!isEdit && (
            <Field label="Start date" error={errors.created_at?.message}>
              <input type="date" {...register('created_at')} className={inputCls(!!errors.created_at)} />
            </Field>
          )}

          <Field label="Target amount" hint="optional">
            <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
              {...register('target_amount')} className={inputCls(false)} />
          </Field>

          <Field label="Target date" hint="optional">
            <input type="date" {...register('target_date')} className={inputCls(false)} />
          </Field>

          <Field label="Budget set" hint="optional — used as the template in the Budget page">
            <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
              {...register('template_budget')} className={inputCls(false)} />
          </Field>

          <Field label="Account link" hint="optional — 1 account per goal">
            <div className="relative">
              <select {...register('linked_account')} className={cn(inputCls(false), 'appearance-none pr-10')}>
                <option value="">No linked account</option>
                {accounts.map(a => {
                  const takenByOther = linkedElsewhere.has(a.master_account)
                  return (
                    <option key={a.id} value={a.master_account} disabled={takenByOther}>
                      {a.master_account}{takenByOther ? ' — linked elsewhere' : ''}
                    </option>
                  )
                })}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
            </div>
          </Field>

          {guardError && (
            <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
              <p className="font-dm text-sm text-red">{guardError}</p>
            </div>
          )}

          <button type="submit" disabled={isSaving}
            className={cn('mt-2 w-full rounded-xl bg-cyan py-4 font-sora text-sm font-semibold text-navy transition-all active:scale-[0.98]',
              isSaving ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90')}>
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create goal'}
          </button>

          <button type="button" onClick={handleClose}
            className="w-full rounded-xl border border-line py-3 font-dm text-sm text-soft hover:text-white">
            Cancel
          </button>
        </form>
      </div>
    </>
  )
}

// ── Small field wrapper ─────────────────────────────────────────────
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
