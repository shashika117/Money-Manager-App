import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/hooks/useTransactions'
import {
  useSubCategories,
  getExpenseCategories,
  getSubCategoriesForCategory,
} from '@/hooks/useSubCategories'
import { useAccounts } from '@/hooks/useAccounts'
import { useGoals } from '@/hooks/useGoals'
import {
  useUpdateTransaction,
  useUpdateSinkingFundExpense,
} from '@/hooks/useEditTransaction'

// ── Schema factory ──────────────────────────────────────────────────
function createSchema(isIncome: boolean, isSinkingFunds: boolean) {
  return z
    .object({
      date:           z.string().min(1, 'Date is required'),
      category:       z.string().min(1, 'Select a category'),
      subcategory:    z.string().optional(),
      goal_name:      z.string().optional(),
      master_account: z.string().min(1, 'Select an account'),
      amount: z
        .string()
        .min(1, 'Enter an amount')
        .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, {
          message: 'Amount must be a positive number',
        }),
      note: z.string().optional(),
    })
    .superRefine((d, ctx) => {
      // Only require subcategory for regular Expense transactions
      if (!isIncome && d.category !== 'Sinking Funds' && d.category !== '' && !d.subcategory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select a sub-category',
          path: ['subcategory'],
        })
      }
      // Require goal for Sinking Funds
      if ((isSinkingFunds || d.category === 'Sinking Funds') && !d.goal_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select a goal',
          path: ['goal_name'],
        })
      }
    })
}

type FormData = z.infer<ReturnType<typeof createSchema>>

interface Props {
  transaction: Transaction
  onSuccess:   () => void
  onCancel:    () => void
}

