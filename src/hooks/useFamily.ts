    import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface Family {
  id:   string
  name: string
}

export function useFamily() {
  return useQuery<Family>({
    queryKey: ['family'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('families')
        .select('id, name')
        .single()

      if (error) throw error
      return data as Family
    },
    staleTime: Infinity,  // family record never changes — cache forever
  })
}