export default function GoalsPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in-scale">

      <div className="page-header border-b border-line bg-card px-5 flex-none">
        <h1 className="font-sora text-xl font-bold text-white">Goals</h1>
        <p className="font-dm text-xs text-soft mt-0.5">Coming in Phase 4</p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-safe-bottom">
        <div className="flex flex-col items-center px-8 pt-10 text-center">
          <span className="text-5xl mb-5">⭐</span>
          <h2 className="font-sora text-lg font-semibold text-white mb-2">Goals Engine</h2>
          <p className="font-dm text-sm text-soft mb-6">Coming in Phase 4</p>
          <div className="w-full max-w-xs space-y-2.5 text-left">
            {[
              'Goal cards with progress bars and forecasting',
              'Create / edit / archive savings goals',
              'Monthly allocation: distribute savings across goals',
              'Goal-to-goal reallocation (shift_goal_allocation RPC)',
              'Sinking Funds withdrawal history per goal',
              'Forecasted completion date (auto-calculated)',
              '"Saved With Time" cumulative area chart',
              'Goal activity log with period filter',
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