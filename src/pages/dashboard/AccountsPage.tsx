import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useAccountBalances }       from '@/hooks/useAccountBalances'
import { useNetWorth }              from '@/hooks/useNetWorth'
import { useNetWorthHistory }       from '@/hooks/useNetWorthHistory'
import type { NetWorthPeriod }      from '@/hooks/useNetWorthHistory'
import { NetWorthPerformanceChart } from '@/components/charts/NetWorthPerformanceChart'
import { NetWorthBreakdownChart }   from '@/components/charts/NetWorthBreakdownChart'
import { AccountsHierarchyTable }   from '@/components/layout/AccountsHierarchyTable'
import { TransactionTableWidget }   from '@/components/layout/TransactionTableWidget'
import { AddTransactionSheet }      from '@/components/forms/AddTransactionSheet'
import { FAB }                      from '@/components/ui/FAB'
import { useRecalculateBalances } from '@/hooks/useRecalculateBalances'

type ChartKind = 'performance' | 'breakdown'

const PERIODS: { value: NetWorthPeriod; label: string }[] = [
  { value: '3M', label: '3M' }, { value: '6M', label: '6M' },
  { value: '12M', label: '12M' }, { value: 'ALL', label: 'All' },
]

export default function AccountsPage() {
  const [chartKind, setChartKind] = useState<ChartKind>('performance')
  const [period,    setPeriod]    = useState<NetWorthPeriod>('3M')
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [mobileClosing, setMobileClosing] = useState(false)
  const [sheetOpen,    setSheetOpen]    = useState(false)
  const [sheetDate,    setSheetDate]    = useState<string | undefined>()
  const [sheetAccount, setSheetAccount] = useState<string | undefined>()
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null)
  


  const { data: balances = [], isLoading: balLoading } = useAccountBalances()
  const { data: nw }                                   = useNetWorth()
  const { data: history = [], isLoading: histLoading } = useNetWorthHistory(period)


  // ── Account selection ─────────────────────────────────────────────
  const handleSelectAccount = useCallback((account: string) => {
    setSelectedAccount(prev => {
      if (prev === account) {
        setMobileOpen(false)
        return null   // tap same → deselect
      }
      setMobileOpen(true)
      return account
    })
  }, [])

  // ── Mobile close with animation + deselect ────────────────────────
  function closeMobileWidget() {
    setMobileClosing(true)
    setTimeout(() => {
      setMobileOpen(false)
      setMobileClosing(false)
      setSelectedAccount(null)   // deselect when going back
    }, 240)
  }

  // ── Sheet ─────────────────────────────────────────────────────────
  function openSheet(date?: string, acct?: string) {
    setSheetDate(date)
    setSheetAccount(acct ?? selectedAccount ?? undefined)
    setSheetOpen(true)
  }
  function closeSheet() {
    setSheetOpen(false)
    setTimeout(() => { setSheetDate(undefined); setSheetAccount(undefined) }, 300)
  }

  async function handleRecalculate() {
  try {
    const msg = await recalc.mutateAsync()
    setRecalcMsg(msg)
    setTimeout(() => setRecalcMsg(null), 5000)
  } catch (err: unknown) {
    const detail = (err as any)?.message ?? String(err)
    setRecalcMsg(`Failed: ${detail}`)
    console.error('recalculate_account_balances:', err)
    setTimeout(() => setRecalcMsg(null), 8000)
  }
}

  const accountFilters  = selectedAccount ? { account: selectedAccount } : {}
  const showUpdatedNote = period === 'ALL'
  const recalc = useRecalculateBalances()

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden lg:overflow-y-auto animate-fade-in">


      {/* ── HEADER ── */}
      <div className="border-b border-line bg-card px-4 flex-none"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)', paddingBottom: '12px' }}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-sora text-xl font-bold text-white leading-none">Accounts</h1>

          <button
            onClick={handleRecalculate}
            disabled={recalc.isPending}
            title="Recomputes every account balance from scratch using all transaction history"
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5',
              'font-dm text-xs transition-colors touch-manipulation',
              recalc.isPending
                ? 'text-muted cursor-not-allowed'
                : 'text-soft hover:border-amber hover:text-amber',
            )}
          >
            {recalc.isPending ? (
              <>
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                </svg>
                Recalculating…
              </>
            ) : (
              <>
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Recalculate
              </>
            )}
          </button>
        </div>
      </div>


      {/* ── CHARTS (laptop only) ── */}
      <div className="hidden lg:block px-4 pt-4 flex-none">
        <div className="rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <ChartTab active={chartKind === 'performance'} onClick={() => setChartKind('performance')}>
                Net Worth Performance
              </ChartTab>
              <ChartTab active={chartKind === 'breakdown'} onClick={() => setChartKind('breakdown')}>
                Net Worth Breakdown
              </ChartTab>
            </div>
            <div className="flex rounded-lg border border-line bg-navy overflow-hidden">
              {PERIODS.map(p => (
                <button key={p.value} onClick={() => setPeriod(p.value)}
                  className={cn('px-3 py-1.5 font-dm text-xs transition-colors touch-manipulation',
                    period === p.value ? 'bg-green/15 text-green' : 'text-soft hover:text-white')}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {chartKind === 'performance'
            ? <NetWorthPerformanceChart data={history} period={period} isLoading={histLoading} />
            : <NetWorthBreakdownChart   data={history} period={period} isLoading={histLoading} />
          }
          {showUpdatedNote && (
            <p className="text-right font-dm text-[10px] text-muted mt-2">
              All-time data · refreshed periodically
            </p>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 min-h-0 overflow-hidden lg:flex lg:flex-row lg:gap-4 lg:px-4 lg:pt-4 lg:pb-4 lg:overflow-visible">

        {/* Hierarchy table */}
        <div
          className="h-full overflow-y-auto scroll-safe-bottom lg:h-fit lg:flex-1 lg:max-w-[33%] lg:overflow-visible"
        >
          <AccountsHierarchyTable
            rows={balances}
            netWorth={nw?.net_worth ?? 0}
            selectedAccount={selectedAccount}
            onSelectAccount={handleSelectAccount}
            isLoading={balLoading}
          />
        </div>

        {/* Transaction widget — laptop: always visible */}
        <div className="hidden lg:flex lg:flex-[2] lg:min-w-0 lg:rounded-2xl lg:border lg:border-line lg:bg-card lg:overflow-hidden lg:flex-col"
          style={{ minHeight: '135vh' }}>
          <TransactionTableWidget
            key={`acc-desktop-${selectedAccount ?? 'all'}`}
            filters={accountFilters}
            showMonthNav
            onDateGroupSelect={date => openSheet(date, selectedAccount ?? undefined)}
            className="flex-1 min-h-0"
          />
        </div>
      </div>

      {/* ── MOBILE OVERLAY ─────────────────────────────────────────
           ref={mobileOverlayRef} is the key fix: the outside-click
           handler checks this ref and skips firing when the user
           taps anywhere inside the overlay. This fixes Bug 3.
      ── */}
      {mobileOpen && selectedAccount && (
        <div
          className={cn(
            'lg:hidden fixed inset-0 z-50 bg-navy flex flex-col',
            mobileClosing ? 'animate-slide-out-right' : 'animate-slide-in-right',
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-line bg-card px-4 flex-none"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: '12px' }}>
            <button onClick={closeMobileWidget}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-line bg-navy font-sora text-base text-soft hover:text-white transition-colors active:scale-95"
              aria-label="Back">
              ‹
            </button>
            <div className="min-w-0">
              <p className="font-dm text-[10px] uppercase tracking-widest text-soft">Account</p>
              <h2 className="font-sora text-base font-bold text-white truncate">{selectedAccount}</h2>
            </div>
          </div>

          <TransactionTableWidget
            key={`acc-mobile-${selectedAccount}`}
            filters={accountFilters}
            showMonthNav
            onDateGroupSelect={date => openSheet(date, selectedAccount)}
            className="flex-1 min-h-0"
          />

          {/*
            Mobile FAB — Fix for Bug 2: only renders INSIDE the overlay,
            not in the main page layout. So it only appears when viewing
            an account's transactions. z-[55] puts it above the z-50 overlay.
          */}
          <button
            onClick={() => openSheet(undefined, selectedAccount)}
            aria-label="Add transaction"
            className="fixed right-5 z-[45] h-14 w-14 rounded-full bg-green shadow-lg shadow-green/30 flex items-center justify-center font-sora text-2xl font-light text-white transition-all active:scale-90 touch-manipulation"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
          >
            +
          </button>
        </div>
      )}

      {/*
        Laptop FAB — Fix for Bug 1: always visible on laptop.
        Pre-fills account if one is currently selected.
        hidden on mobile (mobile FAB lives inside the overlay above).
      */}
      <div className="hidden lg:block">
        <FAB onClick={() => openSheet(undefined, selectedAccount ?? undefined)} />
      </div>

      {/* Sheet — shared between laptop and mobile */}
      <AddTransactionSheet
        isOpen={sheetOpen}
        onClose={closeSheet}
        initialDate={sheetDate}
        initialAccount={sheetAccount}
      />


       {/* Recalculate result toast */}
      {recalcMsg && (
       <div className={cn(
         'fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] animate-fade-in',
         'rounded-xl border border-line bg-card px-4 py-3 shadow-xl',
         'font-dm text-xs text-white max-w-xs text-center',
        )}>
         {recalcMsg}
        </div>
      )}


    </div>
  )
}

function ChartTab({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className={cn('font-sora text-sm font-semibold px-3 py-1.5 rounded-lg transition-all touch-manipulation relative',
        active ? 'text-white' : 'text-muted hover:text-soft')}>
      {children}
      {active && <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-green animate-fade-in" />}
    </button>
  )
}
