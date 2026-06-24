import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely (handles conflicts). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number as Sri Lankan Rupees. */
export function formatRs(
  amount: number,
  options: { decimals?: boolean; sign?: boolean } = {}
): string {
  const { decimals = false, sign = false } = options
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })
  const prefix = sign && amount > 0 ? '+' : amount < 0 ? '−' : ''
  return `${prefix}Rs ${formatted}`
}

/** Return the first day of a month as a DATE string (YYYY-MM-01). */
export function firstOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** Return start and end DATE strings for a given month (for Supabase queries). */
export function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = firstOfMonth(year, month)
  const end   = new Date(year, month, 0).toISOString().slice(0, 10)  // last day
  return { start, end }
}
/**
 * Returns today's date as 'YYYY-MM-DD' using the user's LOCAL timezone.
 * Never use new Date().toISOString().slice(0,10) — that returns UTC,
 * which is wrong for timezones like Sri Lanka (UTC+5:30).
 */
export function todayLocal(): string {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}