import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Goal {
  id:            string
  goal_name:     string
  target_amount: number | null
  target_date:   string | null
  sort_order:    number
}

export function useGoals() {
  return useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_goal')
        .select('id, goal_name, target_amount, target_date, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      return data as Goal[]
    },
    staleTime: 1000 * 60 * 5,
  })
}