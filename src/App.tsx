// src\App.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider }                   from '@tanstack/react-query'
import { AuthProvider }                          from '@/contexts/AuthContext'
import { ProtectedRoute }                        from '@/components/ProtectedRoute'
import { queryClient }                           from '@/lib/queryClient'
import LoginPage                                 from '@/pages/LoginPage'
import DashboardLayout                           from '@/pages/dashboard/DashboardLayout'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>

            {/* ── Public: Login ── */}
            <Route path="/login" element={<LoginPage />} />

            <Route path="/" element={<Navigate to="/home" replace />} />

            {/* ── Protected: Dashboard Shell ── */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/home" replace />} />

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}