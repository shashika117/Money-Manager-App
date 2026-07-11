// src/lib/analyticsScope.ts
//
// The single source of truth for the Analytics page's drill model. The
// donut, column chart, area chart and history table all derive their
// parameters from one `Focus` value + the tab + (spend) hierarchy.
//
//   Focus         = what the user last clicked (or 'total' = nothing).
//   donutView()   = which buckets the donut/column show right now.
//   resolveScope()= which single series the area chart + table focus on.
//
// Step 4 keeps a small stack of Focus values so the donut back-arrow can
// pop one level; everything else is pure derivation from the current Focus.

export type AnalyticsTab = 'spend' | 'earn'
export type Hierarchy    = 'group' | 'category'            // spend tab only
export type Dimension    = 'group' | 'category' | 'subcategory'

export type Focus =
  | { kind: 'total' }
  | { kind: 'group';       name: string }                       // Needs | Wants | Save
  | { kind: 'category';    name: string; group?: string }       // group set if reached via By group
  | { kind: 'subcategory'; name: string; category: string; group?: string }

export interface DonutView {
  dimension:      Dimension
  filterGroup:    string | null
  filterCategory: string | null
}

// ── Which buckets does the donut/column display for the current focus? ──
export function donutView(tab: AnalyticsTab, hierarchy: Hierarchy, focus: Focus): DonutView {
  if (tab === 'earn') {
    // Income: always category slices, no drill.
    return { dimension: 'category', filterGroup: null, filterCategory: null }
  }
  switch (focus.kind) {
    case 'total':
      return { dimension: hierarchy, filterGroup: null, filterCategory: null }
    case 'group':
      // Save is terminal → the donut stays on the group view.
      return focus.name === 'Save'
        ? { dimension: 'group', filterGroup: null, filterCategory: null }
        : { dimension: 'category', filterGroup: focus.name, filterCategory: null }
    case 'category':
      return { dimension: 'subcategory', filterGroup: null, filterCategory: focus.name }
    case 'subcategory':
      // Subcategory is terminal → stay on its parent category's children.
      return { dimension: 'subcategory', filterGroup: null, filterCategory: focus.category }
  }
}

export interface ScopeKey { scope: string; key: string | null }

// ── Which single series do the area chart + history table focus on? ──
export function resolveScope(tab: AnalyticsTab, hierarchy: Hierarchy, focus: Focus): ScopeKey {
  if (tab === 'earn') {
    return focus.kind === 'category'
      ? { scope: 'earn_category', key: focus.name }
      : { scope: 'earn_total', key: null }
  }
  switch (focus.kind) {
    case 'total':       return { scope: hierarchy === 'group' ? 'spend_total_nws' : 'spend_total_cats', key: null }
    case 'group':       return { scope: 'group',       key: focus.name }
    case 'category':    return { scope: 'category',    key: focus.name }
    case 'subcategory': return { scope: 'subcategory', key: focus.name }
  }
}

export function isTotalScope(scope: string): boolean {
  return scope === 'spend_total_nws' || scope === 'spend_total_cats' || scope === 'earn_total'
}

// ── Clicking a bucket: is it terminal (no drill), and what's the new focus? ──
export function isTerminalClick(view: DonutView, bucket: string): boolean {
  if (view.dimension === 'subcategory') return true
  if (view.dimension === 'group' && bucket === 'Save') return true
  return false
}

export function focusOnClick(tab: AnalyticsTab, view: DonutView, bucket: string): Focus {
  if (tab === 'earn') return { kind: 'category', name: bucket }        // select income category (no drill)
  if (view.dimension === 'group')    return { kind: 'group', name: bucket }
  if (view.dimension === 'category') return { kind: 'category', name: bucket, group: view.filterGroup ?? undefined }
  return { kind: 'subcategory', name: bucket, category: view.filterCategory!, group: view.filterGroup ?? undefined }
}

// Best-effort parent (Step 4 should prefer a Focus stack for exact back-nav).
export function parentFocus(focus: Focus): Focus {
  switch (focus.kind) {
    case 'total':       return { kind: 'total' }
    case 'group':       return { kind: 'total' }
    case 'category':    return focus.group ? { kind: 'group', name: focus.group } : { kind: 'total' }
    case 'subcategory': return { kind: 'category', name: focus.category, group: focus.group }
  }
}

// A short human label for the current focus (breadcrumb / area-chart title).
export function focusLabel(focus: Focus): string {
  switch (focus.kind) {
    case 'total':       return 'All'
    case 'group':       return focus.name
    case 'category':    return focus.name
    case 'subcategory': return focus.name
  }
}

// ════════════════════════════════════════════════════════════════════
// PERIOD / DATE HELPERS  (months are 'YYYY-MM'; day-1 dates are 'YYYY-MM-01')
// ════════════════════════════════════════════════════════════════════

export const MAX_RANGE_MONTHS = 6

export function ym(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}`
}

export function currentYM(): string {
  const n = new Date()
  return ym(n.getFullYear(), n.getMonth() + 1)
}

export function firstOfMonth(ymKey: string): string {
  return `${ymKey}-01`
}

export function splitYM(ymKey: string): { year: number; month: number } {
  const [y, m] = ymKey.split('-').map(Number)
  return { year: y, month: m }
}

export function addMonths(ymKey: string, delta: number): string {
  const { year, month } = splitYM(ymKey)
  const d = new Date(year, month - 1 + delta, 1)
  return ym(d.getFullYear(), d.getMonth() + 1)
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}

// Inclusive list of month keys from start..end (start ≤ end assumed).
export function enumerateMonths(startYM: string, endYM: string): string[] {
  const out: string[] = []
  let cur = startYM
  // guard against runaway loops
  for (let i = 0; i < 240 && cur <= endYM; i++) {
    out.push(cur)
    cur = addMonths(cur, 1)
  }
  return out
}

// Half-open [start, endExclusive) day-1 bounds for a list of month keys.
export function periodBounds(months: string[]): { start: string; endExclusive: string } {
  const first = months[0]
  const last  = months[months.length - 1]
  return { start: firstOfMonth(first), endExclusive: firstOfMonth(addMonths(last, 1)) }
}

// The real current month's prior-3-month window (constant → cache-friendly).
export function priorThreeBounds(): { start: string; endExclusive: string; months: string[] } {
  const cur = currentYM()
  const start = firstOfMonth(addMonths(cur, -3))
  const endExclusive = firstOfMonth(cur)
  const months = [addMonths(cur, -1), addMonths(cur, -2), addMonths(cur, -3)]
  return { start, endExclusive, months }
}

// Compact label for a single month ('YYYY-MM' → 'Jul 2026').
export function monthLabel(ymKey: string): string {
  const { year, month } = splitYM(ymKey)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Short label for a column-chart axis / month-card ('YYYY-MM' → 'Jul').
export function monthShort(ymKey: string): string {
  const { year, month } = splitYM(ymKey)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}