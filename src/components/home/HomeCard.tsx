// src/components/home/HomeCard.tsx
//
// The shared shell for every Home page card.
//
// Icon visibility rule (per spec):
//   • Laptop  → icons are INVISIBLE until the mouse enters the card
//               (opacity-0 → group-hover:opacity-100)
//   • Mobile  → icons are always visible, but MUTED (opacity-50)
//   Tailwind: base = mobile, `md:` = laptop. So:
//     `opacity-50 md:opacity-0 md:group-hover:opacity-100`
//
// Also exports CheckboxPicker — the ⌄ dropdown popover used by the
// Account Balances and Budget Details cards.

import { useState, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

const ICON_VIS = 'opacity-50 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200'

interface HomeCardProps {
  title:      string
  subtitle?:  string
  to:         string                       // redirect route for the 🡵 icon
  children:   ReactNode
  className?: string
  /** Renders a ⌄ dropdown button; called with the button's rect. */
  onOpenPicker?: (rect: DOMRect) => void
}

export function HomeCard({
  title, subtitle, to, children, className, onOpenPicker,
}: HomeCardProps) {
  const navigate = useNavigate()
  const dropRef  = useRef<HTMLButtonElement>(null)

  return (
    <div className={cn(
      'group relative flex flex-col rounded-2xl border border-line bg-card overflow-hidden',
      className,
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2 flex-none">
        <div className="min-w-0">
          <h2 className="font-sora text-sm font-bold text-white truncate">{title}</h2>
          {subtitle && (
            <p className="font-dm text-[11px] text-muted truncate mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Icons — hidden until hover on laptop; muted-but-visible on mobile */}
        <div className="flex items-center gap-1 flex-none">
          {onOpenPicker && (
            <button
              ref={dropRef}
              onClick={() => dropRef.current && onOpenPicker(dropRef.current.getBoundingClientRect())}
              aria-label="Choose what to show"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg text-soft',
                'hover:bg-panel hover:text-white touch-manipulation',
                ICON_VIS,
              )}>
              <span className="font-sora text-xs leading-none">

              {/*Drop down arrow = ⌄*/}
              <svg xmlns="http://w3.org" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>

              </span>
            </button>
          )}

          <button
            onClick={() => navigate(to)}
            aria-label={`Open ${title}`}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg text-soft',
              'hover:bg-panel hover:text-white touch-manipulation',
              ICON_VIS,
            )}>
            <span className="font-sora text-xs leading-none">🡵</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// CHECKBOX PICKER — the ⌄ dropdown popover
// ════════════════════════════════════════════════════════════════════
//
// Placement: prefer BELOW the ⌄ button. If the panel wouldn't fit there,
// flip it ABOVE the button instead. Only if it fits in neither direction
// do we clamp it — and even then we never let it run under the mobile
// bottom-nav bar.
//
// The old version always anchored below and then clamped, which on a phone
// pinned low-sitting cards (Account Balances, Budget Details) to the very
// bottom of the screen, covering the nav. Desktop was fine because there's
// no bottom nav and more vertical room.
interface PickerProps {
  title:     string
  options:   string[]              // every selectable name
  selected:  string[]              // currently ticked
  rect:      DOMRect               // anchor (the ⌄ button)
  onToggle:  (name: string) => void
  onClose:   () => void
  footer?:   ReactNode             // e.g. the rollover toggle
  emptyHint?: string
}

const MARGIN = 8
// Mobile bottom nav (h-12 = 48px) + home-indicator safe area + breathing room.
// Desktop has no bottom nav, so it only needs the normal margin.
const MOBILE_BOTTOM_RESERVE = 76

export function CheckboxPicker({
  title, options, selected, rect, onToggle, onClose, footer, emptyHint,
}: PickerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const W = 260

  const left = Math.max(
    MARGIN,
    Math.min(rect.right - W, window.innerWidth - W - MARGIN),
  )

  const [pos, setPos] = useState<{ top: number; maxH: number }>({
    top: rect.bottom + 6,
    maxH: 320,
  })

  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return

    const isMobile = window.innerWidth < 768
    const bottomReserve = isMobile ? MOBILE_BOTTOM_RESERVE : MARGIN
    const viewportH = window.innerHeight

    // Usable band: below the safe top margin, above the nav bar.
    const floor = viewportH - bottomReserve      // lowest y the panel may reach
    const spaceBelow = floor - (rect.bottom + 6)
    const spaceAbove = (rect.top - 6) - MARGIN

    const desired = el.scrollHeight

    // 1) Fits below the button → put it there.
    if (desired <= spaceBelow) {
      setPos({ top: rect.bottom + 6, maxH: desired })
      return
    }
    // 2) Doesn't fit below, but fits above → flip up.
    if (desired <= spaceAbove) {
      setPos({ top: rect.top - 6 - desired, maxH: desired })
      return
    }
    // 3) Fits in neither → use whichever side is roomier and let the list
    //    scroll inside, never crossing the nav bar or the top margin.
    if (spaceAbove > spaceBelow) {
      const maxH = Math.max(160, spaceAbove)
      setPos({ top: Math.max(MARGIN, rect.top - 6 - maxH), maxH })
    } else {
      const maxH = Math.max(160, spaceBelow)
      setPos({ top: rect.bottom + 6, maxH })
    }
  }, [rect.top, rect.bottom, options.length])

  const sel = new Set(selected)

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 animate-fade-in" onClick={onClose} />
      <div ref={panelRef}
        className="fixed z-[61] w-[260px] rounded-2xl bg-card border border-line shadow-2xl animate-fade-in-scale flex flex-col overflow-hidden"
        style={{ top: pos.top, left, maxHeight: pos.maxH }}>

        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line flex-none">
          <span className="font-sora text-xs font-bold text-white">{title}</span>
          <button onClick={onClose} aria-label="Close"
            className="flex h-6 w-6 items-center justify-center rounded-md text-soft hover:text-white hover:bg-panel">
            ✕
          </button>
        </div>

        {footer && (
          <div className="px-3.5 py-2.5 border-b border-line flex-none bg-navy/40">{footer}</div>
        )}

        {/* The list is the only part that scrolls, so the header/footer stay put */}
        <div className="flex-1 min-h-0 overflow-y-auto py-1">
          {options.length === 0 ? (
            <p className="px-3.5 py-6 text-center font-dm text-xs text-muted">
              {emptyHint ?? 'Nothing to show.'}
            </p>
          ) : options.map(name => {
            const on = sel.has(name)
            return (
              <button key={name} onClick={() => onToggle(name)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-panel transition-colors">
                <span className={cn(
                  'flex h-4 w-4 flex-none items-center justify-center rounded border transition-colors',
                  on ? 'border-green bg-green' : 'border-line bg-navy',
                )}>
                  {on && <span className="font-sora text-[9px] leading-none text-white">✓</span>}
                </span>
                <span className={cn('font-dm text-xs truncate', on ? 'text-white' : 'text-soft')}>
                  {name}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
