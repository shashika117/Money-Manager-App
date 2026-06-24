import { useQuery } from '@tanstack/react-query'
import { supabase }  from '@/lib/supabase'
 
export type BudgetSection = 'Income' | 'Expense' | 'Savings'
 
export interface BudgetRow {
  section:          BudgetSection
  ex_sub_category:  string        // subcat name, or goal name for Savings
  category:         string
  group_name:       string        // 'Needs' | 'Wants' | 'Income' | 'Savings' | ...
  category_sort:    number
  sort_order:       number
  rollover_enabled: boolean
  budget:           number
  actual:           number        // raw sign for Savings; magnitude for Expense; signed for Income
  rollover_amount:  number
  effective_budget: number
  remaining:        number
  template_budget:  number | null
}
 
/** month is a 'YYYY-MM-01' string. */
export function useBudgetTable(month: string) {
  return useQuery<BudgetRow[]>({
    queryKey: ['budget_table', month],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_budget_table', {
        p_selected_month: month,
      })
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        section:          r.section,
        ex_sub_category:  r.ex_sub_category,
        category:         r.category,
        group_name:       r.group_name,
        category_sort:    Number(r.category_sort),
        sort_order:       Number(r.sort_order),
        rollover_enabled: !!r.rollover_enabled,
        budget:           Number(r.budget),
        actual:           Number(r.actual),
        rollover_amount:  Number(r.rollover_amount),
        effective_budget: Number(r.effective_budget),
        remaining:        Number(r.remaining),
        template_budget:  r.template_budget == null ? null : Number(r.template_budget),
      }))
    },
    staleTime: 1000 * 30,
  })
}
 
// ── Grouping helpers ──────────────────────────────────────────────
export interface CategoryGroup {
  key:        string          // category name (Expense) or section name
  label:      string
  rows:       BudgetRow[]
  budget:     number
  actual:     number
  remaining:  number
}
 
/** Group expense rows into their category boxes; income & savings each
 *  become a single group. Totals are summed from the child rows. */
export function groupBudgetRows(rows: BudgetRow[], section: BudgetSection): CategoryGroup[] {
  const sectionRows = rows.filter(r => r.section === section)
 
  if (section === 'Expense') {
    // One group per category
    const map = new Map<string, BudgetRow[]>()
    for (const r of sectionRows) {
      if (!map.has(r.category)) map.set(r.category, [])
      map.get(r.category)!.push(r)
    }
    return Array.from(map.entries()).map(([cat, rs]) => ({
      key:       cat,
      label:     cat,
      rows:      rs,
      budget:    rs.reduce((s, r) => s + r.budget, 0),
      actual:    rs.reduce((s, r) => s + r.actual, 0),
      remaining: rs.reduce((s, r) => s + r.remaining, 0),
    }))
  }
 
  // Income / Savings → single group
  const label = section === 'Income' ? 'Income Total' : 'Savings Total'
  return [{
    key:       section,
    label,
    rows:      sectionRows,
    budget:    sectionRows.reduce((s, r) => s + r.budget, 0),
    actual:    sectionRows.reduce((s, r) => s + r.actual, 0),
    remaining: sectionRows.reduce((s, r) => s + r.remaining, 0),
  }]
}
 
/** "Show all" OFF → hide rows that have no budget AND no actual. */
export function filterEmptyRows(rows: BudgetRow[], showAll: boolean): BudgetRow[] {
  if (showAll) return rows
  return rows.filter(r => r.budget !== 0 || r.actual !== 0)
}