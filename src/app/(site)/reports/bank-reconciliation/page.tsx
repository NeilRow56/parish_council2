// src/app/reports/bank-reconciliation/page.tsx

import Link from 'next/link'
import { Fragment } from 'react/jsx-runtime'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql
} from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { user } from '@/db/schema/authSchema'

import {
  bankReconciliations,
  journalEntries,
  journalLines,
  nominalCodes,
  nominalOpeningBalances
} from '@/db/schema/nominalLedger'

import {
  bankConnections,
  bankOpeningBalances,
  bankTransactions
} from '@/db/schema'
import { ExportPdfButton } from './_components/export-pdf-button'
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'

function formatAmount(value: number) {
  if (value === 0) return '—'

  return value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatCurrency(value: number) {
  if (value === 0) return '£—'

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)
}

type SearchParams = {
  financialYearId?: string
}

function formatDifference(value: number) {
  if (value === 0) return '£—'

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `£(${amount})` : `£${amount}`
}

function formatSignedAmount(value: number) {
  if (value === 0) return '—'

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `(${amount})` : amount
}

function formatTimestamp(value: Date) {
  return value.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export default async function BankReconciliationPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>
}) {
  const params = await searchParams

  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId

  if (!parishCouncilId) {
    redirect('/auth/register')
  }

  const { financialYear } = await getSelectedFinancialYear(
    parishCouncilId,
    params?.financialYearId
  )

  if (!financialYear) {
    redirect('/')
  }

  const today = new Date().toISOString().slice(0, 10)
  const reconciliationDate =
    financialYear.isClosed || today > financialYear.endDate
      ? financialYear.endDate
      : today < financialYear.startDate
        ? financialYear.endDate
        : today

  const accounts = await db
    .select({
      connectionId: bankConnections.id,
      providerName: bankConnections.providerName,
      accountName: bankConnections.accountName,
      sortCode: bankConnections.sortCode,
      accountLast4: bankConnections.accountLast4,
      nominalCodeId: nominalCodes.id,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name,
      nominalOpeningBalance: sql<number>`coalesce(max(${nominalOpeningBalances.amount}), 0)`,
      bankOpeningBalance: sql<number>`coalesce(max(${bankOpeningBalances.openingBalance}), 0)`,

      ledgerDebit: sql<number>`
        coalesce(
          sum(
            case
              when ${journalEntries.id} is not null
              then ${journalLines.debit}
              else 0
            end
          ),
          0
        )
      `,

      ledgerCredit: sql<number>`
        coalesce(
          sum(
            case
              when ${journalEntries.id} is not null
              then ${journalLines.credit}
              else 0
            end
          ),
          0
        )
      `
    })
    .from(nominalCodes)
    .leftJoin(
      bankConnections,
      eq(bankConnections.nominalCodeId, nominalCodes.id)
    )
    .leftJoin(
      nominalOpeningBalances,
      and(
        eq(nominalOpeningBalances.nominalCodeId, nominalCodes.id),
        eq(nominalOpeningBalances.financialYearId, financialYear.id),
        eq(nominalOpeningBalances.parishCouncilId, parishCouncilId)
      )
    )
    .leftJoin(
      bankOpeningBalances,
      and(
        eq(bankOpeningBalances.nominalCodeId, nominalCodes.id),
        eq(bankOpeningBalances.financialYearId, financialYear.id),
        eq(bankOpeningBalances.parishCouncilId, parishCouncilId)
      )
    )
    .leftJoin(journalLines, eq(journalLines.nominalCodeId, nominalCodes.id))
    .leftJoin(
      journalEntries,
      and(
        eq(journalEntries.id, journalLines.journalEntryId),
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, financialYear.id)
      )
    )
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id),
        eq(nominalCodes.isBank, true)
      )
    )
    .groupBy(
      bankConnections.id,
      bankConnections.providerName,
      bankConnections.accountName,
      bankConnections.sortCode,
      bankConnections.accountLast4,
      bankConnections.nominalCodeId,
      nominalCodes.id,
      nominalCodes.code,
      nominalCodes.name
    )
    .orderBy(nominalCodes.code)

  const inboxItems = await db
    .select({
      id: bankTransactions.id,
      connectionId: bankTransactions.connectionId,
      transactionDate: bankTransactions.date,
      description: bankTransactions.description,
      amount: bankTransactions.amount,
      transactionType: bankTransactions.transactionType,
      status: bankTransactions.status
    })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.parishCouncilId, parishCouncilId),
        inArray(bankTransactions.status, ['PENDING', 'CODED']),
        lte(bankTransactions.date, reconciliationDate)
      )
    )
    .orderBy(desc(bankTransactions.date), desc(bankTransactions.importedAt))

  const matchedJournalRows = await db
    .select({
      journalEntryId: bankTransactions.matchedJournalEntryId
    })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.parishCouncilId, parishCouncilId),
        isNotNull(bankTransactions.matchedJournalEntryId)
      )
    )

  const matchedJournalEntryIds = new Set(
    matchedJournalRows
      .map(row => row.journalEntryId)
      .filter((id): id is string => Boolean(id))
  )

  const manualBankLedgerItems = (
    await db
      .select({
        journalEntryId: journalEntries.id,
        nominalCodeId: nominalCodes.id,
        nominalCode: nominalCodes.code,
        nominalName: nominalCodes.name,
        date: journalEntries.date,
        reference: journalEntries.reference,
        description: journalEntries.description,
        source: journalEntries.source,
        debit: journalLines.debit,
        credit: journalLines.credit
      })
      .from(journalLines)
      .innerJoin(
        journalEntries,
        eq(journalLines.journalEntryId, journalEntries.id)
      )
      .innerJoin(nominalCodes, eq(journalLines.nominalCodeId, nominalCodes.id))
      .where(
        and(
          eq(journalEntries.parishCouncilId, parishCouncilId),
          eq(journalEntries.financialYearId, financialYear.id),
          eq(journalEntries.source, 'MANUAL'),
          eq(nominalCodes.isBank, true),
          isNull(journalLines.clearedAt),
          lte(journalEntries.date, reconciliationDate)
        )
      )
      .orderBy(desc(journalEntries.date), desc(journalEntries.createdAt))
  ).filter(item => !matchedJournalEntryIds.has(item.journalEntryId))

  const showOpenYearActions = !financialYear.isClosed
  const ledgerLinkSuffix = params?.financialYearId
    ? `?financialYearId=${financialYear.id}`
    : ''

  const rows = accounts.map(account => {
    const accountInboxItems =
      account.connectionId
        ? inboxItems.filter(
            item => String(item.connectionId) === String(account.connectionId)
          )
        : []

    const accountLabel =
      account.accountName ||
      (account.nominalCode
        ? `${account.nominalCode} — ${account.nominalName}`
        : 'Bank account')

    const providerLabel = account.providerName
      ? `${account.providerName}${account.accountLast4 ? ` · ${account.accountLast4}` : ''}`
      : financialYear.isClosed
        ? 'Historic bank nominal code'
        : 'No linked bank connection'

    const inboxReceipts = accountInboxItems.reduce((sum, item) => {
      const amount = Math.abs(Number(item.amount ?? 0))
      const type = item.transactionType?.toUpperCase()

      return type === 'CREDIT' ? sum + amount : sum
    }, 0)

    const inboxPayments = accountInboxItems.reduce((sum, item) => {
      const amount = Math.abs(Number(item.amount ?? 0))
      const type = item.transactionType?.toUpperCase()

      return type === 'DEBIT' ? sum + amount : sum
    }, 0)

    const inboxNetMovement = inboxReceipts - inboxPayments

    const ledgerDebit = Number(account.ledgerDebit ?? 0)
    const ledgerCredit = Number(account.ledgerCredit ?? 0)
    const nominalOpeningBalance = Number(account.nominalOpeningBalance ?? 0)
    const bankOpeningBalance = Number(account.bankOpeningBalance ?? 0)
    const openingBalance =
      nominalOpeningBalance !== 0 ? nominalOpeningBalance : bankOpeningBalance
    const ledgerBalance = openingBalance + ledgerDebit - ledgerCredit
    const accountManualBankLedgerItems = manualBankLedgerItems.filter(
      item => String(item.nominalCodeId) === String(account.nominalCodeId)
    )
    const unmatchedManualNetMovement = accountManualBankLedgerItems.reduce(
      (sum, item) => sum + Number(item.credit ?? 0) - Number(item.debit ?? 0),
      0
    )
    const difference = inboxNetMovement + unmatchedManualNetMovement

    const adjustedBankBalance = ledgerBalance + difference

    return {
      ...account,
      accountLabel,
      providerLabel,
      ledgerDebit,
      ledgerCredit,
      openingBalance,
      ledgerBalance,
      inboxItems: accountInboxItems,
      manualBankLedgerItems: accountManualBankLedgerItems,
      inboxReceipts,
      inboxPayments,
      inboxNetMovement,
      unmatchedManualNetMovement,
      adjustedBankBalance,
      difference
    }
  })

  const totalInboxReceipts = rows.reduce(
    (sum, row) => sum + row.inboxReceipts,
    0
  )

  const totalInboxPayments = rows.reduce(
    (sum, row) => sum + row.inboxPayments,
    0
  )

  const totalInboxNetMovement = rows.reduce(
    (sum, row) => sum + row.inboxNetMovement,
    0
  )

  const totalUnmatchedManualNetMovement = rows.reduce(
    (sum, row) => sum + row.unmatchedManualNetMovement,
    0
  )

  const totalUnmatchedManualReceipts = rows.reduce(
    (sum, row) =>
      sum +
      row.manualBankLedgerItems.reduce(
        (itemSum, item) => itemSum + Number(item.debit ?? 0),
        0
      ),
    0
  )

  const totalUnmatchedManualPayments = rows.reduce(
    (sum, row) =>
      sum +
      row.manualBankLedgerItems.reduce(
        (itemSum, item) => itemSum + Number(item.credit ?? 0),
        0
      ),
    0
  )

  const totalLedgerBalance = rows.reduce(
    (sum, row) => sum + row.ledgerBalance,
    0
  )

  const totalAdjustedBankBalance = rows.reduce(
    (sum, row) => sum + row.adjustedBankBalance,
    0
  )

  const totalDifference = totalInboxNetMovement + totalUnmatchedManualNetMovement
  const unmatchedManualSummaryItems = rows.flatMap(row =>
    row.manualBankLedgerItems.map(item => ({
      ...item,
      accountLabel: row.accountLabel,
      signedAmount: Number(item.credit ?? 0) - Number(item.debit ?? 0)
    }))
  )
  const exportHref = `/reports/bank-reconciliation/export?financialYearId=${financialYear.id}`
  const reconciliationEvidence = await db
    .select({
      id: bankReconciliations.id,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name,
      statementDate: bankReconciliations.statementDate,
      statementBalance: bankReconciliations.statementBalance,
      statementAttachmentUrl: bankReconciliations.statementAttachmentUrl,
      statementAttachmentName: bankReconciliations.statementAttachmentName,
      reconciledAt: bankReconciliations.reconciledAt,
      reconciledByName: user.name,
      clearedItemCount: sql<number>`count(${journalLines.id})`,
      createdAt: bankReconciliations.createdAt,
      updatedAt: bankReconciliations.updatedAt
    })
    .from(bankReconciliations)
    .innerJoin(nominalCodes, eq(nominalCodes.id, bankReconciliations.bankNominalCodeId))
    .leftJoin(
      journalLines,
      eq(journalLines.reconciliationId, bankReconciliations.id)
    )
    .leftJoin(user, eq(user.id, bankReconciliations.reconciledByUserId))
    .where(
      and(
        eq(bankReconciliations.parishCouncilId, parishCouncilId),
        eq(bankReconciliations.financialYearId, financialYear.id),
        eq(nominalCodes.parishCouncilId, parishCouncilId)
      )
    )
    .groupBy(
      bankReconciliations.id,
      nominalCodes.code,
      nominalCodes.name,
      user.name
    )
    .orderBy(desc(bankReconciliations.updatedAt), desc(bankReconciliations.createdAt))

  return (
    <main className='mx-auto max-w-7xl px-6 py-8'>
      <div className='mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Bank Reconciliation
          </h1>
          <p className='mt-1 text-sm text-zinc-600'>
            Reconcile nominal ledger bank balances to adjusted bank balances
            after pending inbox and uncleared manual bank movements.
          </p>
          <p className='mt-2 text-sm text-zinc-500'>
            Financial year:{' '}
            <span className='font-medium text-zinc-700'>
              {financialYear.label}
            </span>
            <span className='ml-2 text-zinc-400'>
              Reconciliation date: {reconciliationDate}
            </span>
            {financialYear.isClosed ? (
              <span className='ml-2 rounded-full bg-emerald-100/30 px-2 py-0.5 text-xs font-medium text-zinc-700'>
                Closed / read-only
              </span>
            ) : null}
          </p>
        </div>

        <div className='flex flex-wrap gap-2'>
          <ExportPdfButton href={exportHref} />

          <Link
            href='/banking/manual-reconciliation'
            className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-emerald-50/40'
          >
            Manual reconciliation
          </Link>

          {showOpenYearActions ? (
            <>
              <Link
                href='/transactions/inbox'
                className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-emerald-50/40'
              >
                Transaction inbox
              </Link>

              <Link
                href='/bank-connections'
                className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-emerald-50/40'
              >
                Bank connections
              </Link>

            </>
          ) : null}
        </div>
      </div>

      <div className='mb-6 grid gap-4 md:grid-cols-5'>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Inbox receipts</p>
          <p className='mt-1 text-2xl font-semibold text-green-700'>
            {formatCurrency(totalInboxReceipts)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Inbox payments</p>
          <p className='mt-1 text-2xl font-semibold text-red-700'>
            {formatCurrency(totalInboxPayments)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Uncleared manual</p>
          <p
            className={
              Math.round(totalUnmatchedManualNetMovement * 100) === 0
                ? 'mt-1 text-2xl font-semibold'
                : 'mt-1 text-2xl font-semibold text-red-600'
            }
          >
            {formatDifference(totalUnmatchedManualNetMovement)}
          </p>

          <details className='mt-2 text-xs text-zinc-600'>
            <summary className='cursor-pointer font-medium text-blue-700 hover:underline'>
              Breakdown
            </summary>

            <div className='mt-2 space-y-1'>
              {unmatchedManualSummaryItems.length > 0 ? (
                <div className='mb-2 max-h-32 space-y-1 overflow-auto border-b pb-2'>
                  {unmatchedManualSummaryItems.map(item => (
                    <div
                      key={`${item.journalEntryId}-${item.nominalCodeId}`}
                      className='flex justify-between gap-3'
                    >
                      <span className='truncate'>
                        {item.reference} ·{' '}
                        {Number(item.credit ?? 0) > 0
                          ? 'manual payment'
                          : 'manual receipt'}
                      </span>
                      <span>{formatDifference(item.signedAmount)}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className='flex justify-between gap-3'>
                <span>Manual receipts</span>
                <span>{formatCurrency(totalUnmatchedManualReceipts)}</span>
              </div>
              <div className='flex justify-between gap-3'>
                <span>Manual payments</span>
                <span>{formatCurrency(totalUnmatchedManualPayments)}</span>
              </div>
              <div className='flex justify-between gap-3 border-t pt-1 font-medium text-zinc-900'>
                <span>Net</span>
                <span>{formatDifference(totalUnmatchedManualNetMovement)}</span>
              </div>
            </div>
          </details>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Reconciliation difference</p>
          <p
            className={
              Math.round(totalDifference * 100) === 0
                ? 'mt-1 text-2xl font-semibold'
                : 'mt-1 text-2xl font-semibold text-red-600'
            }
          >
            {formatDifference(totalDifference)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Adjusted bank balance</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatCurrency(totalAdjustedBankBalance)}
          </p>

          <details className='mt-2 text-xs text-zinc-600'>
            <summary className='cursor-pointer font-medium text-blue-700 hover:underline'>
              Breakdown
            </summary>

            <div className='mt-2 max-h-40 space-y-2 overflow-auto'>
              {rows.map(row => (
                <div
                  key={`adjusted-${row.nominalCodeId}`}
                  className='border-b pb-2 last:border-b-0 last:pb-0'
                >
                  <div className='flex justify-between gap-3 font-medium text-zinc-900'>
                    <span className='truncate'>
                      {row.accountLabel} · {row.nominalCode}
                    </span>
                    <span>{formatCurrency(row.adjustedBankBalance)}</span>
                  </div>
                  <div className='mt-1 grid grid-cols-3 gap-2 text-[11px] text-zinc-500'>
                    <span>Ledger {formatCurrency(row.ledgerBalance)}</span>
                    <span>
                      Inbox{' '}
                      {formatDifference(row.inboxNetMovement).replace('£', '')}
                    </span>
                    <span>
                      Manual{' '}
                      {formatDifference(
                        row.unmatchedManualNetMovement
                      ).replace('£', '')}
                    </span>
                  </div>
                </div>
              ))}

              <div className='flex justify-between gap-3 border-t pt-2 font-medium text-zinc-900'>
                <span>Total</span>
                <span>{formatCurrency(totalAdjustedBankBalance)}</span>
              </div>
            </div>
          </details>
        </div>
      </div>

      <section className='overflow-x-auto rounded-lg border bg-white shadow-sm'>
        {rows.length === 0 ? (
          <div className='p-10 text-center text-sm text-zinc-500'>
            No bank nominal codes found for this financial year.
          </div>
        ) : (
          <table className='w-full min-w-[1380px] table-fixed border-collapse text-sm'>
            <colgroup>
              <col className='w-64' />
              <col />
              <col className='w-40' />
              <col className='w-40' />
              <col className='w-40' />
              <col className='w-40' />
              <col className='w-40' />
              <col className='w-44' />
              <col className='w-44' />
            </colgroup>

            <thead className='bg-emerald-50/30 text-left text-zinc-600'>
              <tr>
                <th className='px-4 py-3 font-medium'>Bank account</th>
                <th className='px-4 py-3 font-medium'>Nominal code</th>
                <th className='px-4 py-3 text-right font-medium'>
                  Inbox receipts
                </th>
                <th className='px-4 py-3 text-right font-medium'>
                  Inbox payments
                </th>
                <th className='px-4 py-3 text-right font-medium'>Inbox net</th>
                <th className='px-4 py-3 text-right font-medium'>
                  Manual net
                </th>
                <th className='px-4 py-3 text-right font-medium'>
                  Reconciliation difference
                </th>
                <th className='px-4 py-3 text-right font-medium'>
                  Ledger balance
                </th>
                <th className='px-4 py-3 text-right font-medium'>
                  Adjusted bank balance
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map(row => {
                const reconciled = Math.round(row.difference * 100) === 0

                return (
                  <Fragment
                    key={
                      row.connectionId ??
                      row.nominalCodeId ??
                      `bank-code-${row.nominalCode}`
                    }
                  >
                    <tr className='border-t'>
                      <td className='px-4 py-3 align-top'>
                        <div className='font-medium'>
                          {row.accountLabel}
                        </div>

                        <div className='text-xs text-zinc-500'>
                          {row.providerLabel}
                        </div>

                        {row.openingBalance !== 0 ? (
                          <div className='mt-1 text-xs font-medium text-zinc-700'>
                            Opening balance:{' '}
                            {formatCurrency(row.openingBalance)}
                          </div>
                        ) : null}

                        {showOpenYearActions && row.connectionId ? (
                          <Link
                            href={`/transactions/inbox?connectionId=${row.connectionId}`}
                            className='mt-2 inline-block text-xs font-medium text-blue-700 hover:underline'
                          >
                            View {row.inboxItems.length} inbox item
                            {row.inboxItems.length === 1 ? '' : 's'}
                          </Link>
                        ) : null}
                      </td>

                      <td className='px-4 py-3 align-top'>
                        {row.nominalCodeId ? (
                          <Link
                            href={`/ledger/${row.nominalCodeId}${ledgerLinkSuffix}`}
                            className='text-zinc-700 hover:underline'
                          >
                            {row.nominalCode} — {row.nominalName}
                          </Link>
                        ) : (
                          <span className='text-red-600'>Setup needed</span>
                        )}
                      </td>

                      <td className='px-4 py-3 text-right align-top text-green-700'>
                        {formatAmount(row.inboxReceipts)}
                      </td>

                      <td className='px-4 py-3 text-right align-top text-red-700'>
                        {formatAmount(row.inboxPayments)}
                      </td>

                      <td className='px-4 py-3 text-right align-top'>
                        {formatDifference(row.inboxNetMovement).replace(
                          '£',
                          ''
                        )}
                      </td>

                      <td className='px-4 py-3 text-right align-top'>
                        {formatDifference(
                          row.unmatchedManualNetMovement
                        ).replace('£', '')}
                      </td>

                      <td className='px-4 py-3 text-right align-top'>
                        <div
                          className={
                            reconciled ? undefined : 'font-medium text-red-600'
                          }
                        >
                          {formatDifference(row.difference).replace('£', '')}
                        </div>
                      </td>

                      <td className='px-4 py-3 text-right align-top'>
                        {formatAmount(row.ledgerBalance)}
                      </td>

                      <td className='px-4 py-3 text-right align-top font-medium'>
                        {formatAmount(row.adjustedBankBalance)}
                      </td>
                    </tr>

                    <tr className='border-t bg-emerald-50/30'>
                      <td className='px-4 py-3' colSpan={9}>
                        <details>
                          <summary className='cursor-pointer text-xs font-medium text-blue-700 hover:underline'>
                            Explain reconciliation items for {row.accountLabel}
                          </summary>

                          <div className='mt-3 grid gap-4 text-xs text-zinc-700 lg:grid-cols-3'>
                            <div className='rounded-md border bg-white p-3 lg:col-span-2'>
                              <p className='font-medium text-zinc-900'>
                                Pending inbox movements
                              </p>

                              {row.inboxItems.length === 0 ? (
                                <p className='mt-1 text-zinc-500'>
                                  No pending inbox transactions for this
                                  account.
                                </p>
                              ) : (
                                <div className='mt-2 overflow-x-auto'>
                                  <table className='w-full min-w-[520px] text-xs'>
                                    <thead className='text-zinc-500'>
                                      <tr>
                                        <th className='py-1 pr-2 text-left font-medium'>
                                          Date
                                        </th>
                                        <th className='py-1 pr-2 text-left font-medium'>
                                          Description
                                        </th>
                                        <th className='py-1 pr-2 text-left font-medium'>
                                          Status
                                        </th>
                                        <th className='py-1 text-right font-medium'>
                                          Amount
                                        </th>
                                      </tr>
                                    </thead>

                                    <tbody>
                                      {row.inboxItems.map(item => (
                                        <tr key={item.id} className='border-t'>
                                          <td className='py-1 pr-2'>
                                            {item.transactionDate}
                                          </td>
                                          <td className='py-1 pr-2'>
                                            {item.description}
                                          </td>
                                          <td className='py-1 pr-2'>
                                            {item.status}
                                          </td>
                                          <td className='py-1 text-right'>
                                            {formatSignedAmount(
                                              Number(item.amount ?? 0)
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            <div className='rounded-md border bg-white p-3'>
                              <p className='font-medium text-zinc-900'>
                                Ledger balance components
                              </p>

                              <div className='mt-2 space-y-1'>
                                <div className='flex justify-between gap-3'>
                                  <span>Opening balance</span>
                                  <span>{formatCurrency(row.openingBalance)}</span>
                                </div>
                                <div className='flex justify-between gap-3'>
                                  <span>Current-year debits</span>
                                  <span>{formatCurrency(row.ledgerDebit)}</span>
                                </div>
                                <div className='flex justify-between gap-3'>
                                  <span>Current-year credits</span>
                                  <span>{formatCurrency(row.ledgerCredit)}</span>
                                </div>
                                <div className='flex justify-between gap-3 border-t pt-1 font-medium text-zinc-900'>
                                  <span>Ledger balance</span>
                                  <span>{formatCurrency(row.ledgerBalance)}</span>
                                </div>
                              </div>
                            </div>

                            <div className='rounded-md border bg-white p-3 lg:col-span-2'>
                              <p className='font-medium text-zinc-900'>
                                Uncleared manual bank ledger entries
                              </p>

                              {row.manualBankLedgerItems.length === 0 ? (
                                <p className='mt-1 text-zinc-500'>
                                  No uncleared manual bank entries for this
                                  account.
                                </p>
                              ) : (
                                <div className='mt-2 overflow-x-auto'>
                                  <table className='w-full min-w-[620px] text-xs'>
                                    <thead className='text-zinc-500'>
                                      <tr>
                                        <th className='py-1 pr-2 text-left font-medium'>
                                          Date
                                        </th>
                                        <th className='py-1 pr-2 text-left font-medium'>
                                          Reference
                                        </th>
                                        <th className='py-1 pr-2 text-left font-medium'>
                                          Description
                                        </th>
                                        <th className='py-1 pr-2 text-left font-medium'>
                                          Nominal/bank account
                                        </th>
                                        <th className='py-1 pr-2 text-left font-medium'>
                                          Source
                                        </th>
                                        <th className='py-1 pr-2 text-right font-medium'>
                                          Debit
                                        </th>
                                        <th className='py-1 text-right font-medium'>
                                          Credit
                                        </th>
                                      </tr>
                                    </thead>

                                    <tbody>
                                      {row.manualBankLedgerItems.map(item => (
                                        <tr
                                          key={`${item.journalEntryId}-${item.nominalCodeId}`}
                                          className='border-t'
                                        >
                                          <td className='py-1 pr-2'>
                                            {item.date}
                                          </td>
                                          <td className='py-1 pr-2'>
                                            {item.reference}
                                          </td>
                                          <td className='py-1 pr-2'>
                                            {item.description}
                                          </td>
                                          <td className='py-1 pr-2'>
                                            {item.nominalCode} —{' '}
                                            {item.nominalName}
                                          </td>
                                          <td className='py-1 pr-2'>
                                            {item.source}
                                          </td>
                                          <td className='py-1 pr-2 text-right'>
                                            {formatAmount(Number(item.debit))}
                                          </td>
                                          <td className='py-1 text-right'>
                                            {formatAmount(Number(item.credit))}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>

            <tfoot className='border-t bg-emerald-50/30 font-semibold'>
              <tr>
                <td className='px-4 py-3' colSpan={2}>
                  Totals
                </td>

                <td className='px-4 py-3 text-right text-green-700'>
                  {formatAmount(totalInboxReceipts)}
                </td>

                <td className='px-4 py-3 text-right text-red-700'>
                  {formatAmount(totalInboxPayments)}
                </td>

                <td className='px-4 py-3 text-right'>
                  {formatDifference(totalInboxNetMovement).replace('£', '')}
                </td>

                <td className='px-4 py-3 text-right'>
                  {formatDifference(totalUnmatchedManualNetMovement).replace(
                    '£',
                    ''
                  )}
                </td>

                <td className='px-4 py-3 text-right'>
                  <span
                    className={
                    Math.round(totalDifference * 100) === 0
                        ? undefined
                        : 'text-red-600'
                    }
                  >
                    {formatDifference(totalDifference).replace('£', '')}
                  </span>
                </td>

                <td className='px-4 py-3 text-right'>
                  {formatAmount(totalLedgerBalance)}
                </td>

                <td className='px-4 py-3 text-right'>
                  {formatAmount(totalAdjustedBankBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <section className='mt-6 overflow-hidden rounded-lg border bg-white shadow-sm'>
        <div className='border-b px-5 py-4'>
          <h2 className='text-base font-semibold text-zinc-950'>
            Manual reconciliation history
          </h2>
          <p className='mt-1 text-sm text-zinc-600'>
            Statement sessions saved for {financialYear.label}. Attachments are
            managed from Manual reconciliation.
          </p>
        </div>

        {reconciliationEvidence.length === 0 ? (
          <div className='px-5 py-8 text-sm text-zinc-600'>
            No manual reconciliation statement records have been saved for this
            financial year.
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[760px] text-sm'>
              <thead className='bg-emerald-50/30 text-left text-zinc-600'>
                <tr>
                  <th className='px-5 py-3 font-medium'>Bank account</th>
                  <th className='px-4 py-3 font-medium'>Statement date</th>
                  <th className='px-4 py-3 text-right font-medium'>
                    Statement balance
                  </th>
                  <th className='px-4 py-3 text-right font-medium'>
                    Cleared items
                  </th>
                  <th className='px-4 py-3 font-medium'>Attachment</th>
                  <th className='px-4 py-3 font-medium'>Reconciled</th>
                  <th className='px-5 py-3 font-medium'>Details</th>
                </tr>
              </thead>
              <tbody>
                {reconciliationEvidence.map(item => (
                  <tr key={item.id} className='border-t'>
                    <td className='px-5 py-3'>
                      <span className='font-medium text-zinc-900'>
                        {item.nominalCode}
                      </span>{' '}
                      <span className='text-zinc-600'>{item.nominalName}</span>
                    </td>
                    <td className='px-4 py-3'>{item.statementDate}</td>
                    <td className='px-4 py-3 text-right'>
                      {item.statementBalance === null
                        ? 'Not entered'
                        : formatCurrency(Number(item.statementBalance))}
                    </td>
                    <td className='px-4 py-3 text-right'>
                      {Number(item.clearedItemCount)}
                    </td>
                    <td className='px-4 py-3'>
                      {item.statementAttachmentUrl ? (
                        <a
                          href={item.statementAttachmentUrl}
                          target='_blank'
                          rel='noreferrer'
                          title={item.statementAttachmentName ?? undefined}
                          className='font-medium text-blue-700 hover:underline'
                        >
                          Open statement
                        </a>
                      ) : (
                        <span className='text-zinc-500'>No PDF attached</span>
                      )}
                    </td>
                    <td className='px-4 py-3 text-zinc-600'>
                      {item.reconciledAt ? (
                        <>
                          <span className='block'>
                            {formatTimestamp(item.reconciledAt)}
                          </span>
                          <span className='block text-xs'>
                            {item.reconciledByName ?? 'User unavailable'}
                          </span>
                        </>
                      ) : (
                        <span className='text-zinc-500'>
                          Evidence saved {formatTimestamp(item.updatedAt ?? item.createdAt)}
                        </span>
                      )}
                    </td>
                    <td className='px-5 py-3'>
                      <Link
                        href={`/banking/manual-reconciliation/${item.id}`}
                        className='font-medium text-blue-700 hover:underline'
                      >
                        View details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
