// src/components/home/AccountBalancesCard.tsx
//
// Frequently-used accounts + their current balances. Rows are inert
// (no click action, per spec). The ⌄ picker chooses which active
// accounts appear; the choice is household-shared and persisted.
//
// Default when nothing has been configured: the first 5 active accounts
// by sort_order.

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { fmtAmt } from '@/lib/budgetFormat'
import { useAccountBalances } from '@/hooks/useAccountBalances'
import { useHomePrefs, useSetHomePref } from '@/hooks/useHomePrefs'
import { HomeCard, CheckboxPicker } from '@/components/home/HomeCard'

const DEFAULT_COUNT = 5

export function AccountBalancesCard() {
  const { data: accounts = [], isLoading } = useAccountBalances()
  const { data: prefs } = useHomePrefs()
  const setPref = useSetHomePref()

  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null)

  // v_account_balances is already ordered by group, then sort_order.
  const allNames = useMemo(() => accounts.map(a => a.master_account), [accounts])

  // undefined = never configured → default. [] = deliberately empty → respect it.
  const selected = useMemo(() => {
    if (prefs?.accounts !== undefined) return prefs.accounts
    return allNames.slice(0, DEFAULT_COUNT)
  }, [prefs?.accounts, allNames])

  const selSet = new Set(selected)
  const rows = useMemo(
    () => accounts.filter(a => selSet.has(a.master_account)),
    [accounts, selected],   // eslint-disable-line react-hooks/exhaustive-deps
  )

  function toggle(name: string) {
    const next = selSet.has(name)
      ? selected.filter(n => n !== name)
      : [...selected, name]
    setPref.mutate({ key: 'accounts', value: next })
  }

  return (
    <HomeCard
      title="Account Balances"
      subtitle={`${rows.length} of ${accounts.length} accounts`}
      to="/accounts"
      onOpenPicker={setPickerRect}
    >
      <div className="px-2 pb-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-green border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-2 py-6 text-center font-dm text-xs text-muted">
            No accounts selected. Use ⌄ to pick some.
          </p>
        ) : (
          <div className="flex flex-col">
            {rows.map(a => (
              <div key={a.master_account}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2">
                <span className="font-dm text-xs text-white truncate">{a.master_account}</span>
                <span className={cn(
                  'font-sora text-xs font-semibold tabular-nums flex-none',
                  a.current_balance < 0 ? 'text-red' : 'text-green',
                )}>
                  {fmtAmt(a.current_balance)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {pickerRect && (
        <CheckboxPicker
          title="Show accounts"
          options={allNames}
          selected={selected}
          rect={pickerRect}
          onToggle={toggle}
          onClose={() => setPickerRect(null)}
        />
      )}
    </HomeCard>
  )
}
