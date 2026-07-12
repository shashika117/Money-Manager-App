import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn, todayLocal } from '@/lib/utils'
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

// ── Types ──────────────────────────────────────────────────────────
type TxnType = 'Expense' | 'Income'

interface TransactionFormProps {
  initialType: TxnType
  initialDate?: string    // NEW — pre-fills the date field
  initialAccount?: string
  onSuccess:   () => void
  onCancel?:    () => void    // ← add this
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
      .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
        message: 'Amount must be a positive number',
      }),
    note: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'Expense') {
      // Regular expense: subcategory required
      if (data.category !== 'Sinking Funds' && data.category !== '' && !data.subcategory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select a sub-category',
          path: ['subcategory'],
        })
      }
      // Sinking Funds: goal_name required
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
export function TransactionForm({ initialType, initialDate, initialAccount, onSuccess, onCancel }: TransactionFormProps) {
  // Data
  const { data: subCats = [],  isLoading: scLoading  } = useSubCategories()
  const { data: accounts = [], isLoading: accLoading } = useAccounts()
  const { data: goals = [],    isLoading: gLoading   } = useGoals()

  // Mutations
  const addExpense = useAddExpense()
  const addIncome  = useAddIncome()

  const isSubmitting = addExpense.isPending || addIncome.isPending

  // Form
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date:          initialDate ?? todayLocal(), // Changed from todayString()
      type:           initialType,
      category:       '',
      subcategory:    '',
      goal_name:      '',
      master_account:  initialAccount ?? '',
      amount:         '',
      note:           '',
    },
  })

  const watchType          = watch('type')
  const watchCategory      = watch('category')
  const watchSubcategory   = watch('subcategory')
  const watchGoalName      = watch('goal_name')
  const watchMasterAccount = watch('master_account')

  // When type changes: reset category + subcategory + goal
   useEffect(() => {
    setValue('category',    '')
    setValue('subcategory', '')
    setValue('goal_name',   '')
  }, [watchType, setValue]) 


  // When category changes: reset subcategory + goal
  useEffect(() => {
    setValue('subcategory', '')
    setValue('goal_name',   '')
  }, [watchCategory, setValue])

  // Derived display state
  const isSinkingFunds   = watchType === 'Expense' && watchCategory === 'Sinking Funds'
  const showSubcategory  = watchType === 'Expense'
                           && watchCategory !== ''
                           && watchCategory !== 'Sinking Funds'
  const showGoalSelector = isSinkingFunds

  // Category options based on type
  const categoryOptions = watchType === 'Expense'
    ? getExpenseCategories(subCats)
    : getIncomeCategories(subCats)

  // Subcategory options for selected category
  const subcategoryOptions = getSubCategoriesForCategory(subCats, watchCategory)

  // ── Submit ────────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    const amount = parseFloat(data.amount)

    try {
      if (data.type === 'Expense') {
        await addExpense.mutateAsync({
          date:            data.date,
          master_account:  data.master_account,
          ex_sub_category: isSinkingFunds
            ? 'Sinking Funds'
            : data.subcategory!,
          amount,
          note:            data.note ?? '',
          isSinkingFunds,
          goal_name:       data.goal_name,
        })
      } else {
        // Income: ex_sub_category = the Income category name
        const exSubCat = getIncomeSubCategory(subCats, data.category)
        await addIncome.mutateAsync({
          date:            data.date,
          master_account:  data.master_account,
          ex_sub_category: exSubCat,
          amount,
          note:            data.note ?? '',
        })
      }

      reset({ date: todayLocal(), type: data.type }) // Changed from todayString()
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

      {/* ── Type toggle (hidden — controlled by parent) ── */}
      {/* type is passed in as initialType and stored in the form */}
      <input type="hidden" {...register('type')} />

      {/* ── Category ── */}
      <div>
        <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
          Category
        </label>
        <div className="relative">
          <select
            {...register('category')}
            className={cn(
              'w-full appearance-none rounded-xl border bg-panel px-4 py-3',
              'font-dm text-sm outline-none transition-colors',
              !watchCategory ? 'text-soft' : 'text-white',
              'focus:border-green',
              errors.category ? 'border-red' : 'border-line',
            )}
          >
            <option value="" disabled className="text-soft bg-panel">Select category…</option>
            {categoryOptions.map(cat => (
              <option key={cat} value={cat} className="text-white bg-panel">{cat}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">
            ▼
          </span>
        </div>
        {errors.category && (
          <p className="mt-1 font-dm text-xs text-red">{errors.category.message}</p>
        )}
      </div>

      {/* ── Sub-Category (Expense only, not for Sinking Funds) ── */}
      {showSubcategory && (
        <div className="animate-fade-in"> 
          <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
            Sub-Category
          </label>
          <div className="relative">
            <select
              {...register('subcategory')}
              className={cn(
                'w-full appearance-none rounded-xl border bg-panel px-4 py-3',
                'font-dm text-sm outline-none transition-colors',
                !watchSubcategory ? 'text-soft' : 'text-white',
                'focus:border-green',
                errors.subcategory ? 'border-red' : 'border-line',
              )}
            >
              <option value="" disabled className="text-soft bg-panel">Select sub-category…</option>
              {subcategoryOptions.map(sc => (
                <option key={sc.id} value={sc.ex_sub_category} className="text-white bg-panel">
                  {sc.ex_sub_category}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">
              ▼
            </span>
          </div>
          {errors.subcategory && (
            <p className="mt-1 font-dm text-xs text-red">{errors.subcategory.message}</p>
          )}
        </div>
      )}

      {/* ── Goal selector (Sinking Funds expense only) ── */}
      {showGoalSelector && (
        <div className="animate-fade-in"> 
          <label className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft">
            Spend from Goal
          </label>
          <div className="relative">
            <select
              {...register('goal_name')}
              className={cn(
                'w-full appearance-none rounded-xl border bg-panel px-4 py-3',
                'font-dm text-sm outline-none transition-colors',
                !watchGoalName ? 'text-soft' : 'text-white',
                'focus:border-amber',
                errors.goal_name ? 'border-red' : 'border-line',
              )}
            >
              <option value="" disabled className="text-soft bg-panel">Which goal are you spending from?</option>
              {goals.map(g => (
                <option key={g.id} value={g.goal_name} className="text-white bg-panel">
                  {g.goal_name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">
              ▼
            </span>
          </div>
          {errors.goal_name && (
            <p className="mt-1 font-dm text-xs text-red">{errors.goal_name.message}</p>
          )}
          {/* Contextual reminder */}
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
        <div className="relative">
          <select
            {...register('master_account')}
            className={cn(
              'w-full appearance-none rounded-xl border bg-panel px-4 py-3',
              'font-dm text-sm outline-none transition-colors',
              !watchMasterAccount ? 'text-soft' : 'text-white',
              'focus:border-green',
              errors.master_account ? 'border-red' : 'border-line',
            )}
          >
            <option value="" disabled className="text-soft bg-panel">Select account…</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.master_account} className="text-white bg-panel">
                {acc.master_account}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-soft text-xs">
            ▼
          </span>
        </div>
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
      {(addExpense.isError || addIncome.isError) && (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
          <p className="font-dm text-sm text-red">
            {(addExpense.error || addIncome.error)?.message ?? 'Something went wrong. Try again.'}
          </p>
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
          : `Save ${watchType}`}
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