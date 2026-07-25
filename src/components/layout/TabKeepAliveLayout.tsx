// src/components/layout/TabKeepAliveLayout.tsx

import { lazy, Suspense, useState, useEffect } from 'react'
import { useLocation }   from 'react-router-dom'
import { cn }            from '@/lib/utils'
import { useTabReset }   from '@/contexts/TabResetContext'

// Lazy-loaded pages matching your dashboard directory
const HomePage         = lazy(() => import('@/pages/dashboard/HomePage'))
const TransactionsPage = lazy(() => import('@/pages/dashboard/TransactionsPage'))
const AccountsPage     = lazy(() => import('@/pages/dashboard/AccountsPage'))
const AnalyticsPage    = lazy(() => import('@/pages/dashboard/AnalyticsPage'))
const BudgetPage       = lazy(() => import('@/pages/dashboard/BudgetPage'))
const GoalsPage        = lazy(() => import('@/pages/dashboard/GoalsPage'))

const TAB_PAGES = [
  { path: '/home',         Component: HomePage },
  { path: '/transactions', Component: TransactionsPage },
  { path: '/accounts',     Component: AccountsPage },
  { path: '/analytics',    Component: AnalyticsPage },
  { path: '/budget',       Component: BudgetPage },
  { path: '/goals',        Component: GoalsPage },
]

function PageLoader() {
  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-green border-t-transparent" />
    </div>
  )
}

// Helper hook to track live online/offline network status
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

function ResetSpinner({ isResetting }: { isResetting: boolean }) {
  const [mounted, setMounted] = useState(isResetting)
  const [visible, setVisible] = useState(false)
  const isOnline = useOnlineStatus()

  useEffect(() => {
    if (isResetting) {
      setMounted(true)
      const timer = setTimeout(() => setVisible(true), 10)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isResetting])

  if (!mounted) return null

  return (
    <div
      className={cn(
        'absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none',
        'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        visible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-3 scale-90',
      )}
      style={{ top: 'calc(env(safe-area-inset-top) + 80px)' }}
    >
      <div
        className={cn(
          'flex h-9 items-center gap-2 rounded-full border px-3 shadow-xl shadow-black/50 backdrop-blur-md transition-all duration-200',
          isOnline
            ? 'border-line/80 bg-card/90 ring-1 ring-green/30 text-green'
            : 'border-amber/40 bg-card/95 ring-1 ring-amber/40 text-amber'
        )}
      >
        {isOnline ? (
          <>
            <svg
              className="h-4 w-4 animate-spin shrink-0 text-green"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            {/*} <span className="font-dm text-xs font-medium text-white">Refreshing…</span> */}
          </>
        ) : (
          <>
            {/* Wifi Off Icon */}
            <svg
              className="h-4 w-4 shrink-0 text-amber animate-pulse"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
            <span className="font-dm text-xs font-medium text-amber">
              Offline • Showing cached data
            </span>
          </>
        )}
      </div>
    </div>
  )
}
export function TabKeepAliveLayout() {
  const location = useLocation()
  const { resetKeys, resettingPaths } = useTabReset()

  // Handle root URL redirecting to /home
  const currentPath = location.pathname === '/' ? '/home' : location.pathname

  return (
    <Suspense fallback={<PageLoader />}>
      {TAB_PAGES.map(({ path, Component }) => {
        const isActive = currentPath === path
        const key = `${path}-${resetKeys[path] || 0}`
        const isResetting = !!resettingPaths[path]

        return (
          <div
            key={path}
            className={cn(
              'relative flex-1 min-h-0 min-w-0 w-full flex-col',
              isActive ? 'flex' : 'hidden',
            )}
          >
            {/* Always pass boolean so internal timer can handle exit transition */}
            <ResetSpinner isResetting={isResetting} />

            <div key={key} className="flex-1 min-h-0 min-w-0 w-full flex flex-col">
              <Component />
            </div>
          </div>
        )
      })}
    </Suspense>
  )
}