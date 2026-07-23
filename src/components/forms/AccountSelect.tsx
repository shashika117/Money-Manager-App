// src/components/forms/AccountSelect.tsx
//
// Custom dropdown replacing the plain native <select> for account
// pickers. Groups accounts into three sections so a two-person
// household isn't scrolling one long flat list every time:
//
//   Your accounts        — always expanded
//   Common accounts       — collapsed by default, tap to reveal
//   {Spouse}'s accounts   — collapsed by default, tap to reveal
//
// Not a native form element — wire it up with react-hook-form's
// <Controller>, not register().

import { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useHouseholdProfiles } from '@/hooks/useHouseholdProfiles'
import { bucketOf } from '@/lib/accountOwnership'
import type { Account } from '@/hooks/useAccounts'

interface AccountSelectProps {
  accounts:          Account[]
  value:             string
  onChange:          (value: string) => void
  placeholder:       string
  /** Hide this master_account entirely from every section (e.g. the other leg of a transfer). */
  excludeAccount?:   string
  error?:            boolean
  /** Full Tailwind class, e.g. 'focus:border-blue' — passed as a literal
   *  string (not interpolated) so Tailwind's build doesn't purge it. */
  focusColorClass:   string
  disabled?:         boolean
  /** Adds a pinned "no selection" row at the top of the list — used by
   *  GoalFormPanel's optional account link, where clearing back to "" is
   *  a valid choice (unlike the transaction forms, where an account is
   *  always required). */
  allowNone?:        boolean
  noneLabel?:        string
  /** Accounts to still SHOW but not let the user pick (e.g. already
   *  linked to a different goal) — rendered dimmed with `disabledSuffix`
   *  appended. Different from `excludeAccount`, which removes an account
   *  from the list entirely. */
  disabledAccounts?: Set<string>
  disabledSuffix?:   string
}

// ── 1. Memoized Individual Account Row (Instant Hover Response) ──
const AccountRow = memo(function AccountRow({
  account,
  isSelected,
  isDisabled,
  disabledSuffix,
  onPick,
}: {
  account: Account
  isSelected: boolean
  isDisabled: boolean
  disabledSuffix?: string
  onPick: (masterAccount: string) => void
}) {
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => !isDisabled && onPick(account.master_account)}
      className={cn(
        'w-full flex items-center justify-between px-4 py-2.5 text-left font-dm text-sm',
        isDisabled
          ? 'text-muted cursor-not-allowed'
          : isSelected
          ? 'bg-blue/25 text-white font-medium'
          : 'text-white hover:bg-blue/25 active:bg-blue/30',
      )}
    >
      <span className="truncate">
        {account.master_account}
        {isDisabled && disabledSuffix ? disabledSuffix : ''}
      </span>
      {isSelected && !isDisabled && (
        <span className="text-xs text-green flex-none ml-2">✓</span>
      )}
    </button>
  )
})

// ── 2. Memoized Group Toggle Button ──
const GroupToggle = memo(function GroupToggle({
  label,
  expanded,
  onToggle,
}: {
  label: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-2 font-dm text-[11px] uppercase tracking-wider text-muted hover:text-white hover:bg-panel/60"
    >
      <span>{label}</span>
      <span className="text-[10px]">{expanded ? '▲' : '▼'}</span>
    </button>
  )
})

// ── 3. Memoized Account Group Section ──
const AccountGroup = memo(function AccountGroup({
  label,
  accounts,
  selected,
  onPick,
  disabledAccounts,
  disabledSuffix,
}: {
  label?: string
  accounts: Account[]
  selected: string
  onPick: (v: string) => void
  disabledAccounts?: Set<string>
  disabledSuffix?: string
}) {
  return (
    <div>
      {label && (
        <p className="px-4 pt-2 pb-1 font-dm text-[11px] uppercase tracking-wider text-muted">
          {label}
        </p>
      )}
      {accounts.map(acc => {
        const isDisabled = disabledAccounts?.has(acc.master_account) ?? false
        return (
          <AccountRow
            key={acc.id}
            account={acc}
            isSelected={selected === acc.master_account}
            isDisabled={isDisabled}
            disabledSuffix={disabledSuffix}
            onPick={onPick}
          />
        )
      })}
    </div>
  )
})

