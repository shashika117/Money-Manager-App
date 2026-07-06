// src/components/goals/EditGoalTransferSheet.tsx
//
// Edit or delete a goal→goal "Funds Transfer". The user taps either leg
// (both share transfer_group_id); we reconstruct the pair from the
// activity cache and edit via update_goal_transfer (which re-validates
// the from-goal balance, excluding this transfer's own rows).

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import { useGoalsEnriched } from '@/hooks/useGoalsEnriched'
import { useGoalActivity, type GoalActivityRecord } from '@/hooks/useGoalActivity'
import { useUpdateGoalTransfer, useDeleteGoalTransfer } from '@/hooks/useGoalMutations'

interface Props {
  record:  GoalActivityRecord   // one leg of the transfer that was tapped
  onClose: () => void
}

const schema = z.object({
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
type FormData = z.infer<typeof schema>

export function EditGoalTransferSheet({ record, onClose }: Props) {
  const [isClosing, setIsClosing] = useState(false)
  const [mode, setMode] = useState<'edit' | 'confirm_delete'>('edit')

  const { goals } = useGoalsEnriched()
  const { data: activity = [] } = useGoalActivity()
  const update = useUpdateGoalTransfer()
  const del    = useDeleteGoalTransfer()

  const activeGoals = useMemo(() => goals.filter(g => g.is_active), [goals])

  // Reconstruct the pair from the shared transfer_group_id.
  const pair = useMemo(() => {
    const gid = record.transfer_group_id
    const rows = activity.filter(r => r.transfer_group_id === gid && r.kind === 'funds_transfer')
    const outRow = rows.find(r => r.singed_amount < 0)   // from-goal
    const inRow  = rows.find(r => r.singed_amount > 0)   // to-goal
    return {
      from_goal: outRow?.goal ?? '',
      to_goal:   inRow?.goal ?? '',
      amount:    Math.abs(outRow?.singed_amount ?? record.singed_amount),
      date:      record.date,
      note:      record.note,
    }
  }, [activity, record])

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: pair.date, from_goal: pair.from_goal, to_goal: pair.to_goal,
      amount: String(pair.amount), note: pair.note ?? '',
    },
  })
  const watchFrom = watch('from_goal')

  function handleClose() {
    setIsClosing(true)
    setTimeout(() => { setIsClosing(false); onClose() }, 240)
  }

  async function onSubmit(form: FormData) {
    if (!record.transfer_group_id) return
    try {
      await update.mutateAsync({
        transfer_group_id: record.transfer_group_id,
        date: form.date, from_goal: form.from_goal, to_goal: form.to_goal,
        amount: parseFloat(form.amount), note: form.note,
      })
      onClose()
    } catch (err) { console.error('Goal transfer update failed:', err) }
  }

  async function handleDelete() {
    if (!record.transfer_group_id) return
    try { await del.mutateAsync(record.transfer_group_id); onClose() }
    catch (err) { console.error('Goal transfer delete failed:', err) }
  }

  return (
    <>
      <div className={cn('fixed inset-0 z-50 bg-black/70', isClosing ? 'animate-fade-out' : 'animate-fade-in')}
        onClick={handleClose} aria-hidden="true" />
      <div className={cn(
        'fixed z-50 bg-card flex flex-col overflow-hidden',
        'bottom-0 left-0 right-0 rounded-t-2xl max-h-[90dvh]',
        'md:inset-y-0 md:left-auto md:right-0 md:w-96 md:rounded-none md:rounded-l-2xl md:max-h-none md:h-full md:border-l md:border-line',
        isClosing ? 'animate-slide-down md:animate-slide-out-right' : 'animate-slide-up md:animate-slide-in-right',
      )}>
        <div className="flex justify-center pt-3 pb-1 md:hidden flex-none">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-line flex-none">
          <h2 className="font-sora text-base font-semibold text-white">
            {mode === 'confirm_delete' ? 'Delete transfer' : 'Edit funds transfer'}
          </h2>
          <button onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel font-dm text-soft hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>

          {mode === 'edit' ? (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">Date</label>
                <input type="date" {...register('date')}
                  className={cn('w-full rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white outline-none transition-colors focus:border-cyan',
                    errors.date ? 'border-red' : 'border-line')} />
              </div>

              <div>
                <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">From goal</label>
                <div className="relative">
                  <select {...register('from_goal')}
                    className={cn('w-full appearance-none pr-10 rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white outline-none focus:border-cyan',
                      errors.from_goal ? 'border-red' : 'border-line')}>
                    {activeGoals.map(g => <option key={g.id} value={g.goal_name}>{g.goal_name}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
                </div>
                {errors.from_goal && <p className="mt-1 font-dm text-xs text-red">{errors.from_goal.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">To goal</label>
                <div className="relative">
                  <select {...register('to_goal')}
                    className={cn('w-full appearance-none pr-10 rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white outline-none focus:border-cyan',
                      errors.to_goal ? 'border-red' : 'border-line')}>
                    {activeGoals.filter(g => g.goal_name !== watchFrom).map(g =>
                      <option key={g.id} value={g.goal_name}>{g.goal_name}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
                </div>
                {errors.to_goal && <p className="mt-1 font-dm text-xs text-red">{errors.to_goal.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">Amount</label>
                <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
                  {...register('amount')}
                  className={cn('w-full rounded-xl border bg-panel px-4 py-3 font-sora text-base text-white outline-none focus:border-cyan',
                    errors.amount ? 'border-red' : 'border-line')} />
                {errors.amount && <p className="mt-1 font-dm text-xs text-red">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
                  Note <span className="normal-case text-muted">(optional)</span>
                </label>
                <input type="text" placeholder="Add a note…" {...register('note')}
                  className="w-full rounded-xl border border-line bg-panel px-4 py-3 font-dm text-sm text-white placeholder:text-muted outline-none focus:border-cyan" />
              </div>

              {update.isError && (
                <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
                  <p className="font-dm text-sm text-red">{update.error?.message ?? 'Update failed. Try again.'}</p>
                </div>
              )}

              <button type="submit" disabled={update.isPending}
                className={cn('mt-1 w-full rounded-xl bg-cyan py-4 font-sora text-sm font-semibold text-navy transition-all active:scale-[0.98]',
                  update.isPending ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90')}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </button>

              <button type="button" onClick={() => setMode('confirm_delete')}
                className="w-full rounded-xl bg-red/10 border border-red/30 py-3.5 font-dm text-sm font-medium text-red hover:bg-red/20">
                Delete transfer
              </button>

              <button type="button" onClick={handleClose}
                className="w-full rounded-xl border border-line py-3 font-dm text-sm text-soft hover:text-white">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-4">
                <p className="font-sora text-sm font-semibold text-red mb-2">Delete this transfer?</p>
                <p className="font-dm text-xs text-soft leading-relaxed">
                  Both legs of the {pair.from_goal} → {pair.to_goal} transfer will be permanently removed.
                </p>
              </div>
              <button onClick={handleDelete} disabled={del.isPending}
                className={cn('w-full rounded-xl bg-red py-4 font-sora text-sm font-semibold text-white transition-all active:scale-[0.98]',
                  del.isPending ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90')}>
                {del.isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setMode('edit')}
                className="w-full rounded-xl border border-line py-3 font-dm text-sm text-soft hover:text-white">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
