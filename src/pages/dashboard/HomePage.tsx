import { useAuth } from '@/contexts/AuthContext'

export default function HomePage() {
  const { profile, signOut } = useAuth()

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in-scale">

      {/* Page header */}
      <div className="page-header border-b border-line bg-card px-5 flex-none flex items-start justify-between">
        <div>
          <p className="font-dm text-xs text-soft">Welcome back</p>
          <h1 className="font-sora text-xl font-bold text-white leading-tight">
            {profile?.display_name ?? '…'}
          </h1>
        </div>
        <button
          onClick={signOut}
          className="rounded-lg border border-line px-3 py-1.5 font-dm text-xs text-soft transition-colors hover:border-red hover:text-red md:hidden"
        >
          Sign out
        </button>
      </div>

      {/* Placeholder content — top-aligned flow, NOT justify-center */}
      <div className="flex-1 overflow-y-auto scroll-safe-bottom">
        <div className="flex flex-col items-center px-8 pt-10 text-center">
          <span className="text-5xl mb-5">🏠</span>
          <h2 className="font-sora text-lg font-semibold text-white mb-2">Home Dashboard</h2>
          <p className="font-dm text-sm text-soft mb-6">Coming in Phase 6</p>
          <div className="w-full max-w-xs space-y-2.5 text-left">
            {[
              'Budget remaining summary strip',
              'Monthly income vs expense cards',
              'Net savings with colour indicator',
              'Financial Discipline (NWS) gauge',
              'Key account balance strip',
              'Goals allocation progress',
              'Calendar widget snapshot',
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 text-green text-xs flex-none">◆</span>
                <p className="font-dm text-xs text-soft">{f}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}