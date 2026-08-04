// src/hooks/useHomePrefs.ts
//
// Per-user Home page picker preferences. Each household member has
// their own row in home_prefs, keyed by user_id — so "which accounts
// show on my Home page" is personal, even though the underlying data
// (the account list itself) stays shared across the household.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface HomePrefs {
  accounts?:             string[]
  subcats_rollover_on?:  string[]
  subcats_rollover_off?: string[]
}

export type HomePrefKey = keyof HomePrefs

function homePrefsKey(userId: string | null) {
  return ['home_prefs', userId] as const
}

export function useHomePrefs() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  return useQuery<HomePrefs>({
    queryKey: homePrefsKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('home_prefs')
        .select('prefs')
        .eq('user_id', userId as string)
        .maybeSingle()   // no row yet for this user (first-ever visit) → null, not an error
      if (error) throw error
      return ((data as { prefs: HomePrefs } | null)?.prefs ?? {}) as HomePrefs
    },
    enabled: !!userId,
    staleTime: 1000 * 60,
  })
}

// Updates ONE key server-side (jsonb merge) for the CURRENT user's row,
// so a concurrent edit to a different card — by the same person on
// another device, or by their partner on their own separate row — can't
// clobber it.
export function useSetHomePref() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const userId = user?.id ?? null
  const key = homePrefsKey(userId)

  return useMutation({
    mutationFn: async ({ key: prefKey, value }: { key: HomePrefKey; value: string[] }) => {
      if (!userId) throw new Error('Not authenticated')
      const { data, error } = await supabase.rpc('set_home_pref', {
        p_key:     prefKey,
        p_value:   value as unknown as never,   // jsonb param
        p_user_id: userId,
      })
      if (error) throw error
      return (data ?? {}) as HomePrefs
    },

    // Optimistic: the checkbox should tick instantly.
    onMutate: async ({ key: prefKey, value }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<HomePrefs>(key)
      qc.setQueryData<HomePrefs>(key, old => ({ ...(old ?? {}), [prefKey]: value }))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}