// src/pages/dashboard/HomePage.tsx
//
// The Home dashboard. Every card is scoped to the CURRENT MONTH.
//
// Layout
//   Laptop (lg+): 12-col grid
//     row 1 → Calendar (7)          | NWS gauge + Account balances (5, stacked)
//     row 2 → Cumulative spending (7) | Budget details (5)
//   Mobile: single column, no area chart —
//     NWS gauge → Account balances → Budget details → Calendar
//
// Card chrome (🡵 redirect, ⌄ picker) lives in HomeCard: invisible until
// hover on laptop, muted-but-visible on mobile.
//
// NOTE: default export — App.tsx lazy-loads this route.

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { CalendarWidget } from '@/components/layout/CalendarWidget'
import { FAB }                  from '@/components/ui/FAB'
import { AddTransactionSheet }  from '@/components/forms/AddTransactionSheet'
import { HomeCard }             from '@/components/home/HomeCard'
import { NwsGaugeCard }         from '@/components/home/NwsGaugeCard'
import { AccountBalancesCard }  from '@/components/home/AccountBalancesCard'
import { BudgetDetailsCard }    from '@/components/home/BudgetDetailsCard'
import { SpendingAreaCard }     from '@/components/home/SpendingAreaCard'

function useIsLaptop() {
  const [isLaptop, setIsLaptop] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsLaptop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isLaptop
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 18) return 'Good Afternoon'
  return 'Good Evening'
}

export default function HomePage() {
  const { profile, signOut } = useAuth()
  const isLaptop = useIsLaptop()

  // Add-transaction sheet (same FAB + sheet pair as the Transactions page).
  const [sheetOpen, setSheetOpen] = useState(false)

  const now        = new Date()
  const monthTitle = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden animate-fade-in">

      {/* ══ WELCOME ══ */}
      <div className="flex-none flex items-start justify-between gap-3 border-b border-line bg-card px-5 pb-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}>
        <div className="min-w-0">
          <h1 className="font-sora text-xl font-bold text-white leading-tight truncate">
            {greeting()}, {profile?.display_name ?? '…'}
          </h1>
          <p className="font-dm text-xs text-soft mt-0.5">{monthTitle}</p>
        </div>
        <button
          onClick={signOut}
          className="flex-none rounded-lg border border-line px-3 py-1.5 font-dm text-xs text-soft transition-colors hover:border-red hover:text-red md:hidden"
        >
          Sign out
        </button>
      </div>

      {/* ══ BODY ══ */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-safe-bottom px-4 py-4">
        {isLaptop ? (
          // ── Laptop: 12-col grid ──
          <div className="grid grid-cols-12 gap-4 items-start">
            {/* Row 1 */}
            <div className="col-span-7">
              <CalendarCard monthTitle={monthTitle} />
            </div>
            <div className="col-span-5 flex flex-col gap-4">
              <NwsGaugeCard />
              <AccountBalancesCard />
            </div>

            {/* Row 2 */}
            <div className="col-span-7">
              <SpendingAreaCard />
            </div>
            <div className="col-span-5">
              <BudgetDetailsCard />
            </div>
          </div>
        ) : (
          // ── Mobile: single column, no area chart ──
          <div className="flex flex-col gap-4">
            <NwsGaugeCard />
            <AccountBalancesCard />
            <BudgetDetailsCard />
            <CalendarCard monthTitle={monthTitle} />
          </div>
        )}
      
        {/* ── 📍 The enough space for FAB to place bottom of the screen without covering anything ── */}
          {/* Changed md:h-6 to md:h-24 so it rolls past the bottom gap AND the physical height of the laptop FAB button */}
          <div className="h-2 md:h-18 flex-none" />

      </div>

      {/* ── FAB + SHEET ──
          Uses the SAME <FAB> component as the Transactions page, so the
          position is identical on both laptop and mobile by construction
          (fixed right-5 z-40 bottom-24 md:bottom-6) — nothing to keep in
          sync manually. */}
      <FAB onClick={() => setSheetOpen(true)} />
      <AddTransactionSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}

// ── Calendar card ───────────────────────────────────────────────────
// hideHeader strips CalendarWidget's internal ‹ › month nav, so the Home
// calendar is locked to the current month (per spec). The month name is
// rendered by the HomeCard header instead. Day taps still open the day
// overlay exactly as they do on the Transactions page.
function CalendarCard({ monthTitle }: { monthTitle: string }) {
  return (
    <HomeCard title={monthTitle} subtitle="Tap a day to see its transactions" to="/transactions">
      <div className="px-2 pb-2">
        <CalendarWidget hideHeader className="border-0 bg-transparent rounded-none" />
      </div>
    </HomeCard>
  )
}
