//src\hooks\useAccounts.ts

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Account {
  id:               string
  master_account:   string
  account_category: string
  account_group:    'Assets' | 'Liability'
  sort_order:       number
  owner_id:         string | null
}

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dim_account')
        .select('id, master_account, account_category, account_group, sort_order, owner_id')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('master_account', { ascending: true })

      if (error) throw error
      return data as Account[]
    },
    staleTime: Infinity,
  })
}