export default function AnalyticsPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in-scale">

      <div className="page-header border-b border-line bg-card px-5 flex-none">
        <h1 className="font-sora text-xl font-bold text-white">Analytics</h1>
        <p className="font-dm text-xs text-soft mt-0.5">Coming in Phase 5</p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-safe-bottom">
        <div className="flex flex-col items-center px-8 pt-10 text-center">
          <span className="text-5xl mb-5">📊</span>
          <h2 className="font-sora text-lg font-semibold text-white mb-2">Statistics & Charts</h2>
          <p className="font-dm text-sm text-soft mb-6">Coming in Phase 5</p>
          <div className="w-full max-w-xs space-y-2.5 text-left">
            {[
              'Period selector: This Month → All Time',
              'Spending distribution cumulative area chart',
              'Category horizontal bar chart (ranked)',
              'Sub-category donut (tappable drill-down)',
              'Budget vs Spent comparison bars',
              'NWS Financial Discipline gauge (0–100)',
              'NWS monthly history line chart (12 months)',
              'Needs / Wants / Savings cost breakdown cards',
              'Linked transaction table (tap chart → filter list)',
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