import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn, todayLocal } from '@/lib/utils'
import { useAccounts } from '@/hooks/useAccounts'
import { useGoals }    from '@/hooks/useGoals'
import { useAddTransfer } from '@/hooks/useTransactionMutations'

interface TransferFormProps {
  onSuccess: () => void
  initialDate?: string    // NEW
  initialAccount?: string
  onCancel?:    () => void    // ← add this
}

// ── Zod schema ─────────────────────────────────────────────────────
const schema = z
  .object({
    date:         z.string().min(1, 'Date is required'),
    from_account: z.string().min(1, 'Select the source account'),
    to_account:   z.string().min(1, 'Select the destination account'),
    amount:       z
      .string()
      .min(1, 'Enter an amount')
      .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
        message: 'Amount must be a positive number',
      }),
    fee:        z.string().optional(),   // stored as string from input, parsed on submit
    from_funds: z.boolean(),
    goal_name:  z.string().optional(),
    note:       z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.from_account && data.to_account && data.from_account === data.to_account) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Source and destination accounts must be different',
        path: ['to_account'],
      })
    }
    if (data.from_funds && !data.goal_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select which goal this transfer is coming from',
        path: ['goal_name'],
      })
    }
  })

type FormData = z.infer<typeof schema>


// ── Component ──────────────────────────────────────────────────────
export function TransferForm({ onSuccess, initialDate, initialAccount, onCancel }: TransferFormProps) {
  const { data: accounts = [], isLoading: accLoading } = useAccounts()
  const { data: goals = [],    isLoading: gLoading   } = useGoals()
  const addTransfer = useAddTransfer()

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: initialDate ?? todayLocal(), // Changed from todayString()
      from_account: initialAccount ?? '',
      to_account:   '',
      amount:       '',
      fee:          '',
      from_funds:   false,
      goal_name:    '',
      note:         '',
    },
  })

  const watchFromFunds   = watch('from_funds')
  const watchFromAccount = watch('from_account')

  // ── Submit ────────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    try {
      await addTransfer.mutateAsync({
        date:         data.date,
        from_account: data.from_account,
        to_account:   data.to_account,
        amount:       parseFloat(data.amount),
        fee:          data.fee ? parseFloat(data.fee) : 0,
        note:         data.note ?? '',
        from_funds:   data.from_funds,
        goal_name:    data.from_funds ? data.goal_name : undefined,
      })

      reset({ date: todayLocal() })
      onSuccess()
    } catch (err) {
      console.error('Transfer save failed:', err)
    }
  }

  if (accLoading || gLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue border-t-transparent" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 pb-2">

      {/* ── Date ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Date
        </label>
        <input
          type="date"
          {...register('date')}
          className={cn(
            'w-full appearance-none rounded-xl border bg-panel px-4 py-3',
            'font-dm text-sm text-white outline-none transition-colors focus:border-blue',
            errors.date ? 'border-red' : 'border-line',
          )}
        />
        {errors.date && (
          <p className="mt-1 font-dm text-xs text-red">{errors.date.message}</p>
        )}
      </div>

      {/* ── From Account ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          From Account
        </label>
        <div className="relative">
          <select
            {...register('from_account')}
            className={cn(
              'w-full appearance-none rounded-xl border bg-panel px-4 py-3',
              'font-dm text-sm text-white outline-none transition-colors focus:border-blue',
              errors.from_account ? 'border-red' : 'border-line',
            )}
          >
            <option value="" disabled>Select source account…</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.master_account}>
                {acc.master_account}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
        </div>
        {errors.from_account && (
          <p className="mt-1 font-dm text-xs text-red">{errors.from_account.message}</p>
        )}
      </div>

      {/* ── To Account ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          To Account
        </label>
        <div className="relative">
          <select
            {...register('to_account')}
            className={cn(
              'w-full appearance-none rounded-xl border bg-panel px-4 py-3',
              'font-dm text-sm text-white outline-none transition-colors focus:border-blue',
              errors.to_account ? 'border-red' : 'border-line',
            )}
          >
            <option value="" disabled>Select destination account…</option>
            {accounts
              .filter(acc => acc.master_account !== watchFromAccount)
              .map(acc => (
                <option key={acc.id} value={acc.master_account}>
                  {acc.master_account}
                </option>
              ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
        </div>
        {errors.to_account && (
          <p className="mt-1 font-dm text-xs text-red">{errors.to_account.message}</p>
        )}
      </div>

      {/* ── Amount ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Amount (Rs)
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register('amount')}
          className={cn(
            'w-full rounded-xl border bg-panel px-4 py-3',
            'font-sora text-base text-white outline-none transition-colors focus:border-blue',
            errors.amount ? 'border-red' : 'border-line',
          )}
        />
        {errors.amount && (
          <p className="mt-1 font-dm text-xs text-red">{errors.amount.message}</p>
        )}
      </div>

      {/* ── Fee (optional) ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Transfer Fee (Rs){' '}
          <span className="normal-case text-muted">(optional — 0 if none)</span>
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register('fee')}
          className={cn(
            'w-full rounded-xl border border-line bg-panel px-4 py-3',
            'font-dm text-sm text-white placeholder:text-muted',
            'outline-none transition-colors focus:border-blue',
          )}
        />
      </div>

      {/* ── From Funds checkbox ── */}
      <div className="rounded-xl border border-line bg-panel px-4 py-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            {...register('from_funds')}
            className="h-5 w-5 cursor-pointer accent-amber rounded"
          />
          <span className="font-dm text-sm text-white">
            From Funds
          </span>
          <span className="ml-auto font-dm text-xs text-soft">
            Transfer uses savings / goal money
          </span>
        </label>
      </div>

      {/* ── Goal selector (shown only when From Funds is checked) ── */}
      {watchFromFunds && (
        <div className="animate-fade-in">
          <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
            Transfer from Goal
          </label>
          <div className="relative">
            <select
              {...register('goal_name')}
              className={cn(
                'w-full appearance-none rounded-xl border bg-panel px-4 py-3',
                'font-dm text-sm text-white outline-none transition-colors focus:border-amber',
                errors.goal_name ? 'border-red' : 'border-line',
              )}
            >
              <option value="" disabled>Which goal is funding this transfer?</option>
              {goals.map(g => (
                <option key={g.id} value={g.goal_name}>
                  {g.goal_name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
          </div>
          {errors.goal_name && (
            <p className="mt-1 font-dm text-xs text-red">{errors.goal_name.message}</p>
          )}
          <p className="mt-1.5 font-dm text-xs text-soft">
            This will deduct from the goal's savings balance.
          </p>
        </div>
      )}

      {/* ── Note ── */}
      {/* AFTER — multi-line textarea */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Note <span className="normal-case text-muted">(optional)</span>
        </label>
        <textarea
         placeholder="Add a note…"
         {...register('note')}
          className={cn(
           'note-field',
           'w-full rounded-xl border border-line bg-panel px-4 py-3 font-dm text-sm text-white placeholder:text-muted',
           'outline-none transition-colors focus:border-green',
          )}
       />
      </div>

      {/* ── Server error ── */}
      {addTransfer.isError && (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
          <p className="font-dm text-sm text-red">
            {addTransfer.error?.message ?? 'Transfer failed. Try again.'}
          </p>
        </div>
      )}

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={addTransfer.isPending}
        className={cn(
          'mt-2 w-full rounded-xl bg-blue py-4',
          'font-sora text-sm font-semibold text-white',
          'transition-all active:scale-[0.98]',
          addTransfer.isPending ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90',
        )}
      >
        {addTransfer.isPending ? 'Saving…' : 'Save Transfer'}
      </button>

      {/* ── Cancel ── */}
      {onCancel && (
        <button
          type="button"
         onClick={onCancel}
           className="w-full rounded-xl border border-line py-3.5 font-dm text-sm text-soft transition-colors hover:text-white"
          >
          Cancel
        </button>
      )}

    </form>
  )
}