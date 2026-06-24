import { useQuery } from '@tanstack/react-query'
import { supabase }  from '@/lib/supabase'

export interface MonthlySummary {
  year:    number
  month:   number
  label:   string
  income:  number
  expense: number
  net:     number
}

export function useMonthlyCashflow(includeSinkingFunds: boolean) {
  return useQuery<MonthlySummary[]>({
    queryKey: ['monthly_cashflow', includeSinkingFunds],
    queryFn: async () => {
      // Server aggregates and returns ≤ ~360 rows regardless of history size.
      const { data, error } = await supabase.rpc('get_monthly_cashflow', {
        p_include_sinking_funds: includeSinkingFunds,
      })
      if (error) throw error

      return (data ?? []).map((v: any) => ({
        year:    Number(v.year),
        month:   Number(v.month),
        label:   new Date(Number(v.year), Number(v.month) - 1, 1)
          .toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        income:  Number(v.income),
        expense: Number(v.expense),
        net:     Number(v.net),
      }))
    },
    staleTime: 1000 * 60 * 5,
  })
}