import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/hooks/useTransactions'
import { useTransferGroup, useLoanPaymentGroup } from '@/hooks/useEditTransaction'
import {
  useDeleteRegularTransaction,
  useDeleteSinkingFundExpense,
  useDeleteTransfer,
} from '@/hooks/useDeleteTransaction'
import { useDeleteLoanPayment } from '@/hooks/useLoanPaymentMutations'
import { EditTransactionForm } from '@/components/forms/EditTransactionForm'
import { EditTransferForm }    from '@/components/forms/EditTransferForm'
import { EditLoanPaymentForm } from '@/components/forms/EditLoanPaymentForm'

// ── Helpers ────────────────────────────────────────────────────────
function fmtAmt(amount: number): string {
  return Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}
function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

// ── Group name badge ───────────────────────────────────────────────
function GroupBadge({ group }: { group: string }) {
  const styles: Record<string, string> = {
    'Needs':         'border-blue/40  bg-blue/10  text-blue',
    'Wants':         'border-amber/40 bg-amber/10 text-amber',
    'Sinking Funds': 'border-pink/40  bg-pink/10  text-pink',
  }
  const cls = styles[group]
  if (!cls) return null
  return (
    <span className={cn(
      'inline-block rounded-full border px-2 py-0.5 font-dm text-xs font-medium', cls,
    )}>
      {group}
    </span>
  )
}

// ── Rollover badge ─────────────────────────────────────────────────
function RolloverBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 font-dm text-xs font-medium text-amber">
      ↻ Rollover
    </span>
  )
}

// ── Single detail row ──────────────────────────────────────────────
function DetailField({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-line/50">
      <span className="font-dm text-xs font-medium uppercase tracking-wider text-soft flex-none">
        {label}
      </span>
      <div className="text-right">{children}</div>
    </div>
  )
}

// ── Spinner ────────────────────────────────────────────────────────
function Spinner({ color = 'blue' }: { color?: string }) {
  return (
    <div className={`h-4 w-4 animate-spin rounded-full border-2 border-${color} border-t-transparent`} />
  )
}

// ── Types ──────────────────────────────────────────────────────────
type PanelMode = 'detail' | 'confirm_delete' | 'edit_txn' | 'edit_transfer' | 'edit_loan'

interface Props {
  transaction: Transaction | null
  onClose:     () => void
}

