import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn, todayLocal } from '@/lib/utils'
import { useAccounts } from '@/hooks/useAccounts'
import { useGoalsEnriched } from '@/hooks/useGoalsEnriched'
import { useGoalBudgetForMonth } from '@/hooks/useGoalMisc'
import { fmtAmt } from '@/lib/goalFormat'
import { useAddTransfer } from '@/hooks/useTransactionMutations'

// Turn the raw RPC error into the spec's user-facing message.
// The RPC raises: "DUPLICATE_ALLOCATION:Funds have already been allocated
// to <Goal> for <Mon YYYY>." — we append the guidance sentence.
function formatTransferError(msg: string | undefined): string {
  const raw = String(msg ?? '')
  if (raw.includes('DUPLICATE_ALLOCATION:')) {
    const detail = raw.split('DUPLICATE_ALLOCATION:')[1]?.trim() ?? ''
    return `${detail} To prevent duplicates, allocations are limited to once per month per goal. Please update the existing transfer record instead.`
  }
  return raw || 'Transfer failed. Try again.'
}

interface TransferFormProps {
  onSuccess: () => void
  initialDate?: string
  initialAccount?: string
  onCancel?:    () => void
}

// ── Zod schema (From Funds removed) ────────────────────────────────
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
    fee:        z.string().optional(),
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
  })

type FormData = z.infer<typeof schema>

export function TransferForm({ onSuccess, initialDate, initialAccount, onCancel }: TransferFormProps) {
  const { data: accounts = [], isLoading: accLoading } = useAccounts()
  const { goals } = useGoalsEnriched()
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
      date: initialDate ?? todayLocal(),
      from_account: initialAccount ?? '',
      to_account:   '',
      amount:       '',
      fee:          '',
      note:         '',
    },
  })

  const watchFromAccount = watch('from_account')
  const watchToAccount   = watch('to_account')
  const watchDate        = watch('date')

  // If the destination account is linked to a goal, the backend will
  // auto-create that goal's Monthly Allocation — surface which goal.
  const linkedGoal = watchToAccount
    ? goals.find(g => g.linked_account === watchToAccount) ?? null
    : null

  // Month-specific budget (goal_budget_data) for the transfer's date-month.
  const monthKey = watchDate ? `${watchDate.slice(0, 7)}-01` : null
  const { data: budgetMap } = useGoalBudgetForMonth(linkedGoal ? monthKey : null)
  const linkedGoalBudget = linkedGoal ? budgetMap?.get(linkedGoal.goal_name) ?? null : null

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
      })

      reset({ date: todayLocal() })
      onSuccess()
    } catch (err) {
      console.error('Transfer save failed:', err)
    }
  }

  if (accLoading) {
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

      {/* ── Linked goal (auto-shown when To account is goal-linked) ── */}
      {linkedGoal && (
        <div className="rounded-xl border border-cyan/30 bg-cyan/5 px-4 py-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-sm">📎</span>
            <span className="font-dm text-xs uppercase tracking-wider text-cyan">Linked goal</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <span className="font-sora text-sm font-semibold text-white truncate">{linkedGoal.goal_name}</span>
            {linkedGoalBudget != null && (
              <span className="font-dm text-xs text-soft flex-none">
                Budget <span className="font-sora font-semibold text-cyan tabular-nums">{fmtAmt(linkedGoalBudget)}</span>
              </span>
            )}
          </div>
          <p className="mt-1.5 font-dm text-[11px] text-muted leading-relaxed">
            This transfer will also record a Monthly Allocation to this goal (once per month).
          </p>
        </div>
      )}

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

      {/* ── Note ── */}
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
          <p className="font-dm text-sm text-red leading-relaxed">
            {formatTransferError(addTransfer.error?.message)}
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
