// src/contexts/TabResetContext.tsx

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query' // ← Uncomment if using React Query

// Minimum time the reset spinner stays visible to prevent visual flickering on fast networks.
//const MIN_LOADER_MS = 500

// How long the manual scroll-to-top animation takes.
const SCROLL_ANIM_MS = 350

function animateScrollToTop(el: HTMLElement, duration: number, onDone: () => void) {
  const start = el.scrollTop
  if (start <= 0) { onDone(); return }

  const startTime = performance.now()
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

  function step(now: number) {
    const t = Math.min(1, (now - startTime) / duration)
    el.scrollTop = start * (1 - easeOutCubic(t))
    if (t < 1) {
      requestAnimationFrame(step)
    } else {
      el.scrollTop = 0
      onDone()
    }
  }
  requestAnimationFrame(step)
}

interface TabResetContextType {
  resetKeys: Record<string, number>
  resettingPaths: Record<string, boolean>
  requestReset: (path: string) => void
  registerScrollContainer:   (path: string, el: HTMLElement) => void
  unregisterScrollContainer: (path: string, el: HTMLElement) => void
}

const TabResetContext = createContext<TabResetContextType | null>(null)

export function TabResetProvider({ children }: { children: ReactNode }) {
  const [resetKeys, setResetKeys] = useState<Record<string, number>>({})
  const [resettingPaths, setResettingPaths] = useState<Record<string, boolean>>({})
  
  const queryClient = useQueryClient() // ← Uncomment if using React Query

  const scrollContainers = useRef<Record<string, Set<HTMLElement>>>({})

  const registerScrollContainer = useCallback((path: string, el: HTMLElement) => {
    if (!scrollContainers.current[path]) scrollContainers.current[path] = new Set()
    scrollContainers.current[path].add(el)
  }, [])

  const unregisterScrollContainer = useCallback((path: string, el: HTMLElement) => {
    scrollContainers.current[path]?.delete(el)
  }, [])

  // ── TRICK 2: ASYNC NETWORK-AWARE RESET ──
  const performReset = useCallback(async (path: string, startedAt: number) => {
    // 1. Trigger the tab remount
    setResetKeys(prev => ({ ...prev, [path]: (prev[path] || 0) + 1 }))

    try {
      // 2. If online, force React Query to refetch all active network queries on the page
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await queryClient.refetchQueries({ type: 'active' })
      } else {
        // If offline, wait briefly so the user reads the offline status badge
        await new Promise(res => setTimeout(res, 1200))
      }

      // 3. Ensure a minimum 500ms animation threshold so the UI doesn't flicker on fast connections
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, 500 - elapsed)
      if (remaining > 0) {
        await new Promise(res => setTimeout(res, remaining))
      }
    } catch (err) {
      console.error('Failed to refetch page queries:', err)
    } finally {
      // 4. Hide the spinner badge only when network refetching completes
      setResettingPaths(prev => ({ ...prev, [path]: false }))
    }
  }, [queryClient])

  const requestReset = useCallback((path: string) => {
    setResettingPaths(prev => {
      if (prev[path]) return prev
      return { ...prev, [path]: true }
    })

    const startedAt = Date.now()
    const containers = Array.from(scrollContainers.current[path] ?? [])
    const scrolled = containers.filter(el => el.scrollTop > 0)

    if (scrolled.length > 0) {
      let remaining = scrolled.length
      function onOneSettled() {
        remaining -= 1
        if (remaining === 0) performReset(path, startedAt)
      }
      scrolled.forEach(el => animateScrollToTop(el, SCROLL_ANIM_MS, onOneSettled))
    } else {
      performReset(path, startedAt)
    }
  }, [performReset])

  return (
    <TabResetContext.Provider
      value={{
        resetKeys, resettingPaths, requestReset,
        registerScrollContainer, unregisterScrollContainer,
      }}
    >
      {children}
    </TabResetContext.Provider>
  )
}

export function useTabReset() {
  const ctx = useContext(TabResetContext)
  if (!ctx) throw new Error('useTabReset must be used within TabResetProvider')
  return ctx
}