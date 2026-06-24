import { cn } from '@/lib/utils'

interface FABProps {
  onClick: () => void
}

export function FAB({ onClick }: FABProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Add transaction"
      className={cn(
        'fixed right-5 z-40',
        'h-14 w-14 rounded-full',
        'bg-green shadow-lg shadow-green/30',
        'flex items-center justify-center',
        'font-sora text-2xl font-light text-white',
        'transition-all active:scale-90 touch-manipulation',
        // Mobile: clears bottom nav (56px) + safe area (~34px) + 8px gap ≈ 98px
        // bottom-24 = 96px, close enough and Tailwind-native.
        'bottom-24',
        // Desktop: no bottom nav, just 24px from the bottom edge
        'md:bottom-6',
      )}
    >
      +
    </button>
  )
}
