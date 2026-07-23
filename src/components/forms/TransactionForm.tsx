// src/components/forms/TransactionForm.tsx

import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn, todayLocal } from '@/lib/utils'
import { AccountSelect } from '@/components/forms/AccountSelect'
import { Select } from '@/components/forms/Select'
import {
  useSubCategories,
  getExpenseCategories,
  getIncomeCategories,
  getSubCategoriesForCategory,
  getIncomeSubCategory,
} from '@/hooks/useSubCategories'
import { useAccounts }   from '@/hooks/useAccounts'
import { useGoals }      from '@/hooks/useGoals'
import {
  useAddExpense,
  useAddIncome,
} from '@/hooks/useTransactionMutations'
import {
  useUpdateTransaction,
  useUpdateSinkingFundExpense,
} from '@/hooks/useEditTransaction'
import type { EditingTransaction } from '@/components/forms/editTypes'

// ── Types ──────────────────────────────────────────────────────────
type TxnType = 'Expense' | 'Income'

export interface SharedTxnData {
  date: string
  account: string
  amount: string
  note: string
}

interface TransactionFormProps {
  initialType: TxnType
  sharedData:  SharedTxnData
  updateSharedData: (data: Partial<SharedTxnData>) => void
  onSuccess:   () => void
  onCancel?:   () => void
  /** Present when this form instance is editing an existing transaction. */
  editing?:    EditingTransaction
}

// ── Zod schema ─────────────────────────────────────────────────────
const schema = z
  .object({
    date:           z.string().min(1, 'Date is required'),
    type:           z.enum(['Expense', 'Income']),
    category:       z.string().min(1, 'Select a category'),
    subcategory:    z.string().optional(),
    goal_name:      z.string().optional(),
    master_account: z.string().min(1, 'Select an account'),
    amount:         z
      .string()
      .min(1, 'Enter an amount')
      .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, {
        message: 'Amount must be a positive number',
      }),
    note: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'Expense') {
      if (data.category !== 'Sinking Funds' && data.category !== '' && !data.subcategory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select a sub-category',
          path: ['subcategory'],
        })
      }
      if (data.category === 'Sinking Funds' && !data.goal_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select which goal to spend from',
          path: ['goal_name'],
        })
      }
    }
  })

type FormData = z.infer<typeof schema>

// ── Component ──────────────────────────────────────────────────────
export function TransactionForm({ initialType, sharedData, updateSharedData, onSuccess, onCancel, editing }: TransactionFormProps) {
  // Data
  const { data: subCats = [],  isLoading: scLoading  } = useSubCategories()
  const { data: accounts = [], isLoading: accLoading } = useAccounts()
  const { data: goals = [],    isLoading: gLoading   } = useGoals()

  // Mutations
  const addExpense = useAddExpense()
  const addIncome  = useAddIncome()
  const updateTxn  = useUpdateTransaction()
  const updateSink = useUpdateSinkingFundExpense()

  const isSubmitting =
    addExpense.isPending || addIncome.isPending || updateTxn.isPending || updateSink.isPending

  const [cleanupError, setCleanupError] = useState<string | null>(null)

  // Only prefill type-specific fields when this instance matches the
  // transaction's ORIGINAL type — if the user switched tabs to a
  // different type, that form starts blank like a normal Add.
  const prefillMatch = editing && editing.type === initialType ? editing.transaction : null

  // Form
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date:           sharedData.date,
      type:           initialType,
      category:       prefillMatch ? prefillMatch.category : '',
      subcategory:    prefillMatch && !prefillMatch.is_income && !prefillMatch.is_sinking_funds
                        ? prefillMatch.ex_sub_category
                        : '',
      goal_name:      prefillMatch ? (prefillMatch.goal ?? '') : '',
      master_account: sharedData.account,
      amount:         sharedData.amount,
      note:           sharedData.note,
    },
  })

  // Watch fields to propagate back to shared state
  useEffect(() => {
    const subscription = watch((value) => {
      updateSharedData({
        date: value.date || '',
        account: value.master_account || '',
        amount: value.amount || '',
        note: value.note || ''
      })
    })
    return () => subscription.unsubscribe()
  }, [watch, updateSharedData])

  const watchType          = watch('type')
  const watchCategory      = watch('category')

  // When type changes: reset category + subcategory + goal.
  // Skip the very first run — it fires on mount too, which would wipe
  // out the prefilled values above before the user ever sees them.
