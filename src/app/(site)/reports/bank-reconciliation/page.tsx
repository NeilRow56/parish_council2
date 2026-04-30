// src/app/reports/bank-reconciliation/page.tsx

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'

import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'
import { bankConnections } from '@/db/schema'

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
      label: financialYears.label
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
      ledgerDebit: sql<number>`coalesce(sum(${journalLines.debit}), 0)`,
      ledgerCredit: sql<number>`coalesce(sum(${journalLines.credit}), 0)`
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

  const rows = accounts.map(account => {
    const latestBalance = 0
    // const hasBankBalance = false
    const ledgerDebit = Number(account.ledgerDebit ?? 0)
    const ledgerCredit = Number(account.ledgerCredit ?? 0)

    const ledgerBalance = ledgerDebit - ledgerCredit
    const difference = latestBalance - ledgerBalance

    return {
      ...account,
      latestBalance,
      ledgerDebit,
      ledgerCredit,
      ledgerBalance,
      difference
    }
  })

  const totalBankBalance = rows.reduce((sum, row) => sum + row.latestBalance, 0)

  const totalLedgerBalance = rows.reduce(
    (sum, row) => sum + row.ledgerBalance,
    0
  )

  const totalDifference = totalBankBalance - totalLedgerBalance

  return (
    <main className='mx-auto max-w-7xl px-6 py-8'>
      <div className='mb-8 flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Bank Reconciliation
          </h1>
          <p className='mt-1 text-sm text-zinc-600'>
            Compare linked bank balances with the nominal ledger bank balances.
          </p>
          <p className='mt-2 text-sm text-zinc-500'>
            Financial year:{' '}
            <span className='font-medium text-zinc-700'>
              {financialYear.label}
            </span>
          </p>
        </div>

        <Link
          href='/bank-connections'
          className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
        >
          Bank connections
        </Link>
      </div>

      <div className='mb-6 grid gap-4 md:grid-cols-3'>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Bank balance</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatCurrency(totalBankBalance)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Ledger bank balance</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatCurrency(totalLedgerBalance)}
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
              <col className='w-44' />
              <col className='w-44' />
              <col className='w-44' />
              <col className='w-32' />
            </colgroup>

            <thead className='bg-zinc-50 text-left text-zinc-600'>
              <tr>
                <th className='px-4 py-3 font-medium'>Bank account</th>
                <th className='px-4 py-3 font-medium'>Nominal code</th>
                <th className='px-4 py-3 text-right font-medium'>
                  Bank balance
                </th>
                <th className='px-4 py-3 text-right font-medium'>
                  Ledger balance
                </th>
                <th className='px-4 py-3 text-right font-medium'>Difference</th>
                <th className='px-4 py-3 font-medium'>Status</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(row => {
                const reconciled = Math.round(row.difference * 100) === 0

                return (
                  <tr key={row.connectionId} className='border-t'>
                    <td className='px-4 py-3'>
                      <div className='font-medium'>
                        {row.accountName || 'Bank account'}
                      </div>
                      <div className='text-xs text-zinc-500'>
                        {row.providerName}
                        {row.accountLast4 ? ` · ${row.accountLast4}` : ''}
                      </div>
                    </td>

                    <td className='px-4 py-3'>
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

                    <td className='px-4 py-3 text-right'>
                      {formatAmount(row.latestBalance)}
                    </td>

                    <td className='px-4 py-3 text-right'>
                      {formatAmount(row.ledgerBalance)}
                    </td>

                    <td
                      className={
                        reconciled
                          ? 'px-4 py-3 text-right'
                          : 'px-4 py-3 text-right text-red-600'
                      }
                    >
                      {formatDifference(row.difference).replace('£', '')}
                    </td>

                    <td className='px-4 py-3'>
                      {reconciled ? (
                        <span className='rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700'>
                          Reconciled
                        </span>
                      ) : (
                        <span className='rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700'>
                          Difference
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot className='border-t bg-zinc-50 font-semibold'>
              <tr>
                <td className='px-4 py-3' colSpan={2}>
                  Totals
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(totalBankBalance)}
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(totalLedgerBalance)}
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
                <td className='px-4 py-3' />
              </tr>
            </tfoot>
          </table>
        )}
      </section>
    </main>
  )
}
