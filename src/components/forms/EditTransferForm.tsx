import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import { useAccounts } from '@/hooks/useAccounts'
import { useGoals }   from '@/hooks/useGoals'
import type { TransferGroupData } from '@/hooks/useEditTransaction'
import { useUpdateTransfer } from '@/hooks/useEditTransaction'

const schema = z.object({
  date:         z.string().min(1),
  from_account: z.string().min(1, 'Select source account'),
  to_account:   z.string().min(1, 'Select destination account'),
  amount:       z.string().min(1).refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, { message: 'Enter a positive amount' }),
  fee:          z.string().optional(),
  from_funds:   z.boolean(),
  goal_name:    z.string().optional(),
  note:         z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.from_account && d.to_account && d.from_account === d.to_account) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Accounts must be different', path: ['to_account'] })
  }
  if (d.from_funds && !d.goal_name) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select a goal', path: ['goal_name'] })
  }
})
type FormData = z.infer<typeof schema>

interface Props {
  transferData: TransferGroupData
  onSuccess:    () => void
  onCancel:     () => void
}

export function EditTransferForm({ transferData, onSuccess, onCancel }: Props) {
  const { data: accounts = [] } = useAccounts()
  const { data: goals    = [] } = useGoals()
  const updateTransfer = useUpdateTransfer()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date:         transferData.date,
      from_account: transferData.from_account,
      to_account:   transferData.to_account,
      amount:       String(transferData.amount),
      fee:          transferData.fee > 0 ? String(transferData.fee) : '',
      from_funds:   transferData.from_funds,
      goal_name:    transferData.goal_name ?? '',
      note:         transferData.note ?? '',
    },
  })

  const watchFromFunds   = watch('from_funds')
  const watchFromAccount = watch('from_account')

  async function onSubmit(data: FormData) {
    try {
      await updateTransfer.mutateAsync({
        transfer_group_id: transferData.transfer_group_id,
        date:         data.date,
        from_account: data.from_account,
        to_account:   data.to_account,
        amount:       parseFloat(data.amount),
        fee:          data.fee ? parseFloat(data.fee) : 0,
        note:         data.note ?? '',
        from_funds:   data.from_funds,
        goal_name:    data.from_funds ? (data.goal_name ?? null) : null,
      })
      onSuccess()
    } catch (err) {
      console.error('Transfer update failed:', err)
    }
  }

  const selectCls = (err?: { message?: string }) => cn(
    'w-full appearance-none rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white outline-none transition-colors focus:border-blue',
    err ? 'border-red' : 'border-line',
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 pb-2">

      <div className="flex items-center gap-2 rounded-xl border border-blue/30 bg-blue/10 px-4 py-2.5">
        <span className="font-dm text-xs uppercase tracking-wider font-medium text-blue">Editing</span>
        <span className="font-sora text-sm font-semibold text-blue">Transfer</span>
      </div>

      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">Date</label>
        <input type="date" {...register('date')} className={cn('w-full appearance-none rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white outline-none transition-colors focus:border-blue', errors.date ? 'border-red' : 'border-line')} />
      </div>

      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">From Account</label>
        <div className="relative">
          <select {...register('from_account')} className={selectCls(errors.from_account)}>
            {accounts.map(a => <option key={a.id} value={a.master_account}>{a.master_account}</option>)}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
        </div>
        {errors.from_account && <p className="mt-1 font-dm text-xs text-red">{errors.from_account.message}</p>}
      </div>

      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">To Account</label>
        <div className="relative">
          <select {...register('to_account')} className={selectCls(errors.to_account)}>
            {accounts.filter(a => a.master_account !== watchFromAccount).map(a => (
              <option key={a.id} value={a.master_account}>{a.master_account}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
        </div>
        {errors.to_account && <p className="mt-1 font-dm text-xs text-red">{errors.to_account.message}</p>}
      </div>

      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">Amount (Rs)</label>
        <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" {...register('amount')}
          className={cn('w-full rounded-xl border bg-panel px-4 py-3 font-sora text-base text-white outline-none transition-colors focus:border-blue', errors.amount ? 'border-red' : 'border-line')}
        />
        {errors.amount && <p className="mt-1 font-dm text-xs text-red">{errors.amount.message}</p>}
      </div>

      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">Fee (Rs) <span className="normal-case text-muted">(optional)</span></label>
        <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" {...register('fee')}
          className="w-full rounded-xl border border-line bg-panel px-4 py-3 font-dm text-sm text-white placeholder:text-muted outline-none transition-colors focus:border-blue"
        />
      </div>

      <div className="rounded-xl border border-line bg-panel px-4 py-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" {...register('from_funds')} className="h-5 w-5 cursor-pointer accent-amber rounded" />
          <span className="font-dm text-sm text-white">From Funds</span>
          <span className="ml-auto font-dm text-xs text-soft">Transfer uses goal savings</span>
        </label>
      </div>

      {watchFromFunds && (
        <div>
          <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">Goal</label>
          <div className="relative">
            <select {...register('goal_name')} className={selectCls(errors.goal_name)}>
              <option value="" disabled>Select goal…</option>
              {goals.map(g => <option key={g.id} value={g.goal_name}>{g.goal_name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
          </div>
          {errors.goal_name && <p className="mt-1 font-dm text-xs text-red">{errors.goal_name.message}</p>}
        </div>
      )}

      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">Note <span className="normal-case text-muted">(optional)</span></label>
        {/* AFTER */}
        <textarea
          placeholder="Add a note…"
          {...register('note')}
         className="note-field w-full rounded-xl border border-line bg-panel px-4 py-3 font-dm text-sm text-white placeholder:text-muted outline-none transition-colors focus:border-blue"
        />
      </div>

      {updateTransfer.isError && (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
          <p className="font-dm text-sm text-red">Update failed. Try again.</p>
        </div>
      )}

      <button type="submit" disabled={updateTransfer.isPending}
        className={cn('mt-2 w-full rounded-xl bg-blue py-4 font-sora text-sm font-semibold text-white transition-all active:scale-[0.98]', updateTransfer.isPending ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90')}
      >
        {updateTransfer.isPending ? 'Saving…' : 'Save Changes'}
      </button>

      <button type="button" onClick={onCancel}
        className="w-full rounded-xl border border-line py-3 font-dm text-sm text-soft hover:text-white"
      >
        Cancel Edit
      </button>
    </form>
  )
}
