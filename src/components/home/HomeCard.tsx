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
              <span className="font-sora text-xs leading-none">⌄</span>
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

export function CheckboxPicker({
  title, options, selected, rect, onToggle, onClose, footer, emptyHint,
}: PickerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const W = 260, MARGIN = 8

  const left = Math.max(
    MARGIN,
    Math.min(rect.right - W, window.innerWidth - W - MARGIN),
  )
  const [top, setTop] = useState(rect.bottom + 6)

  // Keep fully on-screen (these cards can sit low on a phone).
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    let t = rect.bottom + 6
    if (t + el.offsetHeight > window.innerHeight - MARGIN) {
      t = window.innerHeight - el.offsetHeight - MARGIN
    }
    setTop(Math.max(MARGIN, t))
  }, [rect.bottom])

  const sel = new Set(selected)

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 animate-fade-in" onClick={onClose} />
      <div ref={panelRef}
        className="fixed z-[61] w-[260px] rounded-2xl bg-card border border-line shadow-2xl animate-fade-in-scale flex flex-col overflow-hidden"
        style={{ top, left }}>

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

        <div className="flex-1 min-h-0 max-h-[280px] overflow-y-auto py-1">
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
