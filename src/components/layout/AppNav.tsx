import { NavLink } from 'react-router-dom'
import { cn }      from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

// ── SVG Icon set ──────────────────────────────────────────────────
interface IconProps { className?: string }

function IconHome({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}
function IconTransactions({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  )
}
function IconBudget({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v9l4.5 4.5" />
    </svg>
  )
}
function IconGoals({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}
function IconAnalytics({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="6"  y1="20" x2="6"  y2="14" />
      <line x1="12" y1="20" x2="12" y2="4"  />
      <line x1="18" y1="20" x2="18" y2="10" />
    </svg>
  )
}
// ADD this icon function alongside the others:
function IconAccounts({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h2" />
    </svg>
  )
}
function IconSignOut({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

// ── Tab definitions ───────────────────────────────────────────────
// label     = shown in the desktop sidebar (full word)
// shortLabel = shown in the mobile bottom bar (fits the narrow tab)
const TABS = [
  { path: '/home',         label: 'Home',          shortLabel: 'Home',   Icon: IconHome         },
  { path: '/transactions', label: 'Transactions',  shortLabel: 'Txns',   Icon: IconTransactions },
  { path: '/accounts',     label: 'Accounts',      shortLabel: 'Accs',   Icon: IconAccounts     },
  { path: '/analytics',    label: 'Analytics',     shortLabel: 'Stats',  Icon: IconAnalytics    },
  { path: '/budget',       label: 'Budget',        shortLabel: 'Budget', Icon: IconBudget       },
  { path: '/goals',        label: 'Goals',         shortLabel: 'Goals',  Icon: IconGoals        },
] as const

// ── AppNav ────────────────────────────────────────────────────────
interface AppNavProps {
  variant: 'sidebar' | 'bottombar'
}

export function AppNav({ variant }: AppNavProps) {
  const { profile, signOut } = useAuth()

  // ════════════════════════════════════════════════════════
  // DESKTOP SIDEBAR
  // ════════════════════════════════════════════════════════
  if (variant === 'sidebar') {
    return (
      <aside className="hidden md:flex flex-col w-[220px] flex-none bg-card border-r border-line h-full">

        {/* Brand */}
        <div
          className="flex items-center gap-2.5 px-5 border-b border-line flex-none"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)', paddingBottom: '20px' }}
        >
          <span className="text-xl leading-none">


        {/* LOGO DESIGN */}
        <svg
              width={36}
              height={36}
              viewBox="26 28 148 148"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
     
            >
              <defs>
            <linearGradient id="mGradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#00E5FF" />   <stop offset="100%" stop-color="#FFFFFF" /> </linearGradient>
            <linearGradient id="glowFilter" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#00E5FF" stop-opacity="0.12" />
              <stop offset="100%" stop-color="#00E5FF" stop-opacity="0" />
            </linearGradient>
          </defs>
  
          <path d="M 68 145 Q 100 102 132 145 Z" fill="url(#glowFilter)" />

          <path 
            d="M58 145 
               C58 115, 62 85, 76 85 
               C90 85, 93 118, 100 118 
               C107 118, 124 60, 140 60 
               C146 60, 144 105, 144 145" 
            fill="none" 
            stroke="#00E5FF" 
            stroke-width="16" stroke-linecap="round" 
            stroke-linejoin="round" 
          />

          <path 
            d="M58 145 
               C58 115, 62 85, 76 85 
               C90 85, 93 118, 100 118 
               C107 118, 124 60, 140 60 
               C146 60, 144 105, 144 145" 
            fill="none" 
            stroke="url(#mGradient)" 
            stroke-width="16" 
            stroke-linecap="round" 
            stroke-linejoin="round" 
          />
        
          <circle cx="140" cy="60" r="7.5" fill="none" stroke="#00E5FF" stroke-width="3" />
        
          <circle cx="140" cy="60" r="7" fill="none" stroke="url(#mGradient)" stroke-width="4" />
        </svg>


          </span>
          <div>
            <p className="font-sora text-sm font-bold text-white leading-none">Money Manager</p>
            <p className="font-dm text-[10px] text-muted leading-none mt-0.5">Family Finance</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {TABS.map(({ path, label, Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl font-dm text-sm transition-all duration-150',
                isActive
                  ? 'bg-green/10 text-green font-medium border border-green/20'
                  : 'text-soft hover:bg-panel hover:text-white border border-transparent',
              )}
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-[18px] w-[18px] flex-none transition-colors', isActive ? 'text-green' : 'text-soft')} />
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + sign out */}
        <div
          className="px-3 border-t border-line flex-none"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', paddingTop: '12px' }}
        >
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center font-sora text-xs font-bold text-white flex-none"
              style={{ backgroundColor: profile?.avatar_color ?? '#10b981' }}
            >
              {profile?.display_name?.charAt(0) ?? '?'}
            </div>
            <p className="font-dm text-sm text-white truncate">{profile?.display_name ?? '…'}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-dm text-sm text-soft transition-colors hover:bg-red/10 hover:text-red"
          >
            <IconSignOut className="h-[18px] w-[18px] flex-none" />
            Sign out
          </button>
        </div>
      </aside>
    )
  }

  // ════════════════════════════════════════════════════════
  // MOBILE BOTTOM BAR
  // Rendered as a flex sibling (NOT fixed). It reserves its own
  // height in the layout, so page content can never slide under it.
  // ════════════════════════════════════════════════════════
  return (
    <nav
      className="md:hidden flex-none bg-card border-t border-line"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-12">
        {TABS.map(({ path, shortLabel, Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors duration-150 touch-manipulation',
              isActive ? 'text-green' : 'text-muted',
            )}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 inset-x-2 h-0.5 rounded-full bg-green animate-fade-in" />
                )}
                <Icon className={cn('h-5 w-5 transition-colors', isActive ? 'text-green' : 'text-muted')} />
                <span className={cn('font-dm text-[10px] font-medium leading-none', isActive ? 'text-green' : 'text-muted')}>
                  {shortLabel}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}