// src/lib/goalFormat.ts
// Shared formatters for the Goals page.

export function fmtAmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

export function fmtSignedAmt(n: number): string {
  const s = n < 0 ? '−' : ''
  return s + fmtAmt(n)
}

export function fmtCompact(n: number): string {
  const a = Math.abs(n)
  const s = n < 0 ? '−' : ''
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toFixed(2)} Mn`
  if (a >= 1_000)     return `${s}${(a / 1_000).toFixed(1)}K`
  return `${s}${a.toFixed(0)}`
}

export function fmtDateFull(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function fmtMonthYear(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', year: 'numeric',
  })
}

// Pace pill styling (ahead=green, on_track=cyan, behind=amber)
export type Pace = 'ahead' | 'on_track' | 'behind' | null
export function paceStyle(pace: Pace): { label: string; cls: string } | null {
  switch (pace) {
    case 'ahead':    return { label: 'ahead',    cls: 'border-green/40 bg-green/10 text-green' }
    case 'on_track': return { label: 'on-track', cls: 'border-cyan/40  bg-cyan/10  text-cyan' }
    case 'behind':   return { label: 'behind',   cls: 'border-amber/40 bg-amber/10 text-amber' }
    default:         return null
  }
}