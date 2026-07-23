// src/components/forms/Select.tsx

import { useEffect, useRef, useState, memo, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value:     string
  label:     string
  disabled?: boolean
}

interface SelectProps {
  options:         SelectOption[]
  value:           string
  onChange:        (value: string) => void
  placeholder:     string
  error?:          boolean
  focusColorClass: string
  disabled?:       boolean
  emptyLabel?:     string
}

// ── Memoized Option Row to Prevent Re-renders Across Items ───────
const OptionRow = memo(function OptionRow({
  opt,
  isSelected,
  onSelect,
}: {
  opt: SelectOption
  isSelected: boolean
  onSelect: (val: string) => void
}) {
  return (
    <button
      type="button"
      disabled={opt.disabled}
      onClick={() => !opt.disabled && onSelect(opt.value)}
      className={cn(
        'w-full flex items-center justify-between px-4 py-2.5 text-left font-dm text-sm',
        // Removed transition-colors for instant hover responsiveness
        opt.disabled
          ? 'text-muted cursor-not-allowed'
          : isSelected
          ? 'bg-blue/25 text-white font-medium'
          : 'text-white hover:bg-blue/20 active:bg-blue/30',
      )}
    >
      <span className="truncate">{opt.label}</span>
      {isSelected && !opt.disabled && (
        <span className="text-xs text-green flex-none ml-2">✓</span>
      )}
    </button>
  )
})

export function Select({
  options,
  value,
  onChange,
  placeholder,
  error,
  focusColorClass,
  disabled,
  emptyLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleOpen = useCallback(() => {
    if (!disabled) setOpen(o => !o)
  }, [disabled])

  const pick = useCallback(
    (optValue: string) => {
      onChange(optValue)
      setOpen(false)
    },
    [onChange]
  )

  const selectedLabel = options.find(o => o.value === value)?.label ?? ''

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between rounded-xl border bg-panel px-4 py-3 text-left',
          'font-dm text-sm outline-none transition-colors duration-100',
          focusColorClass,
          value ? 'text-white' : 'text-muted',
          error ? 'border-red' : 'border-line',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <span className="pointer-events-none text-soft text-xs flex-none ml-2">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-line bg-navy shadow-xl overflow-hidden duration-100 animate-fade-in">
          <div className="max-h-72 overflow-y-auto py-1">
            {options.length === 0 ? (
              <p className="px-4 py-3 font-dm text-xs text-soft">
                {emptyLabel ?? 'No options available.'}
              </p>
            ) : (
              options.map(opt => (
                <OptionRow
                  key={opt.value}
                  opt={opt}
                  isSelected={value === opt.value}
                  onSelect={pick}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}