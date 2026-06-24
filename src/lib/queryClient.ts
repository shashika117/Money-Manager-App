import { QueryClient } from '@tanstack/react-query'

/*
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1000 * 60 * 5,   // 5 min — data considered fresh
      gcTime:               1000 * 60 * 30,  // 30 min — keep unused cache
      retry:                1,
      refetchOnWindowFocus: false,           // don't re-fetch on tab switch
    },
    mutations: {
      retry: 0,
    },
  },
})
*/

// AFTER
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:           1000 * 60 * 5,   // 5 minutes — data stays fresh longer
      refetchOnWindowFocus: false,           // no jarring re-fetch when returning to app
      retry:               1,               // only retry once on failure
    },
  },
})