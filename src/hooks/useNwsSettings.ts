import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase }  from '@/lib/supabase'
 
export interface NwsSettings {
  needs_base: number
  wants_base: number
  save_base:  number
}
 
export function useNwsSettings() {
  return useQuery<NwsSettings>({
    queryKey: ['nws_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('needs_base, wants_base, save_base')
        .eq('id', 1)
        .single()
      if (error) throw error
      return {
        needs_base: Number(data.needs_base),
        wants_base: Number(data.wants_base),
        save_base:  Number(data.save_base),
      }
    },
    staleTime: 1000 * 60 * 10,   // rarely changes
  })
}
 
/** Saves new NWS base values. save_base is derived server-side. */
export function useUpdateNwsBase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { needs: number; wants: number }) => {
      const { error } = await supabase.rpc('update_nws_base', {
        p_needs: p.needs,
        p_wants: p.wants,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nws_settings'] })
      // NWS scores in every month's summary depend on these bases
      qc.invalidateQueries({ queryKey: ['budget_summary'] })
    },
  })
}