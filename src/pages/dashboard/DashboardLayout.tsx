import { Outlet } from 'react-router-dom'
import { AppNav } from '@/components/layout/AppNav'

export default function DashboardLayout() {
  return (
    // Mobile: vertical stack (main on top, nav at bottom).
    // Desktop: horizontal stack (sidebar left, main right).
    // flex-1 min-h-0 fills #root exactly via the flex algorithm — no h-full.
    <div className="flex flex-col md:flex-row flex-1 min-h-0 w-full overflow-hidden">

      {/* Desktop sidebar — renders inside flex flow on md+, hidden on mobile */}
      <AppNav variant="sidebar" />

      {/* Main content — fills remaining space */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        <Outlet />
      </main>

      {/* Mobile bottom nav — flex sibling, reserves its own 56px of space.
          Content can NEVER slide under it because it's part of the layout flow. */}
      <AppNav variant="bottombar" />

    </div>
  )
}