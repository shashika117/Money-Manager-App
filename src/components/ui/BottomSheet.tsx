import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface BottomSheetProps {
  isOpen:   boolean
  onClose:  () => void
  title:    string
  children: React.ReactNode
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      setClosing(false)
    } else if (mounted) {
      setClosing(true)
      const t = setTimeout(() => { setMounted(false); setClosing(false) }, 240)
      return () => clearTimeout(t)
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null

  return (
    <div className={cn(
      'fixed inset-0 z-50',
      // Mobile: sheet rises from bottom centre
      'flex items-end justify-center',
      // Desktop: panel slides in from the right edge
      'md:items-stretch md:justify-end',
    )}>

      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/70',
          closing ? 'animate-fade-out' : 'animate-fade-in',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className={cn(
        'relative bg-card flex flex-col shadow-2xl',
        // Mobile: bottom sheet.
        // h-[92dvh] = FIXED height (not max-height).
        // Fixed height prevents the sheet from resizing when
        // the user switches between form tabs (Expense ↔ Transfer),
        // which caused the "jumping" bug on iPhone.
        'w-full max-w-lg rounded-t-2xl h-[92dvh]',
        // Desktop: full-height right panel
        'md:w-[480px] md:h-full md:max-h-none md:rounded-none md:rounded-l-2xl',
        // Mobile animation
        closing ? 'animate-slide-down' : 'animate-slide-up',
        // Desktop animation overrides (responsive prefix wins at md+)
        closing ? 'md:animate-slide-out-right' : 'md:animate-slide-in-right',
      )}>

        {/* Drag handle — mobile only */}
        <div className="flex shrink-0 justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-sora text-base font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel font-dm text-soft transition-colors hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content — fills the fixed height */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

      </div>
    </div>
  )
}