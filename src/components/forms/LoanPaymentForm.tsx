import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn, todayLocal } from '@/lib/utils'
import { useAccounts } from '@/hooks/useAccounts'
import { useAddLoanPayment } from '@/hooks/useLoanPaymentMutations'

interface LoanPaymentFormProps {
  onSuccess:       () => void
  initialDate?:    string
  initialAccount?: string   // pre-fills the paying (from) account
  onCancel?:       () => void
}

// ── Zod schema ─────────────────────────────────────────────────────
const schema = z
  .object({
    date:             z.string().min(1, 'Date is required'),
    from_account:     z.string().min(1, 'Select the paying account'),
    loan_account:     z.string().min(1, 'Select the loan account'),
    capital_amount:   z
      .string()
      .min(1, 'Enter the capital amount')
      .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
        message: 'Capital amount must be greater than 0',
      }),
    interest_amount:  z
      .string()
      .optional()
      .refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), {
        message: 'Interest amount cannot be negative',
      }),
    note: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.from_account && data.loan_account && data.from_account === data.loan_account) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Paying account and loan account must be different',
        path: ['loan_account'],
      })
    }
  })

type FormData = z.infer<typeof schema>

// ── Component ──────────────────────────────────────────────────────
export function LoanPaymentForm({ onSuccess, initialDate, initialAccount, onCancel }: LoanPaymentFormProps) {
  const { data: accounts = [], isLoading: accLoading } = useAccounts()
  const addLoanPayment = useAddLoanPayment()

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date:            initialDate ?? todayLocal(),
      from_account:    initialAccount ?? '',
      loan_account:    '',
      capital_amount:  '',
      interest_amount: '',
      note:            '',
    },
  })

  const watchFromAccount = watch('from_account')
  const watchCapital     = watch('capital_amount')
  const watchInterest    = watch('interest_amount')

  const capitalNum  = parseFloat(watchCapital)  || 0
  const interestNum = parseFloat(watchInterest || '0') || 0
  const totalEmi     = capitalNum + interestNum

  // ── Submit ────────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    try {
      await addLoanPayment.mutateAsync({
        date:            data.date,
        from_account:    data.from_account,
        loan_account:    data.loan_account,
        capital_amount:  parseFloat(data.capital_amount),
        interest_amount: data.interest_amount ? parseFloat(data.interest_amount) : 0,
        note:            data.note ?? '',
      })

      reset({ date: todayLocal() })
      onSuccess()
    } catch (err) {
      console.error('Loan payment save failed:', err)
    }
  }

  if (accLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber border-t-transparent" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 pb-2">

      {/* ── Info strip ── */}
      <div className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3">
        <p className="font-dm text-xs text-amber leading-relaxed">
          Records the whole EMI. Capital and interest both count as Needs in
          your budget; the loan's liability balance drops by the capital amount.
        </p>
      </div>

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
            'font-dm text-sm text-white outline-none transition-colors focus:border-amber',
            errors.date ? 'border-red' : 'border-line',
          )}
        />
        {errors.date && (
          <p className="mt-1 font-dm text-xs text-red">{errors.date.message}</p>
        )}
      </div>

      {/* ── Paying account ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          From Account
        </label>
        <div className="relative">
          <select
            {...register('from_account')}
            className={cn(
              'w-full appearance-none rounded-xl border bg-panel px-4 py-3',
              'font-dm text-sm text-white outline-none transition-colors focus:border-amber',
              errors.from_account ? 'border-red' : 'border-line',
            )}
          >
            <option value="" disabled>Select paying account…</option>
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

      {/* ── Loan account ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Loan Account
        </label>
        <div className="relative">
          <select
            {...register('loan_account')}
            className={cn(
              'w-full appearance-none rounded-xl border bg-panel px-4 py-3',
              'font-dm text-sm text-white outline-none transition-colors focus:border-amber',
              errors.loan_account ? 'border-red' : 'border-line',
            )}
          >
            <option value="" disabled>Select loan account…</option>
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
        {errors.loan_account && (
          <p className="mt-1 font-dm text-xs text-red">{errors.loan_account.message}</p>
        )}
      </div>

      {/* ── Capital amount ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Capital Amount (Rs)
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register('capital_amount')}
          className={cn(
            'w-full rounded-xl border bg-panel px-4 py-3',
            'font-sora text-base text-white outline-none transition-colors focus:border-amber',
            errors.capital_amount ? 'border-red' : 'border-line',
          )}
        />
        {errors.capital_amount && (
          <p className="mt-1 font-dm text-xs text-red">{errors.capital_amount.message}</p>
        )}
      </div>

      {/* ── Interest amount ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Interest Amount (Rs){' '}
          <span className="normal-case text-muted">(optional — 0 if none this month)</span>
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register('interest_amount')}
          className={cn(
            'w-full rounded-xl border border-line bg-panel px-4 py-3',
            'font-dm text-sm text-white placeholder:text-muted',
            'outline-none transition-colors focus:border-amber',
          )}
        />
        {errors.interest_amount && (
          <p className="mt-1 font-dm text-xs text-red">{errors.interest_amount.message}</p>
        )}
      </div>

      {/* ── EMI total preview ── */}
      {totalEmi > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-line bg-navy/40 px-4 py-3">
          <span className="font-dm text-xs text-soft">Total EMI this payment</span>
          <span className="font-sora text-base font-bold text-white">
            {totalEmi.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

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
            'outline-none transition-colors focus:border-amber',
          )}
        />
      </div>

      {/* ── Server error ── */}
      {addLoanPayment.isError && (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
          <p className="font-dm text-sm text-red">
            {addLoanPayment.error?.message ?? 'Loan payment failed. Try again.'}
          </p>
        </div>
      )}

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={addLoanPayment.isPending}
        className={cn(
          'mt-2 w-full rounded-xl bg-amber py-4',
          'font-sora text-sm font-semibold text-white',
          'transition-all active:scale-[0.98]',
          addLoanPayment.isPending ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90',
        )}
      >
        {addLoanPayment.isPending ? 'Saving…' : 'Save Loan Payment'}
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
