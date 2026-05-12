// src/app/reports/bank-reconciliation/page.tsx

import Link from 'next/link'
import { Fragment } from 'react/jsx-runtime'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, desc, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'

import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'

import { bankConnections, bankTransactions } from '@/db/schema'

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

function formatDifference(value: number) {
  if (value === 0) return '£—'

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `£(${amount})` : `£${amount}`
}

export default async function BankReconciliationPage() {
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

  const [financialYear] = await db
    .select({
      id: financialYears.id,
      label: financialYears.label,
      startDate: financialYears.startDate,
      endDate: financialYears.endDate
    })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1)

  if (!financialYear) {
    redirect('/')
  }

  const accounts = await db
    .select({
      connectionId: bankConnections.id,
      providerName: bankConnections.providerName,
      accountName: bankConnections.accountName,
      sortCode: bankConnections.sortCode,
      accountLast4: bankConnections.accountLast4,
      nominalCodeId: bankConnections.nominalCodeId,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name,

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
    .from(bankConnections)
    .leftJoin(nominalCodes, eq(nominalCodes.id, bankConnections.nominalCodeId))
    .leftJoin(journalLines, eq(journalLines.nominalCodeId, nominalCodes.id))
    .leftJoin(
      journalEntries,
      and(
        eq(journalEntries.id, journalLines.journalEntryId),
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, financialYear.id)
      )
    )
    .where(eq(bankConnections.parishCouncilId, parishCouncilId))
    .groupBy(
      bankConnections.id,
      bankConnections.providerName,
      bankConnections.accountName,
      bankConnections.sortCode,
      bankConnections.accountLast4,
      bankConnections.nominalCodeId,
      nominalCodes.code,
      nominalCodes.name
    )
    .orderBy(bankConnections.accountName)

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
        eq(bankTransactions.status, 'PENDING'),
        gte(bankTransactions.date, financialYear.startDate)
      )
    )
    .orderBy(desc(bankTransactions.date), desc(bankTransactions.importedAt))

  const rows = accounts.map(account => {
    const accountConnectionId = String(account.connectionId)

    const accountInboxItems = inboxItems.filter(
      item => String(item.connectionId) === accountConnectionId
    )

    const inboxReceipts = accountInboxItems.reduce((sum, item) => {
      const amount = Number(item.amount ?? 0)
      const type = item.transactionType?.toUpperCase()

      return type === 'CREDIT' ? sum + amount : sum
    }, 0)

    const inboxPayments = accountInboxItems.reduce((sum, item) => {
      const amount = Number(item.amount ?? 0)
      const type = item.transactionType?.toUpperCase()

      return type === 'DEBIT' ? sum + amount : sum
    }, 0)

    const inboxNetMovement = inboxReceipts - inboxPayments

    const ledgerDebit = Number(account.ledgerDebit ?? 0)
    const ledgerCredit = Number(account.ledgerCredit ?? 0)
    const ledgerBalance = ledgerDebit - ledgerCredit

    const adjustedBankBalance = ledgerBalance + inboxNetMovement
    const difference = ledgerBalance + inboxNetMovement - adjustedBankBalance

    return {
      ...account,
      ledgerDebit,
      ledgerCredit,
      ledgerBalance,
      inboxItems: accountInboxItems,
      inboxReceipts,
      inboxPayments,
      inboxNetMovement,
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

  const totalLedgerBalance = rows.reduce(
    (sum, row) => sum + row.ledgerBalance,
    0
  )

  const totalAdjustedBankBalance = rows.reduce(
    (sum, row) => sum + row.adjustedBankBalance,
    0
  )

  const totalDifference =
    totalLedgerBalance + totalInboxNetMovement - totalAdjustedBankBalance

  return (
    <main className='mx-auto max-w-7xl px-6 py-8'>
      <div className='mb-8 flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Bank Reconciliation
          </h1>
          <p className='mt-1 text-sm text-zinc-600'>
            Reconcile nominal ledger bank balances to adjusted bank balances
            after pending inbox movements.
          </p>
          <p className='mt-2 text-sm text-zinc-500'>
            Financial year:{' '}
            <span className='font-medium text-zinc-700'>
              {financialYear.label}
            </span>
          </p>
        </div>

        <div className='flex gap-2'>
          <Link
            href='/transactions/inbox'
            className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
          >
            Transaction inbox
          </Link>

          <Link
            href='/bank-connections'
            className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
          >
            Bank connections
          </Link>
        </div>
      </div>

      <div className='mb-6 grid gap-4 md:grid-cols-4'>
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
          <p className='text-sm text-zinc-500'>Adjusted bank balance</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatCurrency(totalAdjustedBankBalance)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Difference</p>
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
      </div>

      <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
        {rows.length === 0 ? (
          <div className='p-10 text-center text-sm text-zinc-500'>
            No bank connections found.
          </div>
        ) : (
          <table className='w-full table-fixed border-collapse text-sm'>
            <colgroup>
              <col className='w-64' />
              <col />
              <col className='w-40' />
              <col className='w-40' />
              <col className='w-40' />
              <col className='w-40' />
              <col className='w-44' />
              <col className='w-32' />
            </colgroup>

            <thead className='bg-zinc-50 text-left text-zinc-600'>
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
                  Ledger balance
                </th>
                <th className='px-4 py-3 text-right font-medium'>
                  Adjusted bank balance
                </th>
                <th className='px-4 py-3 text-right font-medium'>Difference</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(row => {
                const reconciled = Math.round(row.difference * 100) === 0

                return (
                  <Fragment key={row.connectionId}>
                    <tr className='border-t'>
                      <td className='px-4 py-3 align-top'>
                        <div className='font-medium'>
                          {row.accountName || 'Bank account'}
                        </div>

                        <div className='text-xs text-zinc-500'>
                          {row.providerName}
                          {row.accountLast4 ? ` · ${row.accountLast4}` : ''}
                        </div>

                        <Link
                          href={`/transactions/inbox?connectionId=${row.connectionId}`}
                          className='mt-2 inline-block text-xs font-medium text-blue-700 hover:underline'
                        >
                          View {row.inboxItems.length} inbox item
                          {row.inboxItems.length === 1 ? '' : 's'}
                        </Link>
                      </td>

                      <td className='px-4 py-3 align-top'>
                        {row.nominalCodeId ? (
                          <Link
                            href={`/ledger/${row.nominalCodeId}`}
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
                        {formatAmount(row.ledgerBalance)}
                      </td>

                      <td className='px-4 py-3 text-right align-top font-medium'>
                        {formatAmount(row.adjustedBankBalance)}
                      </td>

                      <td
                        className={
                          reconciled
                            ? 'px-4 py-3 text-right align-top'
                            : 'px-4 py-3 text-right align-top text-red-600'
                        }
                      >
                        {formatDifference(row.difference).replace('£', '')}
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>

            <tfoot className='border-t bg-zinc-50 font-semibold'>
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
                  {formatAmount(totalLedgerBalance)}
                </td>

                <td className='px-4 py-3 text-right'>
                  {formatAmount(totalAdjustedBankBalance)}
                </td>

                <td
                  className={
                    Math.round(totalDifference * 100) === 0
                      ? 'px-4 py-3 text-right'
                      : 'px-4 py-3 text-right text-red-600'
                  }
                >
                  {formatDifference(totalDifference).replace('£', '')}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>
    </main>
  )
}