export function EditTransactionForm({ transaction, onSuccess, onCancel }: Props) {
  const isIncome       = transaction.is_income
  const isSinkingFunds = transaction.is_sinking_funds

  // Memoize schema
  const schema = useMemo(
    () => createSchema(isIncome, isSinkingFunds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const { data: subCats  = [] } = useSubCategories()
  const { data: accounts = [] } = useAccounts()
  const { data: goals    = [] } = useGoals()

  const updateTxn  = useUpdateTransaction()
  const updateSink = useUpdateSinkingFundExpense()
  const isSubmitting = updateTxn.isPending || updateSink.isPending

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date:           transaction.date,
      category:       transaction.category,
      subcategory:    isSinkingFunds || isIncome ? '' : transaction.ex_sub_category,
      goal_name:      transaction.goal ?? '',
      master_account: transaction.master_account,
      amount:         String(Math.abs(transaction.singed_amount)),
      note:           transaction.note ?? '',
    },
  })

  // Retained for managing the derived UI visibility rules below
  const watchCategory = watch('category')

  // ── Derived display state ────────────────────────────────────────
  const isSinkingFundsSelected = watchCategory === 'Sinking Funds'
  const showSubcategory  = !isIncome && !isSinkingFundsSelected
  const showGoalSelector = isSinkingFunds || isSinkingFundsSelected

  const catOptions      = isIncome ? [transaction.category] : getExpenseCategories(subCats)
  const subcatOptions   = getSubCategoriesForCategory(subCats, watchCategory)

  const typeColor = isIncome ? 'green' : 'red'
  const submitBg  = isIncome ? 'bg-green' : 'bg-red'

  // ── Submit ───────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    const amt = parseFloat(data.amount)
    try {
      if (isSinkingFundsSelected || isSinkingFunds) {
        await updateSink.mutateAsync({
          transaction_id: transaction.id,
          date:           data.date,
          account:        data.master_account,
          goal_name:      data.goal_name!,
          amount:         amt,
          note:           data.note,
        })
      } else {
        const signed = isIncome ? amt : -amt
        const exSubCat = isIncome
          ? data.category
          : (data.subcategory ?? data.category)

        await updateTxn.mutateAsync({
          id:              transaction.id,
          date:            data.date,
          master_account:  data.master_account,
          ex_sub_category: exSubCat,
          singed_amount:   signed,
          note:            data.note,
        })
      }
      onSuccess()
    } catch (err) {
      console.error('Edit failed:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 pb-2">

      {/* Type indicator (locked, not editable) */}
      <div className={cn(
        'flex items-center gap-2 rounded-xl px-4 py-2.5 border',
        isIncome ? 'border-green/30 bg-green/10' : 'border-red/30 bg-red/10',
      )}>
        <span className={cn(
          'font-dm text-xs uppercase tracking-wider font-medium', `text-${typeColor}`
        )}>
          Editing
        </span>
        <span className={cn('font-sora text-sm font-semibold', `text-${typeColor}`)}>
          {isIncome ? 'Income' : isSinkingFunds ? 'Sinking Funds Expense' : 'Expense'}
        </span>
      </div>

      {/* Date */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Date
        </label>
        <input
          type="date"
          {...register('date')}
          className={cn(
            'w-full appearance-none rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white outline-none transition-colors focus:border-green',
            errors.date ? 'border-red' : 'border-line',
          )}
        />
      </div>

      {/* Category */}
      {!isIncome && (
        <div>
          <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
            Category
          </label>
          <div className="relative">
            <select
              {...register('category', {
                onChange: () => {
                  // Only triggers when the user actively interacts with the select layout dropdown
                  setValue('subcategory', '')
                  setValue('goal_name', '')
                },
              })}
              className={cn(
                'w-full appearance-none rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white outline-none transition-colors focus:border-green',
                errors.category ? 'border-red' : 'border-line',
              )}
            >
              {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
          </div>
          {errors.category && (
            <p className="mt-1 font-dm text-xs text-red">{errors.category.message}</p>
          )}
        </div>
      )}

      {/* Subcategory */}
      {showSubcategory && (
        <div className="animate-fade-in">
          <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
            Sub-Category
          </label>
          <div className="relative">
            <select
              {...register('subcategory')}
              className={cn(
                'w-full appearance-none rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white outline-none transition-colors focus:border-green',
                errors.subcategory ? 'border-red' : 'border-line',
              )}
            >
              <option value="" disabled>Select sub-category…</option>
              {subcatOptions.map(sc => (
                <option key={sc.id} value={sc.ex_sub_category}>{sc.ex_sub_category}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
          </div>
          {errors.subcategory && (
            <p className="mt-1 font-dm text-xs text-red">{errors.subcategory.message}</p>
          )}
        </div>
      )}

      {/* Goal */}
      {showGoalSelector && (
        <div className="animate-fade-in">
          <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
            Goal
          </label>
          <div className="relative">
            <select
              {...register('goal_name')}
              className={cn(
                'w-full appearance-none rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white outline-none transition-colors focus:border-amber',
                errors.goal_name ? 'border-red' : 'border-line',
              )}
            >
              <option value="" disabled>Select goal…</option>
              {goals.map(g => <option key={g.id} value={g.goal_name}>{g.goal_name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
          </div>
          {errors.goal_name && (
            <p className="mt-1 font-dm text-xs text-red">{errors.goal_name.message}</p>
          )}
        </div>
      )}

      {/* Account */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Account
        </label>
        <div className="relative">
          <select
            {...register('master_account')}
            className={cn(
              'w-full appearance-none rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white outline-none transition-colors focus:border-green',
              errors.master_account ? 'border-red' : 'border-line',
            )}
          >
            {accounts.map(a => (
              <option key={a.id} value={a.master_account}>{a.master_account}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">▼</span>
        </div>
        {errors.master_account && (
          <p className="mt-1 font-dm text-xs text-red">{errors.master_account.message}</p>
        )}
      </div>

      {/* Amount */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Amount (Rs)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-dm text-sm text-soft">
            {isIncome ? '+' : '−'}
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register('amount')}
            className={cn(
              'w-full rounded-xl border bg-panel py-3 pl-8 pr-4 font-sora text-base text-white outline-none transition-colors',
              `focus:border-${typeColor}`,
              errors.amount ? 'border-red' : 'border-line',
            )}
          />
        </div>
        {errors.amount && (
          <p className="mt-1 font-dm text-xs text-red">{errors.amount.message}</p>
        )}
      </div>

      {/* Note */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Note <span className="normal-case text-muted">(optional)</span>
        </label>
          {/* AFTER */}
        <textarea
         placeholder="Add a note…"
          {...register('note')}
          className="note-field w-full rounded-xl border border-line bg-panel px-4 py-3 font-dm text-sm text-white placeholder:text-muted outline-none transition-colors focus:border-green"
        />
      </div>

      {(updateTxn.isError || updateSink.isError) && (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
          <p className="font-dm text-sm text-red">Update failed. Try again.</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'mt-2 w-full rounded-xl py-4 font-sora text-sm font-semibold text-white',
          'transition-all active:scale-[0.98]',
          submitBg,
          isSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90',
        )}
      >
        {isSubmitting ? 'Saving…' : 'Save Changes'}
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-xl border border-line py-3 font-dm text-sm text-soft hover:text-white"
      >
        Cancel Edit
      </button>
    </form>
  )
}