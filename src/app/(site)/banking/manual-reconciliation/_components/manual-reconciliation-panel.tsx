'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  clearManualBankLinesAction,
  removeStatementEvidenceAttachmentAction,
  saveStatementEvidenceAction
} from '../actions'
import { UploadButton } from '@/lib/uploadthing'

export type ManualBankLine = {
  id: string
  date: string
  reference: string
  description: string
  debit: string
  credit: string
}

type BankAccountOption = {
  id: string
  label: string
}

type StatementEvidence = {
  id: string
  statementBalance: string
  statementAttachmentUrl: string | null
  statementAttachmentName: string | null
  statementAttachmentKey: string | null
  reconciledAt?: Date | null
  reconciledByName?: string | null
}

function parseAmount(value: string) {
  const parsed = Number(value.replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)
}

function signedLedgerMovement(line: ManualBankLine) {
  return Number(line.debit ?? 0) - Number(line.credit ?? 0)
}

function formatTimestamp(value: Date) {
  return value.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export function ManualReconciliationPanel({
  accounts,
  selectedAccountId,
  selectedAccountLabel,
  financialYearId,
  financialYearLabel,
  statementDate,
  statementBalance,
  statementEvidence,
  ledgerBalance,
  lines
}: {
  accounts: BankAccountOption[]
  selectedAccountId: string
  selectedAccountLabel: string
  financialYearId: string
  financialYearLabel: string
  statementDate: string
  statementBalance: string
  statementEvidence: StatementEvidence | null
  ledgerBalance: number
  lines: ManualBankLine[]
}) {
  const router = useRouter()
  const [accountId, setAccountId] = useState(selectedAccountId)
  const [date, setDate] = useState(statementDate)
  const [balance, setBalance] = useState(statementBalance)
  const [reference, setReference] = useState('')
  const [evidence, setEvidence] = useState(statementEvidence)
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(
    new Set()
  )
  const [isClearing, setIsClearing] = useState(false)
  const [isSavingEvidence, setIsSavingEvidence] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingSession, startSessionTransition] = useTransition()

  const selectedLines = useMemo(
    () => lines.filter(line => selectedLineIds.has(line.id)),
    [lines, selectedLineIds]
  )

  const remainingUnclearedMovement = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          selectedLineIds.has(line.id) ? sum : sum + signedLedgerMovement(line),
        0
      ),
    [lines, selectedLineIds]
  )

  const calculatedClearedBalance = ledgerBalance - remainingUnclearedMovement
  const difference = parseAmount(balance) - calculatedClearedBalance
  const selectedReceipts = selectedLines.reduce(
    (sum, line) => sum + Number(line.debit ?? 0),
    0
  )
  const selectedPayments = selectedLines.reduce(
    (sum, line) => sum + Number(line.credit ?? 0),
    0
  )

  function updateSearch(nextAccountId: string, nextDate: string) {
    const params = new URLSearchParams()
    params.set('bankNominalCodeId', nextAccountId)
    params.set('statementDate', nextDate)
    startSessionTransition(() => {
      router.push(`/banking/manual-reconciliation?${params.toString()}`)
    })
  }

  function toggleLine(lineId: string) {
    setSelectedLineIds(current => {
      const next = new Set(current)
      if (next.has(lineId)) {
        next.delete(lineId)
      } else {
        next.add(lineId)
      }
      return next
    })
  }

  function toggleAll() {
    setSelectedLineIds(current =>
      current.size === lines.length ? new Set() : new Set(lines.map(line => line.id))
    )
  }

  async function handleClearSelected() {
    if (isClearing) return

    if (!selectedLineIds.size) {
      toast.error('Select at least one bank line to mark cleared.')
      return
    }

    setIsClearing(true)

    try {
      const result = await clearManualBankLinesAction({
        financialYearId,
        bankNominalCodeId: accountId,
        statementDate: date,
        statementBalance: balance,
        reconciliationReference: reference,
        lineIds: Array.from(selectedLineIds)
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(
        `${result.clearedCount} bank item${
          result.clearedCount === 1 ? '' : 's'
        } cleared.`
      )
      setSelectedLineIds(new Set())
      setReference('')
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : 'Could not mark the selected bank lines cleared.'
      )
    } finally {
      setIsClearing(false)
    }
  }

  async function saveUploadedStatement(file: {
    ufsUrl: string
    name: string
    key: string
  }) {
    setIsSavingEvidence(true)

    try {
      const result = await saveStatementEvidenceAction({
        financialYearId,
        bankNominalCodeId: accountId,
        statementDate: date,
        statementBalance: balance,
        attachment: {
          url: file.ufsUrl,
          name: file.name,
          key: file.key
        }
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      setEvidence(result.evidence)
      toast.success('Statement PDF attached.')
      router.refresh()
    } catch {
      toast.error('Could not save the uploaded statement PDF.')
    } finally {
      setIsSavingEvidence(false)
    }
  }

  async function removeStatement() {
    if (!evidence?.id || isSavingEvidence) return

    setIsSavingEvidence(true)

    try {
      const result = await removeStatementEvidenceAttachmentAction({
        evidenceId: evidence.id
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      setEvidence(current =>
        current
          ? {
              ...current,
              statementAttachmentUrl: null,
              statementAttachmentName: null,
              statementAttachmentKey: null
            }
          : current
      )
      toast.success('Statement PDF removed.')
      router.refresh()
    } catch {
      toast.error('Could not remove the statement PDF.')
    } finally {
      setIsSavingEvidence(false)
    }
  }

  return (
    <div className='space-y-6'>
      <section className='rounded-lg border bg-white p-5 shadow-sm'>
        <div className='grid gap-4 lg:grid-cols-[minmax(220px,1fr)_180px_200px] lg:items-end'>
          <label className='grid gap-1.5 text-sm'>
            <span className='font-medium text-slate-900'>Bank account</span>
            <select
              value={accountId}
              disabled={isLoadingSession}
              onChange={event => {
                const nextAccountId = event.target.value
                setAccountId(nextAccountId)
                updateSearch(nextAccountId, date)
              }}
              className='rounded-md border bg-white px-3 py-2'
            >
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>

          <label className='grid gap-1.5 text-sm'>
            <span className='font-medium text-slate-900'>Statement date</span>
            <input
              type='date'
              value={date}
              disabled={isLoadingSession}
              onChange={event => {
                const nextDate = event.target.value
                setDate(nextDate)
                updateSearch(accountId, nextDate)
              }}
              className='rounded-md border bg-white px-3 py-2'
            />
          </label>

          <label className='grid gap-1.5 text-sm'>
            <span className='font-medium text-slate-900'>
              Statement balance
            </span>
            <input
              type='text'
              inputMode='decimal'
              value={balance}
              onChange={event => setBalance(event.target.value)}
              className='rounded-md border bg-white px-3 py-2 text-right'
              placeholder='0.00'
            />
          </label>
        </div>

        <p className='mt-3 text-sm text-slate-600'>
          {selectedAccountLabel} · Open financial year {financialYearLabel}
          {isLoadingSession ? ' · Loading reconciliation...' : ''}
        </p>

        {evidence ? (
          <div className='mt-4 flex flex-col gap-3 rounded-md border border-emerald-200 bg-emerald-50/40 p-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <span className='inline-flex rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900'>
                Existing reconciliation loaded
              </span>
              <p className='mt-2 text-sm text-slate-700'>
                {evidence.reconciledAt
                  ? `Reconciled ${formatTimestamp(evidence.reconciledAt)}${
                      evidence.reconciledByName
                        ? ` by ${evidence.reconciledByName}`
                        : ''
                    }.`
                  : 'Statement evidence is saved for this bank account and date.'}
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Link
                href={`/banking/manual-reconciliation/${evidence.id}`}
                className='rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-emerald-50/40'
              >
                View reconciliation
              </Link>
              {evidence.statementAttachmentUrl ? (
                <a
                  href={evidence.statementAttachmentUrl}
                  target='_blank'
                  rel='noreferrer'
                  className='rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-emerald-50/40'
                >
                  Open statement PDF
                </a>
              ) : null}
              <Link
                href={`/banking/manual-reconciliation/${evidence.id}`}
                className='rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-emerald-50/40'
              >
                Undo cleared items
              </Link>
            </div>
          </div>
        ) : null}

        <div className='mt-4 rounded-md border bg-emerald-50/20 p-3'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0'>
              <p className='text-sm font-medium text-slate-900'>
                Bank statement PDF
              </p>
              {evidence?.statementAttachmentUrl &&
              evidence.statementAttachmentName ? (
                <a
                  href={evidence.statementAttachmentUrl}
                  target='_blank'
                  rel='noreferrer'
                  title={evidence.statementAttachmentName}
                  className='mt-1 block truncate text-sm font-medium text-emerald-800 hover:underline'
                >
                  {evidence.statementAttachmentName}
                </a>
              ) : (
                <p className='mt-1 text-sm text-slate-600'>
                  Attach the PDF used for this statement date. No PDF parsing is
                  performed.
                </p>
              )}
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              {evidence?.statementAttachmentKey ? (
                <button
                  type='button'
                  disabled={isSavingEvidence || isUploading}
                  onClick={removeStatement}
                  className='rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-emerald-50/40 disabled:opacity-50'
                >
                  Remove
                </button>
              ) : null}

              <UploadButton
                endpoint='statementPdfUploader'
                disabled={isSavingEvidence}
                onUploadBegin={() => setIsUploading(true)}
                onClientUploadComplete={files => {
                  const file = files[0]
                  setIsUploading(false)

                  if (file) {
                    void saveUploadedStatement(file)
                  }
                }}
                onUploadError={error => {
                  setIsUploading(false)
                  toast.error(error.message || 'Statement upload failed.')
                }}
                appearance={{
                  button:
                    'rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
                  allowedContent: 'hidden'
                }}
                content={{
                  button:
                    isUploading || isSavingEvidence
                      ? 'Saving...'
                      : evidence?.statementAttachmentKey
                        ? 'Replace PDF'
                        : 'Upload PDF'
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-slate-500'>Ledger bank balance</p>
          <p className='mt-1 text-xl font-semibold'>
            {formatCurrency(ledgerBalance)}
          </p>
        </div>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-slate-500'>Selected to clear</p>
          <p className='mt-1 text-xl font-semibold'>
            {formatCurrency(selectedReceipts - selectedPayments)}
          </p>
          <p className='mt-1 text-xs text-slate-500'>
            Receipts {formatCurrency(selectedReceipts)} · Payments{' '}
            {formatCurrency(selectedPayments)}
          </p>
        </div>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-slate-500'>Calculated cleared balance</p>
          <p className='mt-1 text-xl font-semibold'>
            {formatCurrency(calculatedClearedBalance)}
          </p>
        </div>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-slate-500'>Difference to statement</p>
          <p
            className={`mt-1 text-xl font-semibold ${
              Math.round(difference * 100) === 0 ? '' : 'text-red-600'
            }`}
          >
            {formatCurrency(difference)}
          </p>
        </div>
      </section>

      <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
        <div className='flex flex-col gap-4 border-b px-5 py-4 md:flex-row md:items-end md:justify-between'>
          <div>
            <h2 className='text-base font-semibold text-slate-950'>
              Uncleared manual bank receipts and payments
            </h2>
            <p className='mt-1 text-sm text-slate-600'>
              Select items that appear on the statement dated {date}.
            </p>
          </div>

          <div className='flex flex-col gap-2 sm:flex-row sm:items-end'>
            <label className='grid gap-1 text-sm'>
              <span className='font-medium text-slate-700'>
                Reconciliation reference
              </span>
              <input
                value={reference}
                onChange={event => setReference(event.target.value)}
                className='rounded-md border px-3 py-2'
                placeholder='Statement page or note'
              />
            </label>
            <button
              type='button'
              disabled={isClearing || !selectedLineIds.size}
              onClick={handleClearSelected}
              className='rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
            >
              {isClearing ? 'Marking cleared...' : 'Mark selected cleared'}
            </button>
          </div>
        </div>

        {lines.length === 0 ? (
          <div className='p-8 text-sm text-slate-600'>
            No uncleared manual bank items exist for this account and statement
            date.{' '}
            <Link
              href='/reports/bank-reconciliation'
              className='font-medium text-emerald-800 hover:underline'
            >
              Return to Bank Reconciliation
            </Link>
            .
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[760px] text-sm'>
              <thead className='bg-emerald-50/30 text-left text-slate-600'>
                <tr>
                  <th className='w-12 px-4 py-3'>
                    <input
                      type='checkbox'
                      checked={selectedLineIds.size === lines.length}
                      onChange={toggleAll}
                      aria-label='Select all uncleared manual bank lines'
                    />
                  </th>
                  <th className='px-4 py-3 font-medium'>Date</th>
                  <th className='px-4 py-3 font-medium'>Reference</th>
                  <th className='px-4 py-3 font-medium'>Description</th>
                  <th className='px-4 py-3 text-right font-medium'>Receipt</th>
                  <th className='px-4 py-3 text-right font-medium'>Payment</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.id} className='border-t hover:bg-emerald-50/30'>
                    <td className='px-4 py-3'>
                      <input
                        type='checkbox'
                        checked={selectedLineIds.has(line.id)}
                        onChange={() => toggleLine(line.id)}
                        aria-label={`Mark ${line.reference} cleared`}
                      />
                    </td>
                    <td className='px-4 py-3 whitespace-nowrap'>{line.date}</td>
                    <td className='px-4 py-3 font-mono text-xs'>
                      {line.reference}
                    </td>
                    <td className='px-4 py-3'>{line.description}</td>
                    <td className='px-4 py-3 text-right text-green-700'>
                      {Number(line.debit) > 0
                        ? formatCurrency(Number(line.debit))
                        : '—'}
                    </td>
                    <td className='px-4 py-3 text-right text-red-700'>
                      {Number(line.credit) > 0
                        ? formatCurrency(Number(line.credit))
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
