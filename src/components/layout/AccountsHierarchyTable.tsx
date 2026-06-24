/**
 * AccountsHierarchyTable — three isolated card sections:
 *  1. Net Worth card
 *  2. Assets card  (collapsible groups + categories)
 *  3. Liability card (collapsible groups + categories)
 *
 * All labels sit on the same left vertical line (px-4 throughout).
 * Visual hierarchy is expressed only through typography, not indent.
 *
 * Category rows: semi-transparent background, muted text
 * Account rows:  subtle dark fill, white text, green left-border when selected
 */

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { AccountBalance } from '@/hooks/useAccountBalances'


// ── Helpers ───────────────────────────────────────────────────────
function fmtAmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function amtCls(n: number) { return n < 0 ? 'text-red' : 'text-green' }

// ── Hierarchy builder ─────────────────────────────────────────────
interface CatNode   { name: string; total: number; accounts: AccountBalance[] }
interface GroupNode { name: string; total: number; categories: CatNode[] }

function buildHierarchy(rows: AccountBalance[]): GroupNode[] {
  const gMap = new Map<string, Map<string, AccountBalance[]>>()
  for (const r of rows) {
    if (!gMap.has(r.account_group))    gMap.set(r.account_group, new Map())
    const cm = gMap.get(r.account_group)!
    if (!cm.has(r.account_category))   cm.set(r.account_category, [])
    cm.get(r.account_category)!.push(r)
  }
  return ['Assets', 'Liability']
    .filter(g => gMap.has(g))
    .map(gName => {
      const cm = gMap.get(gName)!
      const cats: CatNode[] = Array.from(cm.entries())
        .map(([cName, accts]) => {
          const s = [...accts].sort((a, b) => a.sort_order - b.sort_order)
          return { name: cName, total: s.reduce((sum, a) => sum + a.current_balance, 0), accounts: s }
        })
        .sort((a, b) => a.accounts[0].sort_order - b.accounts[0].sort_order)
      return { name: gName, total: cats.reduce((s, c) => s + c.total, 0), categories: cats }
    })
}

// ── Props ─────────────────────────────────────────────────────────
interface Props {
  rows:            AccountBalance[]
  netWorth:        number
  selectedAccount: string | null
  onSelectAccount: (a: string) => void
  isLoading:       boolean
}

// ── Component ─────────────────────────────────────────────────────
export function AccountsHierarchyTable({
  rows, netWorth, selectedAccount, onSelectAccount, isLoading,
}: Props) {
  const groups = useMemo(() => buildHierarchy(rows), [rows])

  // Collapse state: Set<groupName> and Set<"group|cat">
  const [collG, setCollG] = useState<Set<string>>(new Set())
  const [collC, setCollC] = useState<Set<string>>(new Set())

  const toggleG = (n: string) =>
    setCollG(p => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s })
  const toggleC = (g: string, c: string) => {
    const k = `${g}|${c}`
    setCollC(p => { const s = new Set(p); s.has(k) ? s.delete(k) : s.add(k); return s })
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-green border-t-transparent" />
    </div>
  )

  return (
    <div className="flex flex-col gap-3 p-3 pb-4">

      {/* ══ SECTION 1: NET WORTH ══════════════════════════════════ */}
      <div className="rounded-2xl border border-line bg-card px-4 py-4 flex items-center justify-between">
        <span className="font-dm text-[11px] uppercase tracking-widest text-muted">Net Worth</span>
        <span className={cn('font-sora text-2xl font-bold', amtCls(netWorth))}>
          {fmtAmt(netWorth)}
        </span>
      </div>

      {/* ══ SECTIONS 2 & 3: ASSETS + LIABILITY ══════════════════ */}
      {groups.map(group => {
        const gCol = collG.has(group.name)
        // Assets section is green-tinted; Liability is red-tinted
        const headerAccent = group.name === 'Assets' ? 'text-green' : 'text-red'
       /*
        const borderAccent  = group.name === 'Assets'
          ? 'border-green/20 hover:border-green/40'
          : 'border-red/20 hover:border-red/40'

          */

        return (
          <div key={group.name} className={cn(
            'rounded-2xl border overflow-hidden transition-colors',
            group.name === 'Assets' ? 'border-green/20' : 'border-red/15',
          )}>

            {/* Group header — click entire row to expand/collapse */}
            <button
              onClick={() => toggleG(group.name)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-card hover:bg-panel/30 transition-colors touch-manipulation"
            >
              <span className="font-sora text-sm font-bold text-white">{group.name}</span>
              <span className={cn('font-sora text-sm font-bold', headerAccent)}>
                {fmtAmt(group.total)}
              </span>
            </button>

            {/* Categories + accounts */}
            {!gCol && group.categories.map((cat) => {
              const cKey = `${group.name}|${cat.name}`
              const cCol = collC.has(cKey)

              return (
                <div key={cat.name}>

                  {/* Full-width divider between categories */}
                  <div className="h-px bg-line/80" />

                  {/* Category row — click to expand/collapse accounts */}
                  <button
                    onClick={() => toggleC(group.name, cat.name)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-panel/20 hover:bg-panel/20 transition-colors touch-manipulation"
                  >
                    <span className="font-dm text-xs font-semibold text-soft ">{cat.name}</span>
                    <span className={cn('font-dm text-xs font-medium', amtCls(cat.total))}>
                      {fmtAmt(cat.total)}
                    </span>
                  </button>

                  {/* Account rows */}
                  {!cCol && cat.accounts.map((acc, ai) => {
                    const isSel = selectedAccount === acc.master_account
                    return (
                      
                      <button
                        key={acc.master_account}
                        onClick={() => onSelectAccount(acc.master_account)}
                        className={cn(
                          'w-full flex items-center justify-between px-4 py-2.5 touch-manipulation transition-colors',
                          'border-l-[0px]',
                          ai > 0 && 'border-t-2 border-line/15',
                          isSel
                            ? 'bg-green/10 border-l-green'
                            : 'bg-navy/25 border-l-transparent hover:bg-navy/40',
                        )}
                      >
                        <span className={cn('font-dm text-m py-0.5', isSel ? 'text-green font-semibold' : 'text-white')}>
                          {acc.master_account}
                        </span>
                        <span className={cn('font-dm font-semibold text-sm', amtCls(acc.current_balance))}>
                          {fmtAmt(acc.current_balance)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