export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder,
  excludeAccount,
  error,
  focusColorClass,
  disabled,
  allowNone,
  noneLabel,
  disabledAccounts,
  disabledSuffix,
}: AccountSelectProps) {
  const { user } = useAuth()
  const { data: profiles = [] } = useHouseholdProfiles()
  const myId = user?.id ?? null
  const spouseName = profiles.find(p => p.id !== myId)?.display_name ?? 'Partner'

  const [open, setOpen] = useState(false)
  const [showCommon, setShowCommon] = useState(false)
  const [showSpouse, setShowSpouse] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Reopening always starts back at "only yours expanded" — it shouldn't
  // remember an expanded state from a transaction three forms ago.
  const toggleOpen = useCallback(() => {
    if (disabled) return
    setOpen(o => {
      if (!o) {
        setShowCommon(false)
        setShowSpouse(false)
      }
      return !o
    })
  }, [disabled])

  // Memoize account bucket filtering so it only recalculates when accounts change
  const { mine, common, spouse } = useMemo(() => {
    const visible = excludeAccount
      ? accounts.filter(a => a.master_account !== excludeAccount)
      : accounts

    return {
      mine: visible.filter(a => bucketOf(a.owner_id, myId) === 'mine'),
      common: visible.filter(a => bucketOf(a.owner_id, myId) === 'common'),
      spouse: visible.filter(a => bucketOf(a.owner_id, myId) === 'spouse'),
    }
  }, [accounts, excludeAccount, myId])

  const pick = useCallback(
    (masterAccount: string) => {
      onChange(masterAccount)
      setOpen(false)
    },
    [onChange]
  )

  const toggleCommon = useCallback(() => setShowCommon(s => !s), [])
  const toggleSpouse = useCallback(() => setShowSpouse(s => !s), [])
  const pickNone = useCallback(() => pick(''), [pick])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between rounded-xl border bg-panel px-4 py-3 text-left',
          'font-dm text-sm outline-none transition-colors duration-100',
          focusColorClass,
          value ? 'text-white' : 'text-muted',
          error ? 'border-red' : 'border-line',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <span className="pointer-events-none text-soft text-xs flex-none ml-2">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-line bg-navy shadow-xl overflow-hidden duration-100 animate-fade-in">
          <div className="max-h-72 overflow-y-auto py-1">
            {allowNone && (
              <button
                type="button"
                onClick={pickNone}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2.5 text-left font-dm text-sm border-b border-line/60',
                  value === '' ? 'bg-panel text-white font-medium' : 'text-soft hover:bg-panel/60',
                )}
              >
                <span className="truncate">{noneLabel ?? 'No selection'}</span>
                {value === '' && <span className="text-xs text-green flex-none ml-2">✓</span>}
              </button>
            )}

            {mine.length > 0 && (
              <AccountGroup
                label="Your accounts"
                accounts={mine}
                selected={value}
                onPick={pick}
                disabledAccounts={disabledAccounts}
                disabledSuffix={disabledSuffix}
              />
            )}

            {common.length > 0 && (
              <GroupToggle
                label={`Common accounts (${common.length})`}
                expanded={showCommon}
                onToggle={toggleCommon}
              />
            )}
            {common.length > 0 && showCommon && (
              <AccountGroup
                accounts={common}
                selected={value}
                onPick={pick}
                disabledAccounts={disabledAccounts}
                disabledSuffix={disabledSuffix}
              />
            )}

            {spouse.length > 0 && (
              <GroupToggle
                label={`${spouseName}'s accounts (${spouse.length})`}
                expanded={showSpouse}
                onToggle={toggleSpouse}
              />
            )}
            {spouse.length > 0 && showSpouse && (
              <AccountGroup
                accounts={spouse}
                selected={value}
                onPick={pick}
                disabledAccounts={disabledAccounts}
                disabledSuffix={disabledSuffix}
              />
            )}

            {mine.length === 0 && common.length === 0 && spouse.length === 0 && (
              <p className="px-4 py-3 font-dm text-xs text-soft">No accounts available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}