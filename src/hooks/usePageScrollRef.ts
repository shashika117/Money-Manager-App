// src/hooks/usePageScrollRef.ts
//

import { useEffect, useRef } from 'react'
import { useTabReset } from '@/contexts/TabResetContext'

export function usePageScrollRef<T extends HTMLElement = HTMLDivElement>(path: string | undefined) {
  const ref = useRef<T>(null)
  const { registerScrollContainer, unregisterScrollContainer } = useTabReset()

  useEffect(() => {
    if (!path) return
    const el = ref.current
    if (!el) return
    registerScrollContainer(path, el)
    return () => unregisterScrollContainer(path, el)
  }, [path, registerScrollContainer, unregisterScrollContainer])

  return ref
}


