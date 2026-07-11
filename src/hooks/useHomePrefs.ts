// src/hooks/useHomePrefs.ts
//
// Household-shared Home page preferences (singleton row, id = 1).
//   • which accounts show in the Account Balances card
//   • which subcategories occupy the Budget Details top-6 rows
//     (tracked separately per rollover population)
//
// `undefined` means NOT CONFIGURED YET → the card applies its default.
// `[]` means the user deliberately unticked everything → respected as-is.
// That distinction matters, so don't collapse them with `?? []`.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface HomePrefs {
  accounts?:             string[]
  subcats_rollover_on?:  string[]
  subcats_rollover_off?: string[]
}

export type HomePrefKey = keyof HomePrefs

const KEY = ['home_prefs']

export function useHomePrefs() {
  return useQuery<HomePrefs>({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('home_prefs')
        .select('prefs')
        .eq('id', 1)
        .single()
      if (error) throw error
      return ((data as { prefs: HomePrefs } | null)?.prefs ?? {}) as HomePrefs
    },
    staleTime: 1000 * 60,
  })
}

// Updates ONE key server-side (jsonb merge), so a concurrent edit to a
// different card from another device can't be clobbered.
export function useSetHomePref() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ key, value }: { key: HomePrefKey; value: string[] }) => {
      const { data, error } = await supabase.rpc('set_home_pref', {
        p_key:   key,
        p_value: value as unknown as never,   // jsonb param
      })
      if (error) throw error
      return (data ?? {}) as HomePrefs
    },

    // Optimistic: the checkbox should tick instantly.
    onMutate: async ({ key, value }) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<HomePrefs>(KEY)
      qc.setQueryData<HomePrefs>(KEY, old => ({ ...(old ?? {}), [key]: value }))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}