const prevType = useRef(watchType)
useEffect(() => {
  if (prevType.current !== watchType) {
    setValue('category',    '')
    setValue('subcategory', '')
    setValue('goal_name',   '')
  }
  prevType.current = watchType
}, [watchType, setValue])

// When category genuinely changes: reset subcategory + goal. Same guard.
const prevCategory = useRef(watchCategory)
useEffect(() => {
  if (prevCategory.current !== watchCategory) {
    setValue('subcategory', '')
    setValue('goal_name',   '')
  }
  prevCategory.current = watchCategory
}, [watchCategory, setValue])

  // Derived display state
  const isSinkingFunds   = watchType === 'Expense' && watchCategory === 'Sinking Funds'
  const showSubcategory  = watchType === 'Expense'
                           && watchCategory !== ''
                           && watchCategory !== 'Sinking Funds'
  const showGoalSelector = isSinkingFunds

  // True in-place update only when editing AND the type wasn't changed.
  const isSameTypeEdit = !!editing && editing.type === watchType

  // Category options based on type
  const categoryOptions = watchType === 'Expense'
    ? getExpenseCategories(subCats)
    : getIncomeCategories(subCats)

  // Subcategory options for selected category
  const subcategoryOptions = getSubCategoriesForCategory(subCats, watchCategory)

  // ── Submit ────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    const amount = parseFloat(data.amount)
    setCleanupError(null)

    try {
      if (isSameTypeEdit) {
        // True in-place update — same type, just update the existing row(s).
        if (data.type === 'Expense' && isSinkingFunds) {
          await updateSink.mutateAsync({
            transaction_id: editing!.transaction.id,
            date:           data.date,
            account:        data.master_account,
            goal_name:      data.goal_name!,
            amount,
            note:           data.note,
          })
        } else if (data.type === 'Expense') {
          await updateTxn.mutateAsync({
            id:              editing!.transaction.id,
            date:            data.date,
            master_account:  data.master_account,
            ex_sub_category: data.subcategory!,
            singed_amount:   -amount,
            note:            data.note,
          })
        } else {
          const exSubCat = getIncomeSubCategory(subCats, data.category)
          await updateTxn.mutateAsync({
            id:              editing!.transaction.id,
            date:            data.date,
            master_account:  data.master_account,
            ex_sub_category: exSubCat,
            singed_amount:   amount,
            note:            data.note,
          })
        }
      } else {
        // Fresh add — either a brand-new transaction, or an edit where the
        // type was changed. The original (if any) is removed below, only
        // after this save succeeds.
        if (data.type === 'Expense') {
          await addExpense.mutateAsync({
            date:            data.date,
            master_account:  data.master_account,
            ex_sub_category: isSinkingFunds ? 'Sinking Funds' : data.subcategory!,
            amount,
            note:            data.note ?? '',
            isSinkingFunds,
            goal_name:       data.goal_name,
          })
        } else {
          const exSubCat = getIncomeSubCategory(subCats, data.category)
          await addIncome.mutateAsync({
            date:            data.date,
            master_account:  data.master_account,
            ex_sub_category: exSubCat,
            amount,
            note:            data.note ?? '',
          })
        }

        if (editing) {
          try {
            await editing.deleteOriginal()
          } catch (cleanupErr) {
            console.error('Failed to remove original record after edit:', cleanupErr)
            setCleanupError(
              'Saved, but the original transaction could not be removed automatically. Please delete it manually from the transaction list to avoid a duplicate.'
            )
            return
          }
        }
      }

      reset({ date: todayLocal(), type: data.type })
      onSuccess()
    } catch (err) {
      console.error('Transaction save failed:', err)
    }
  }

  // ── Loading state ──────────────────────────────────────────────
  const dataLoading = scLoading || accLoading || gLoading
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green border-t-transparent" />
      </div>
    )
  }

  // ── Colours tied to type ───────────────────────────────────────
  const typeColor   = watchType === 'Expense' ? 'red' : 'green'
  const submitBg    = watchType === 'Expense' ? 'bg-red' : 'bg-green'

  // ── Render ─────────────────────────────────────────────────────
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
            'font-dm text-sm text-white outline-none transition-colors',
            'focus:border-green',
            errors.date ? 'border-red' : 'border-line',
          )}
        />
        {errors.date && (
          <p className="mt-1 font-dm text-xs text-red">{errors.date.message}</p>
        )}
      </div>

      {/* ── Type toggle (hidden) ── */}
      <input type="hidden" {...register('type')} />

      {/* ── Category ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Category
        </label>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select
              options={categoryOptions.map(cat => ({ value: cat, label: cat }))}
              value={field.value}
              onChange={field.onChange}
              placeholder="Select category…"
              error={!!errors.category}
              focusColorClass="focus:border-green"
            />
          )}
        />
        {errors.category && (
          <p className="mt-1 font-dm text-xs text-red">{errors.category.message}</p>
        )}
      </div>

      {/* ── Sub-Category ── */}
      {showSubcategory && (
        <div className="animate-fade-in"> 
          <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
            Sub-Category
          </label>
          <Controller
            name="subcategory"
            control={control}
            render={({ field }) => (
              <Select
                options={subcategoryOptions.map(sc => ({ value: sc.ex_sub_category, label: sc.ex_sub_category }))}
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder="Select sub-category…"
                error={!!errors.subcategory}
                focusColorClass="focus:border-green"
              />
            )}
          />
          {errors.subcategory && (
            <p className="mt-1 font-dm text-xs text-red">{errors.subcategory.message}</p>
          )}
        </div>
      )}

      {/* ── Goal selector ── */}
      {showGoalSelector && (
        <div className="animate-fade-in"> 
          <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
            Spend from Goal
          </label>
          <Controller
            name="goal_name"
            control={control}
            render={({ field }) => (
              <Select
                options={goals.map(g => ({ value: g.goal_name, label: g.goal_name }))}
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder="Which goal are you spending from?"
                error={!!errors.goal_name}
                focusColorClass="focus:border-amber"
              />
            )}
          />
          {errors.goal_name && (
            <p className="mt-1 font-dm text-xs text-red">{errors.goal_name.message}</p>
          )}
          <p className="mt-1.5 font-dm text-xs text-soft">
            This will also deduct from the goal's savings balance.
          </p>
        </div>
      )}

      {/* ── Account ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Account
        </label>
        <Controller
          name="master_account"
          control={control}
          render={({ field }) => (
            <AccountSelect
              accounts={accounts}
              value={field.value}
              onChange={field.onChange}
              placeholder="Select account…"
              error={!!errors.master_account}
              focusColorClass="focus:border-green"
            />
          )}
        />
        {errors.master_account && (
          <p className="mt-1 font-dm text-xs text-red">{errors.master_account.message}</p>
        )}
      </div>

      {/* ── Amount ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Amount (Rs)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-dm text-sm text-soft">
            {watchType === 'Expense' ? '−' : '+'}
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register('amount')}
            className={cn(
              'w-full rounded-xl border bg-panel py-3 pl-8 pr-4',
              'font-sora text-base text-white outline-none transition-colors',
              `focus:border-${typeColor}`,
              errors.amount ? 'border-red' : 'border-line',
            )}
          />
        </div>
        {errors.amount && (
          <p className="mt-1 font-dm text-xs text-red">{errors.amount.message}</p>
        )}
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
      {(addExpense.isError || addIncome.isError || updateTxn.isError || updateSink.isError) && (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
          <p className="font-dm text-sm text-red">
            {(addExpense.error || addIncome.error || updateTxn.error || updateSink.error)?.message
              ?? 'Something went wrong. Try again.'}
          </p>
        </div>
      )}

      {/* ── Cleanup warning (type-changed edit: saved, old row not removed) ── */}
      {cleanupError && (
        <div className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3">
          <p className="font-dm text-sm text-amber leading-relaxed">{cleanupError}</p>
        </div>
      )}

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'mt-2 w-full rounded-xl py-4',
          'font-sora text-sm font-semibold text-white',
          'transition-all active:scale-[0.98]',
          submitBg,
          isSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90',
        )}
      >
        {isSubmitting
          ? 'Saving…'
          : isSameTypeEdit ? `Update ${watchType}` : `Save ${watchType}`}
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