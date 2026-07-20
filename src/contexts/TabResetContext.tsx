import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface TabResetContextType {
  resetKeys: Record<string, number>
  resetTab: (path: string) => void
}

const TabResetContext = createContext<TabResetContextType | null>(null)

export function TabResetProvider({ children }: { children: ReactNode }) {
  const [resetKeys, setResetKeys] = useState<Record<string, number>>({})

  const resetTab = (path: string) => {
    setResetKeys(prev => ({
      ...prev,
      [path]: (prev[path] || 0) + 1,
    }))
  }

  return (
    <TabResetContext.Provider value={{ resetKeys, resetTab }}>
      {children}
    </TabResetContext.Provider>
  )
}

export function useTabReset() {
  const ctx = useContext(TabResetContext)
  if (!ctx) throw new Error('useTabReset must be used within TabResetProvider')
  return ctx
}