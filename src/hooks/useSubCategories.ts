import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────
export interface SubCategory {
  id:                   string
  ex_sub_category:      string
  category:             string
  group_name:           string
  type:                 'Expense' | 'Income' | 'Transfer'
  rollover_enabled:     boolean
  sort_order:           number
  category_sort_order:  number
}

// ── Hook ──────────────────────────────────────────────────────────
export function useSubCategories() {
  return useQuery<SubCategory[]>({
    queryKey: ['sub_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_sub_category')
        .select('*')
        .eq('is_active', true)
        .order('category_sort_order', { ascending: true })
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data as SubCategory[]
    },
    staleTime: Infinity,   // dim_sub_category never changes at runtime
  })
}

// ── Derived helpers ────────────────────────────────────────────────

/** Unique Expense category names, sorted by category_sort_order. */
export function getExpenseCategories(rows: SubCategory[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const row of rows) {
    if (row.type === 'Expense' && !seen.has(row.category)) {
      seen.add(row.category)
      result.push(row.category)
    }
  }
  return result
}

/** Unique Income category names (= ex_sub_category for Income type). */
export function getIncomeCategories(rows: SubCategory[]): string[] {
  return rows
    .filter(r => r.type === 'Income')
    .map(r => r.category)
}

/**
 * Sub-categories for a specific Expense category, sorted by sort_order.
 * Returns empty array for "Sinking Funds" (no subcategory selection needed).
 */
export function getSubCategoriesForCategory(
  rows: SubCategory[],
  category: string
): SubCategory[] {
  if (category === 'Sinking Funds') return []
  return rows
    .filter(r => r.category === category && r.type === 'Expense')
    .sort((a, b) => a.sort_order - b.sort_order)
}

/**
 * For Income: the ex_sub_category equals the category name.
 * Looks up and returns the exact ex_sub_category string from the table.
 */
export function getIncomeSubCategory(
  rows: SubCategory[],
  category: string
): string {
  return rows.find(r => r.category === category && r.type === 'Income')
    ?.ex_sub_category ?? category
}