// src/lib/analyticsColors.ts
//
// Color system for the Analytics page.
//   • Groups (locked):  Needs = pink, Wants = amber, Save = cyan.
//   • Categories/subcategories: a fixed curated palette, assigned by a
//     stable hash of the name so a given category keeps the SAME color
//     across months (and across the donut, column chart, and legend).
//   • "Other" (the column chart's top-6 spill bucket) is always muted.

export const GROUP_COLORS: Record<string, string> = {
  Needs: '#ec4899', // pink
  Wants: '#f59e0b', // amber
  Save:  '#22d3ee', // cyan
}

export const OTHER_COLOR = '#4b5563' // muted slate

// Curated, visually distinct palette (no pink/amber/cyan clashes with the
// group colors). 18 entries keeps collisions rare for a household's set.
const CATEGORY_PALETTE = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#14b8a6', // teal
  '#ef4444', // red
  '#eab308', // yellow
  '#8b5cf6', // violet
  '#06b6d4', // sky-cyan
  '#f97316', // orange
  '#10b981', // emerald
  '#6366f1', // indigo
  '#84cc16', // lime
  '#e11d48', // rose
  '#0ea5e9', // sky
  '#d946ef', // fuchsia
  '#f43f5e', // rose-red
  '#0891b2', // dark cyan
  '#65a30d', // dark lime
]

// Deterministic string hash → stable index into the palette.
function hashString(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function categoryColor(name: string): string {
  if (name === 'Other') return OTHER_COLOR
  return CATEGORY_PALETTE[hashString(name) % CATEGORY_PALETTE.length]
}

// Resolve a bucket's color for a given donut dimension.
//   dimension 'group' → group colors (Needs/Wants/Save)
//   otherwise         → stable category palette
export function bucketColor(dimension: 'group' | 'category' | 'subcategory', name: string): string {
  if (dimension === 'group') return GROUP_COLORS[name] ?? categoryColor(name)
  return categoryColor(name)
}

// Muted variant (used to dim non-hovered slices / legend rows).
// Appends a low alpha to a #rrggbb color.
export function muted(hex: string, alpha = 0.22): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0')
  return `${hex}${a}`
}