// ── Component ──────────────────────────────────────────────────────
export function TransactionDetailPanel({ transaction, onClose }: Props) {
  const [mode, setMode] = useState<PanelMode>('detail')
  const [isClosing, setIsClosing] = useState(false)

  function handleClose() {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 240)
  }

  function handleBackdropOrX() {
    if (mode !== 'detail') {
      setMode('detail')
    } else {
      handleClose()
    }
  }

  useEffect(() => {
    if (transaction) setMode('detail')
      setIsClosing(false)
  }, [transaction?.id])

  // True for both Transfer In/Out rows AND Fee rows — all belong to a transfer group
  const isAnyTransferRow = !!(
    transaction && (transaction.is_transfer || transaction.is_transfer_fee)
  )

  // True for ANY row in a loan-payment group — the synthetic merged row
  // in the browse view, OR a raw capital/interest/liability row in a
  // filtered view. flagLoanPaymentRows() in useTransactions.ts sets
  // is_loan_payment on all of them, so detection works in every view.
  const isLoanPayment = !!(transaction && transaction.is_loan_payment)

  // Fetch all rows in the transfer group as soon as the panel opens.
  const { data: transferGroup, isLoading: tgLoading } = useTransferGroup(
    isAnyTransferRow ? transaction?.transfer_group_id : null
  )

  // Fetch the loan-payment group (capital + interest + liability leg) the same way.
  const { data: loanPaymentGroup, isLoading: lpLoading } = useLoanPaymentGroup(
    isLoanPayment ? transaction?.transfer_group_id : null
  )

  const deleteRegular      = useDeleteRegularTransaction()
  const deleteSinkingFund  = useDeleteSinkingFundExpense()
  const deleteTransfer     = useDeleteTransfer()
  const deleteLoanPayment  = useDeleteLoanPayment()
  const isDeleting = deleteRegular.isPending
    || deleteSinkingFund.isPending
    || deleteTransfer.isPending
    || deleteLoanPayment.isPending

  if (!transaction) return null

  // ── Delete handler ───────────────────────────────────────────────
  async function handleDelete() {
    if (!transaction) return
    try {
      if (isLoanPayment && transaction.transfer_group_id) {
        await deleteLoanPayment.mutateAsync(transaction.transfer_group_id)
      } else if (isAnyTransferRow && transaction.transfer_group_id) {
        await deleteTransfer.mutateAsync(transaction.transfer_group_id)
      } else if (transaction.is_sinking_funds) {
        await deleteSinkingFund.mutateAsync(transaction.id)
      } else {
        await deleteRegular.mutateAsync(transaction.id)
      }
      onClose()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  // ── Amount to display in detail view ────────────────────────────
  const detailAmount =
    isLoanPayment
      ? (loanPaymentGroup
          ? loanPaymentGroup.capital_amount + loanPaymentGroup.interest_amount
          : Math.abs(transaction.singed_amount))
      : transaction.is_transfer && !transaction.is_transfer_fee
        ? (transferGroup?.amount ?? Math.abs(transaction.singed_amount))
        : Math.abs(transaction.singed_amount)

  const detailAmountColor =
    isLoanPayment
      ? 'text-red'
      : transaction.is_transfer && !transaction.is_transfer_fee
        ? 'text-soft'
        : transaction.amount_color === 'green' ? 'text-green'
        : transaction.amount_color === 'red'   ? 'text-red'
        : 'text-soft'

  // ── Human-readable type label ────────────────────────────────────
  const typeLabel =
    isLoanPayment                ? 'Loan Payment'
    : transaction.is_transfer_fee ? 'Transfer Fee'
    : isAnyTransferRow            ? 'Transfer'
    : transaction.txn_type

  const typeColor =
    isLoanPayment       ? 'text-amber'
    : isAnyTransferRow  ? 'text-soft'
    : transaction.txn_type === 'Income' ? 'text-green'
    : 'text-red'

  // ── Render ──────────────────────────────────────────────────────
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/70',
          isClosing ? 'animate-fade-out' : 'animate-fade-in',
        )}
        onClick={handleBackdropOrX}
        aria-hidden="true"
      />

      <div className={cn(
        'fixed z-50 bg-card flex flex-col overflow-hidden',
        'bottom-0 left-0 right-0 rounded-t-2xl max-h-[90dvh]',
        'md:inset-y-0 md:left-auto md:right-0',
        'md:w-96 md:rounded-none md:rounded-l-2xl md:max-h-none md:h-full',
        'md:border-l md:border-line',
        isClosing
          ? 'animate-slide-down md:animate-slide-out-right'
          : 'animate-slide-up  md:animate-slide-in-right',
      )}>

        <div className="flex justify-center pt-3 pb-1 md:hidden flex-none">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-line flex-none">
          <h2 className="font-sora text-base font-semibold text-white">
            {mode === 'confirm_delete'
              ? 'Confirm Delete'
              : mode === 'edit_txn' || mode === 'edit_transfer' || mode === 'edit_loan'
                ? 'Edit Transaction'
                : 'Transaction Details'}
          </h2>
          <button
            onClick={handleBackdropOrX}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel font-dm text-soft hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto px-5 pt-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
        >

          {/* ═══════════════════ MODE: DETAIL ═══════════════════ */}
          {mode === 'detail' && (
            <>
              <DetailField label="Date">
                <span className="font-dm text-sm text-white">{fmtDate(transaction.date)}</span>
              </DetailField>

              <DetailField label="Type">
                <span className={cn('font-sora text-sm font-semibold', typeColor)}>
                  {typeLabel}
                </span>
              </DetailField>

              {/* ── LOAN PAYMENT FIELDS ── */}
              {isLoanPayment ? (
                lpLoading ? (
                  <DetailField label="Loan Payment"><Spinner color="amber" /></DetailField>
                ) : loanPaymentGroup ? (
                  <>
                    <DetailField label="From Account">
                      <span className="font-dm text-sm text-white">{loanPaymentGroup.from_account}</span>
                    </DetailField>
                    <DetailField label="Loan Account">
                      <span className="font-dm text-sm text-white">{loanPaymentGroup.loan_account}</span>
                    </DetailField>
                    <DetailField label="Capital">
                      <span className="font-dm text-sm text-white">Rs {fmtAmt(loanPaymentGroup.capital_amount)}</span>
                    </DetailField>
                    {loanPaymentGroup.interest_amount > 0 && (
                      <DetailField label="Interest">
                        <span className="font-dm text-sm text-white">Rs {fmtAmt(loanPaymentGroup.interest_amount)}</span>
                      </DetailField>
                    )}
                  </>
                ) : null

              /* ── NON-TRANSFER, NON-LOAN FIELDS ── */
              ) : !isAnyTransferRow && (
                <>
                  <DetailField label="Category">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="font-dm text-sm text-white">{transaction.category}</span>
                      {transaction.txn_type === 'Expense' && (
                        <GroupBadge group={transaction.group_name} />
                      )}
                    </div>
                  </DetailField>

                  {transaction.display_subcategory && (
                    <DetailField label="Sub-Category">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="font-dm text-sm text-white">
                          {transaction.display_subcategory}
                        </span>
                        {transaction.rollover_enabled && <RolloverBadge />}
                      </div>
                    </DetailField>
                  )}

                  <DetailField label="Account">
                    <span className="font-dm text-sm text-white">{transaction.master_account}</span>
                  </DetailField>
                </>
              )}

              {/* ── TRANSFER-GROUP FIELDS (Transfer In, Transfer Out, Fee rows) ── */}
              {!isLoanPayment && isAnyTransferRow && (
                tgLoading ? (
                  <DetailField label="Transfer Details">
                    <Spinner />
                  </DetailField>
                ) : transferGroup ? (
                  <>
                    <DetailField label="From Account">
                      <span className="font-dm text-sm text-white">{transferGroup.from_account}</span>
                    </DetailField>

                    <DetailField label="To Account">
                      <span className="font-dm text-sm text-white">{transferGroup.to_account}</span>
                    </DetailField>

                    {!transaction.is_transfer_fee && transferGroup.fee > 0 && (
                      <DetailField label="Fee">
                        <span className="font-dm text-sm text-soft">
                          Rs {fmtAmt(transferGroup.fee)}
                        </span>
                      </DetailField>
                    )}

                    {!transaction.is_transfer_fee
                      && transferGroup.from_funds
                      && transferGroup.goal_name && (
                      <DetailField label="From Goal">
                        <span className="font-dm text-sm text-amber">{transferGroup.goal_name}</span>
                      </DetailField>
                    )}
                  </>
                ) : null
              )}

              {/* Amount */}
              <DetailField label="Amount">
                <span className={cn('font-sora text-base font-bold', detailAmountColor)}>
                  Rs {fmtAmt(detailAmount)}
                </span>
              </DetailField>

              {/* Goal (Sinking Funds expense only) */}
              {transaction.goal && (
                <DetailField label="Goal">
                  <span className="font-dm text-sm text-amber">{transaction.goal}</span>
                </DetailField>
              )}

              {/* Note */}
              {transaction.note && (
                <DetailField label="Note">
                  <span className="font-dm text-sm text-white max-w-[200px] break-words text-right">
                    {transaction.note}
                  </span>
                </DetailField>
              )}

              {/* ── Actions ── */}
              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={() => setMode(
                    isLoanPayment ? 'edit_loan' : isAnyTransferRow ? 'edit_transfer' : 'edit_txn'
                  )}
                  className="flex w-full items-center gap-3 rounded-xl bg-panel border border-line px-4 py-3.5 font-dm text-sm font-medium text-white transition-colors hover:border-green active:scale-[0.98]"
                >
                  <span className="text-lg">✏️</span>
                  Edit Transaction
                </button>

                <button
                  onClick={() => setMode('confirm_delete')}
                  className="flex w-full items-center gap-3 rounded-xl bg-red/10 border border-red/30 px-4 py-3.5 font-dm text-sm font-medium text-red transition-colors hover:bg-red/20 active:scale-[0.98]"
                >
                  <span className="text-lg">🗑️</span>
                  Delete Transaction
                </button>

                <button
                  onClick={handleClose}
                  className="w-full rounded-xl border border-line py-3 font-dm text-sm text-soft transition-colors hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* ═══════════════════ MODE: CONFIRM DELETE ═══════════════════ */}
          {mode === 'confirm_delete' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-4">
                <p className="font-sora text-sm font-semibold text-red mb-2">
                  Delete this transaction?
                </p>
                <p className="font-dm text-xs text-soft leading-relaxed">
                  {isLoanPayment
                    ? 'All linked rows (capital, interest if any, and the loan account credit) will be permanently deleted.'
                    : isAnyTransferRow
                      ? 'All linked transfer rows (Transfer In, Transfer Out, any fee, and any linked Goal transaction details) will be permanently deleted.'
                      : transaction.is_sinking_funds
                        ? 'This will also permanently remove the linked goal withdrawal entry.'
                        : 'This action cannot be undone.'}
                </p>
              </div>

              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={cn(
                  'w-full rounded-xl bg-red py-4 font-sora text-sm font-semibold text-white',
                  'transition-all active:scale-[0.98]',
                  isDeleting ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90',
                )}
              >
                {isDeleting ? 'Deleting…' : 'Yes, Delete'}
              </button>

              <button
                onClick={() => setMode('detail')}
                className="w-full rounded-xl border border-line py-3 font-dm text-sm text-soft hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}

          {/* ═══════════════════ MODE: EDIT TRANSACTION ═══════════════════ */}
          {mode === 'edit_txn' && (
            <EditTransactionForm
              transaction={transaction}
              onSuccess={onClose}
              onCancel={() => setMode('detail')}
            />
          )}

          {/* ═══════════════════ MODE: EDIT TRANSFER ═══════════════════ */}
          {mode === 'edit_transfer' && (
            tgLoading || !transferGroup ? (
              <div className="flex items-center justify-center py-10">
                <Spinner color="blue" />
              </div>
            ) : (
              <EditTransferForm
                transferData={transferGroup}
                onSuccess={onClose}
                onCancel={() => setMode('detail')}
              />
            )
          )}

          {/* ═══════════════════ MODE: EDIT LOAN PAYMENT ═══════════════════ */}
          {mode === 'edit_loan' && (
            lpLoading || !loanPaymentGroup ? (
              <div className="flex items-center justify-center py-10">
                <Spinner color="amber" />
              </div>
            ) : (
              <EditLoanPaymentForm
                data={loanPaymentGroup}
                onSuccess={onClose}
                onCancel={() => setMode('detail')}
              />
            )
          )}

        </div>
      </div>
    </>
  )
}
