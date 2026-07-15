// src/lib/budgetFormat.ts
// Shared formatters + progress-bar colour logic for the Budget page.

// ── Standard amount: 100,000.00 — no sign, no currency ─────────────
export function fmtAmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ── Standard amount: 100,000.00 — with sign, no currency ─────────────
export function fmtAmtSigned(n: number): string {
  return n.toLocaleString('en-US', {
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
  return n > 0 ? 'text-green' : n === 0 ? 'text-soft' : 'text-red'
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

// ── Progress colour logic ──────────────────────────────────────────
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
const CYAN  = [34,  211, 238]  // #22d3ee   — Savings identity colour

function blend(c1: number[], c2: number[], t: number): string {
  return hex(lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t))
}

/**
 * Returns the solid bar colour for a given progress ratio.
 * * expense → amber (<= 100%) or red (> 100%)
 * income  → static green (never changes)
 * saving  → static cyan (never changes)
 */
export function progressColor(ratio: number, kind: ProgressKind): string {
  if (kind === 'expense') {
    // Over 100% turns solid Red, otherwise stays solid Amber
    return ratio > 1 
      ? hex(RED[0], RED[1], RED[2]) 
      : hex(AMBER[0], AMBER[1], AMBER[2])
  }

  if (kind === 'saving') {
    // Dynamic changes removed — locked completely to identity Cyan
    return hex(CYAN[0], CYAN[1], CYAN[2])
  }

  // income: Dynamic changes removed — locked completely to identity Green
  return hex(GREEN[0], GREEN[1], GREEN[2])
}

// NWS score colour: red (low) → amber → green (near 100)
// Kept intact as a smooth gradient transition for overarching layout health KPIs
export function nwsColor(score: number): string {
  const t = Math.max(0, Math.min(1, score / 100))
  if (t < 0.5) return blend(RED, AMBER, t / 0.5)
  return blend(AMBER, GREEN, (t - 0.5) / 0.5)
}

// ── Savings actual sign colour ─────────────────────────────────────
// Saving actual: white when ≥ 0 (money saved), red when < 0 (withdrawal).
export function savingActualColor(n: number): string {
  return n < 0 ? 'text-red' : 'text-soft'
}

// ── Income "remaining to earn" colour ──────────────────────────────
export function incomeRemainingColor(n: number): string {
  return n != 0 ? 'text-green' : 'text-soft'
}

// ── Savings "remaining to save" colour ─────────────────────────────
export function savingRemainingColor(n: number): string {
  return n != 0 ? 'text-cyan' : 'text-soft'
}

// ── Expense "remaining to spend" colour ─────────────────────────────
export function expenseRemainingColor(n: number): string {
  return n > 0 ? 'text-amber' : n === 0 ? 'text-soft' : 'text-red'
}