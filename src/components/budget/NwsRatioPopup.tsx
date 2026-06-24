// Editable popup for the global NWS base values. Opens at the position
// of the NWS-ratio button in the top header. The user edits Needs and
// Wants; Save is derived live as 100 − Needs − Wants and shown read-only.
// Save persists via update_nws_base (server re-derives + validates).

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useNwsSettings, useUpdateNwsBase } from '@/hooks/useNwsSettings'

interface NwsRatioPopupProps {
  anchorRect: DOMRect
  onClose:    () => void
}

export function NwsRatioPopup({ anchorRect, onClose }: NwsRatioPopupProps) {
  const { data: settings } = useNwsSettings()
  const update = useUpdateNwsBase()
  const ref = useRef<HTMLDivElement>(null)

  const [needs, setNeeds] = useState<number>(settings?.needs_base ?? 55)
  const [wants, setWants] = useState<number>(settings?.wants_base ?? 20)

  // Sync when settings load
  useEffect(() => {
    if (settings) { setNeeds(settings.needs_base); setWants(settings.wants_base) }
  }, [settings])

  const save = Math.round((100 - needs - wants) * 100) / 100
  const invalid = needs < 0 || wants < 0 || save < 0

  // Outside click / Esc
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  async function handleSave() {
    if (invalid) return
    try {
      await update.mutateAsync({ needs, wants })
      onClose()
    } catch (e) {
      console.error('update_nws_base failed:', e)
    }
  }

  // Position below-left of the button, clamped
  const width = 300, margin = 8
  let left = anchorRect.right - width
  if (left < margin) left = margin
  const top = anchorRect.bottom + 6

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 animate-fade-in" onMouseDown={onClose} />
      <div
        ref={ref}
        className="fixed z-[61] rounded-2xl border border-line bg-card shadow-2xl p-4 animate-fade-in-scale"
        style={{ left, top, width }}
      >
        <p className="font-sora text-sm font-bold text-white mb-1">NWS Base Ratios</p>
        <p className="font-dm text-[10px] text-soft mb-4">
          Target split used to score every month. Must total 100.
        </p>

        <Field label="Needs base" value={needs} onChange={setNeeds} accent="green" />
        <Field label="Wants base" value={wants} onChange={setWants} accent="blue" />

        {/* Save (derived, read-only) */}
        <div className="mb-4">
          <label className="mb-1 block font-dm text-[10px] uppercase tracking-wider text-soft">
            Save base (auto)
          </label>
          <div className={cn(
            'flex items-center justify-between rounded-xl border bg-navy/40 px-3 py-2.5',
            save < 0 ? 'border-red' : 'border-line',
          )}>
            <span className={cn('font-sora text-base font-bold', save < 0 ? 'text-red' : 'text-amber')}>
              {save.toFixed(2)}
            </span>
            <span className="font-dm text-[10px] text-muted">100 − Needs − Wants</span>
          </div>
        </div>

        {invalid && (
          <p className="mb-2 font-dm text-[10px] text-red">
            Needs + Wants cannot exceed 100.
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-line py-2.5 font-dm text-xs text-soft hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={invalid || update.isPending}
            className={cn(
              'flex-1 rounded-xl py-2.5 font-sora text-xs font-semibold text-white transition-all',
              invalid || update.isPending ? 'bg-green/40 cursor-not-allowed' : 'bg-green hover:opacity-90 active:scale-95',
            )}>
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}

function Field({ label, value, onChange, accent }: {
  label: string; value: number; onChange: (n: number) => void; accent: 'green' | 'blue'
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block font-dm text-[10px] uppercase tracking-wider text-soft">{label}</label>
      <input
        type="number" min={0} max={100} step={1} value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={cn(
          'w-full rounded-xl border border-line bg-panel px-3 py-2.5',
          'font-sora text-base text-white outline-none transition-colors',
          accent === 'green' ? 'focus:border-green' : 'focus:border-blue',
        )}
      />
    </div>
  )
}
