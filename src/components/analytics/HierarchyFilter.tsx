// src/components/analytics/HierarchyFilter.tsx
//
// Spending-tab-only filter: "By group" (Needs/Wants/Save) or
// "By category" (expense categories across groups). The button's label
// shows the active option; a small popover offers the two choices.

import { useState, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Hierarchy } from '@/lib/analyticsScope'

const OPTIONS: { value: Hierarchy; label: string; hint: string }[] = [
  { value: 'group',    label: 'By group',    hint: 'Needs · Wants · Save' },
  { value: 'category', label: 'By category', hint: 'All expense categories' },
]

interface Props {
  value:    Hierarchy
  onChange: (h: Hierarchy) => void
}

export function HierarchyFilter({ value, onChange }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState<{ top: number; left: number } | null>(null)

  const active = OPTIONS.find(o => o.value === value)!

  function openMenu() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const w = 220, margin = 8
      const cl = r.left + r.width / 2 - w / 2
      setPos({ top: r.bottom + 6, left: Math.max(margin, Math.min(cl, window.innerWidth - w - margin)) })
    }
    setOpen(true)
  }

  return (
    <>
      <button ref={btnRef} onClick={openMenu}
        className="h-8 rounded-lg border border-line bg-navy px-3 font-sora text-xs font-semibold text-white hover:border-blue hover:text-blue transition-colors select-none whitespace-nowrap">
        {active.label}
        <span className="ml-1.5 text-[9px] text-soft">▼</span>
      </button>

      {open && pos && (
        <Menu value={value} pos={pos}
          onSelect={h => { onChange(h); setOpen(false) }}
          onClose={() => { setOpen(false); setPos(null) }} />
      )}
    </>
  )
}

function Menu({ value, pos, onSelect, onClose }: {
  value:    Hierarchy
  pos:      { top: number; left: number }
  onSelect: (h: Hierarchy) => void
  onClose:  () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(pos.top)
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    const margin = 8
    let t = pos.top
    if (t + el.offsetHeight > window.innerHeight - margin) t = window.innerHeight - el.offsetHeight - margin
    setTop(Math.max(margin, t))
  }, [pos.top])

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 animate-fade-in" onClick={onClose} />
      <div ref={panelRef}
        className="fixed z-[61] w-[220px] rounded-2xl bg-card border border-line shadow-2xl p-1.5 animate-fade-in-scale"
        style={{ top, left: pos.left }}>
        {OPTIONS.map(o => {
          const sel = o.value === value
          return (
            <button key={o.value} onClick={() => onSelect(o.value)}
              className={cn('w-full rounded-xl px-3 py-2.5 text-left transition-colors',
                sel ? 'bg-blue/15' : 'hover:bg-panel')}>
              <div className="flex items-center justify-between">
                <span className={cn('font-sora text-sm font-semibold', sel ? 'text-blue' : 'text-white')}>
                  {o.label}
                </span>
                {sel && <span className="font-sora text-xs text-blue">✓</span>}
              </div>
              <p className="mt-0.5 font-dm text-[11px] text-muted">{o.hint}</p>
            </button>
          )
        })}
      </div>
    </>
  )
}
