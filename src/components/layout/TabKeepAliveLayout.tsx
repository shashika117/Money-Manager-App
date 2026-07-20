import { lazy, Suspense } from 'react'
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

export function TabKeepAliveLayout() {
  const location = useLocation()
  const { resetKeys } = useTabReset()

  // Handle root URL redirecting to /home
  const currentPath = location.pathname === '/' ? '/home' : location.pathname

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        {TAB_PAGES.map(({ path, Component }) => {
          const isActive = currentPath === path
          const key = `${path}-${resetKeys[path] || 0}`

          return (
            <div
              key={key}
              className={cn(
                // We use flex-1 and min-h-0 here so the page component can take full height
                // and handle its own internal scrolling and sticky headers.
                'flex-1 min-h-0 min-w-0 w-full flex-col',
                isActive ? 'flex' : 'hidden'
              )}
            >
              <Component />
            </div>
          )
        })}
      </Suspense>
    </>
  )
}