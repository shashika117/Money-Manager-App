//src\pages\dashboard\DashboardLayout.tsx

import { AppNav } from '@/components/layout/AppNav'
import { TabKeepAliveLayout } from '@/components/layout/TabKeepAliveLayout'
import { TabResetProvider } from '@/contexts/TabResetContext'

export default function DashboardLayout() {
  return (
    <TabResetProvider>
      <div className="flex flex-col md:flex-row flex-1 min-h-0 w-full overflow-hidden bg-background">
        
        {/* Desktop Sidebar */}
        <AppNav variant="sidebar" />

        {/* Main content — fills remaining space */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <TabKeepAliveLayout />
        </main>

        {/* Mobile bottom nav */}
        <AppNav variant="bottombar" />

      </div>
    </TabResetProvider>
  )
}