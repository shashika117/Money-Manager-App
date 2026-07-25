// src/hooks/useHouseholdProfiles.ts
//

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/contexts/AuthContext'

export function useHouseholdProfiles() {
  return useQuery<UserProfile[]>({
    queryKey: ['household_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_color')
      if (error) throw error
      return (data ?? []) as UserProfile[]
    },
    staleTime: Infinity,   // display names essentially never change
  })
}



