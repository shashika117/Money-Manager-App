import { lazy, Suspense }                       from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider }                  from '@tanstack/react-query'
import { AuthProvider }                         from '@/contexts/AuthContext'
import { ProtectedRoute }                       from '@/components/ProtectedRoute'
import { queryClient }                          from '@/lib/queryClient'
import LoginPage                                from '@/pages/LoginPage'

// DashboardLayout is eagerly loaded — it's needed immediately after auth
import DashboardLayout from '@/pages/dashboard/DashboardLayout'

// All pages are lazy-loaded: each tab's code is only downloaded when first visited.
// React.lazy() + Suspense provides code-splitting automatically.
const HomePage         = lazy(() => import('@/pages/dashboard/HomePage'))
const TransactionsPage = lazy(() => import('@/pages/dashboard/TransactionsPage'))
const BudgetPage       = lazy(() => import('@/pages/dashboard/BudgetPage'))
const GoalsPage        = lazy(() => import('@/pages/dashboard/GoalsPage'))
const AnalyticsPage    = lazy(() => import('@/pages/dashboard/AnalyticsPage'))
const AccountsPage     = lazy(() => import('@/pages/dashboard/AccountsPage'))

// Shown while a lazy page is loading for the first time (usually < 100ms)
function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-green border-t-transparent" />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>

            {/* ── Public: Login ── */}
            <Route path="/login" element={<LoginPage />} />

            {/* ── Protected: Dashboard shell ── */}
            {/*
              DashboardLayout renders AppNav + <Outlet />.
              All child routes render inside the Outlet.
              ProtectedRoute redirects to /login if not authenticated.
            */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              {/* Default: redirect / to /transactions */}
              <Route index element={<Navigate to="/home" replace />} />

              <Route path="home" element={
                <Suspense fallback={<PageLoader />}><HomePage /></Suspense>
              } />

              <Route path="transactions" element={
                <Suspense fallback={<PageLoader />}><TransactionsPage /></Suspense>
              } />

              {/* ADD THIS: */}
              <Route path="accounts" element={
                <Suspense fallback={<PageLoader />}><AccountsPage /></Suspense>
              } />

              <Route path="budget" element={
                <Suspense fallback={<PageLoader />}><BudgetPage /></Suspense>
              } />

              <Route path="goals" element={
                <Suspense fallback={<PageLoader />}><GoalsPage /></Suspense>
              } />

              <Route path="analytics" element={
                <Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>
              } />

              {/* Catch-all: unknown paths redirect to transactions */}
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Route>

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}