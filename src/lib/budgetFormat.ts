// Shared formatters + progress-bar colour logic for the Budget page.
 
// ── Standard amount: 100,000.00 — no sign, no currency ─────────────
export function fmtAmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
 
// ── Compact for charts: 3.5K / 1.2 Mn ──────────────────────────────
export function fmtCompact(n: number): string {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${(a / 1_000_000).toFixed(2)} Mn`
  if (a >= 1_000)     return `${(a / 1_000).toFixed(1)}K`
  return a.toFixed(0)
}
 
// ── Sign-based colour: green ≥ 0, red < 0 ──────────────────────────
export function signColor(n: number): string {
  return n < 0 ? 'text-red' : 'text-green'
}
 
// ── Month helpers ──────────────────────────────────────────────────
export function monthKey(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}-01`
}
export function monthLabel(monthStr: string): string {
  return new Date(monthStr + 'T00:00:00')
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
export function parseMonthKey(monthStr: string): { year: number; month: number } {
  const [y, m] = monthStr.split('-').map(Number)
  return { year: y, month: m }
}
 
// ── Today-marker position (0..1) — only meaningful for current month ─
export function todayMarkerRatio(monthStr: string): number | null {
  const now = new Date()
  const { year, month } = parseMonthKey(monthStr)
  // Only show when the selected month IS the real current month
  if (year !== now.getFullYear() || month !== now.getMonth() + 1) return null
  const daysInMonth = new Date(year, month, 0).getDate()
  return now.getDate() / daysInMonth
}
 
// ── Progress colour transition ─────────────────────────────────────
// ratio = actual / effectiveBudget  (0..1+, clamp for colour)
//
// kind = 'expense' → green (low) → amber → red (over)   [spending]
// kind = 'income'  → red  (low) → amber → green (met)    [earning]
// kind = 'saving'  → red  (low) → amber → green (met)    [saving]
//
// Returns a hex colour for inline style (smooth gradient interpolation).
export type ProgressKind = 'expense' | 'income' | 'saving'
 
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function hex(r: number, g: number, b: number) {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}
 
// Anchor colours
const RED   = [239, 68,  68]   // #ef4444
const AMBER = [245, 158, 11]   // #f59e0b
const GREEN = [16,  185, 129]  // #10b981
 
function blend(c1: number[], c2: number[], t: number): string {
  return hex(lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t))
}
 
/**
 * Returns the bar colour for a given progress ratio.
 * ratio is clamped 0..1 for colour purposes (over-budget stays at the end colour).
 */
export function progressColor(ratio: number, kind: ProgressKind): string {
  const t = Math.max(0, Math.min(1, ratio))
 
  if (kind === 'expense') {
    // green → amber → red
    if (t < 0.5) return blend(GREEN, AMBER, t / 0.5)
    return blend(AMBER, RED, (t - 0.5) / 0.5)
  }
  // income & saving: red → amber → green
  if (t < 0.5) return blend(RED, AMBER, t / 0.5)
  return blend(AMBER, GREEN, (t - 0.5) / 0.5)
}
 
// NWS score colour: red (low) → amber → green (near 100)
export function nwsColor(score: number): string {
  return progressColor(Math.max(0, Math.min(1, score / 100)), 'saving')
}
 