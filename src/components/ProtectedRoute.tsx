//src\components\ProtectedRoute.tsx

import { Navigate } from 'react-router-dom'
import { useAuth }  from '@/contexts/AuthContext'

interface Props { children: React.ReactNode }

export function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-navy">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-green border-t-transparent animate-spin" />
          <p className="font-dm text-soft text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}