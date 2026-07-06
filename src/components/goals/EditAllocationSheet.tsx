// src/components/goals/EditAllocationSheet.tsx
//
// Edit an existing MANUAL Monthly Allocation row (non-linked — a linked
// allocation routes to TransactionDetailPanel instead, handled by the
// table). Uses the same upsert RPC with force=true to overwrite that
// month's allocation; also supports deleting the allocation.

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import { fmtMonthYear } from '@/lib/goalFormat'
import { useUpsertMonthlyAllocation, useDeleteAllocation } from '@/hooks/useGoalMutations'
import type { GoalActivityRecord } from '@/hooks/useGoalActivity'

interface Props {
  record:  GoalActivityRecord   // the allocation row being edited
  onClose: () => void
}

const schema = z.object({
  amount: z.string().min(1, 'Enter an amount')
    .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, { message: 'Amount must be greater than 0' }),
  note:   z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function EditAllocationSheet({ record, onClose }: Props) {
  const [isClosing, setIsClosing] = useState(false)
  const [mode, setMode] = useState<'edit' | 'confirm_delete'>('edit')
  const upsert = useUpsertMonthlyAllocation()
  const del    = useDeleteAllocation()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: String(Math.abs(record.singed_amount)),
      note:   record.note ?? '',
    },
  })

  function handleClose() {
    setIsClosing(true)
    setTimeout(() => { setIsClosing(false); onClose() }, 240)
  }

  async function onSubmit(form: FormData) {
    try {
      // force=true overwrites this goal's allocation for the record's month
      await upsert.mutateAsync({
        date: record.date, goal_name: record.goal,
        amount: parseFloat(form.amount), note: form.note, force: true,
      })
      onClose()
    } catch (err) { console.error('Allocation update failed:', err) }
  }

  async function handleDelete() {
    try { await del.mutateAsync(record.id); onClose() }
    catch (err) { console.error('Allocation delete failed:', err) }
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
            {mode === 'confirm_delete' ? 'Delete allocation' : 'Edit allocation'}
          </h2>
          <button onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel font-dm text-soft hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>

          {mode === 'edit' ? (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              <div className="rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-2.5">
                <span className="font-dm text-xs uppercase tracking-wider text-cyan">Monthly Allocation</span>
                <p className="font-sora text-sm font-semibold text-white mt-0.5">
                  {record.goal} · {fmtMonthYear(record.date)}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">Amount</label>
                <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
                  {...register('amount')}
                  className={cn('w-full rounded-xl border bg-panel px-4 py-3 font-sora text-base text-white outline-none transition-colors focus:border-cyan',
                    errors.amount ? 'border-red' : 'border-line')} />
                {errors.amount && <p className="mt-1 font-dm text-xs text-red">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
                  Note <span className="normal-case text-muted">(optional)</span>
                </label>
                <input type="text" placeholder="Add a note…" {...register('note')}
                  className="w-full rounded-xl border border-line bg-panel px-4 py-3 font-dm text-sm text-white placeholder:text-muted outline-none transition-colors focus:border-cyan" />
              </div>

              {upsert.isError && (
                <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
                  <p className="font-dm text-sm text-red">Update failed. Try again.</p>
                </div>
              )}

              <button type="submit" disabled={upsert.isPending}
                className={cn('mt-1 w-full rounded-xl bg-cyan py-4 font-sora text-sm font-semibold text-navy transition-all active:scale-[0.98]',
                  upsert.isPending ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90')}>
                {upsert.isPending ? 'Saving…' : 'Save changes'}
              </button>

              <button type="button" onClick={() => setMode('confirm_delete')}
                className="w-full rounded-xl bg-red/10 border border-red/30 py-3.5 font-dm text-sm font-medium text-red hover:bg-red/20">
                Delete allocation
              </button>

              <button type="button" onClick={handleClose}
                className="w-full rounded-xl border border-line py-3 font-dm text-sm text-soft hover:text-white">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-4">
                <p className="font-sora text-sm font-semibold text-red mb-2">Delete this allocation?</p>
                <p className="font-dm text-xs text-soft leading-relaxed">
                  This removes the {fmtMonthYear(record.date)} allocation for {record.goal}. This action cannot be undone.
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
