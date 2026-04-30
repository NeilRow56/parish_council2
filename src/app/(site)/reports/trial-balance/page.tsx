// src/app/reports/trial-balance/page.tsx

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
} from '@/db/schema'

function formatAmount(value: number) {
  return value === 0
    ? '—'
    : value.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
}

function formatCurrency(value: number) {
  return value === 0 ? '£—' : `£${formatAmount(value)}`
}

function formatBalance(value: number) {
  if (value === 0) return '—'

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `(${amount})` : amount
}

function formatCurrencyBalance(value: number) {
  if (value === 0) return '£—'

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `£(${amount})` : `£${amount}`
}

export default async function TrialBalancePage() {
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
    .where(eq(financialYears.parishCouncilId, parishCouncilId))
    .limit(1)

  if (!financialYear) {
    redirect('/')
  }

  const rows = await db
    .select({
      nominalCodeId: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      type: nominalCodes.type,
      debit: sql<number>`coalesce(sum(${journalLines.debit}), 0)`,
      credit: sql<number>`coalesce(sum(${journalLines.credit}), 0)`
    })
    .from(nominalCodes)
    .leftJoin(journalLines, eq(journalLines.nominalCodeId, nominalCodes.id))
    .leftJoin(
      journalEntries,
      and(
        eq(journalEntries.id, journalLines.journalEntryId),
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, financialYear.id)
      )
    )
    .where(eq(nominalCodes.parishCouncilId, parishCouncilId))
    .groupBy(
      nominalCodes.id,
      nominalCodes.code,
      nominalCodes.name,
      nominalCodes.type
    )
    .orderBy(nominalCodes.code)

  const trialBalanceRows = rows.map(row => {
    const debit = Number(row.debit ?? 0)
    const credit = Number(row.credit ?? 0)
    const movement = debit - credit
    const balance = movement // temporary, until opening balances exist

    return {
      ...row,
      debit,
      credit,
      balance
    }
  })

  const totalDebit = trialBalanceRows.reduce((sum, row) => sum + row.debit, 0)
  const totalCredit = trialBalanceRows.reduce((sum, row) => sum + row.credit, 0)
  const difference = totalDebit - totalCredit

  return (
    <main className='mx-auto max-w-7xl px-6 py-8'>
      <div className='mb-8 flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Trial Balance
          </h1>
          <p className='mt-1 text-sm text-zinc-600'>
            Summary of debit and credit movements by nominal code.
          </p>
          <p className='mt-2 text-sm text-zinc-500'>
            Financial year:{' '}
            <span className='font-medium text-zinc-700'>
              {financialYear.label}
            </span>
          </p>
        </div>

        <Link
          href='/ledger'
          className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
        >
          Back to ledger
        </Link>
      </div>

      <div className='mb-6 grid gap-4 md:grid-cols-3'>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Total debits</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatCurrency(totalDebit)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Total credits</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatCurrency(totalCredit)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Difference</p>
          <p
            className={
              difference < 0
                ? 'mt-1 text-2xl font-semibold text-red-600'
                : 'mt-1 text-2xl font-semibold'
            }
          >
            {formatCurrencyBalance(difference)}
          </p>
        </div>
      </div>

      <div className='overflow-hidden rounded-lg border bg-white shadow-sm'>
        <table className='w-full border-collapse text-sm'>
          <thead className='bg-zinc-50 text-left text-zinc-600'>
            <tr>
              <th className='px-4 py-3 font-medium'>Code</th>
              <th className='px-4 py-3 font-medium'>Name</th>
              <th className='px-4 py-3 font-medium'>Type</th>
              <th className='px-4 py-3 text-right font-medium'>Debit</th>
              <th className='px-4 py-3 text-right font-medium'>Credit</th>
              <th className='px-4 py-3 text-right font-medium'>Balance</th>
            </tr>
          </thead>

          <tbody>
            {trialBalanceRows.map(row => (
              <tr key={row.nominalCodeId} className='border-t'>
                <td className='px-4 py-3 font-medium'>{row.code}</td>
                <td className='px-4 py-3'>{row.name}</td>
                <td className='px-4 py-3 text-zinc-500'>{row.type}</td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(row.debit)}
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(row.credit)}
                </td>
                <td
                  className={
                    row.balance < 0
                      ? 'px-4 py-3 text-right text-red-600'
                      : 'px-4 py-3 text-right'
                  }
                >
                  {formatBalance(row.balance)}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className='border-t bg-zinc-50 font-semibold'>
            <tr>
              <td className='px-4 py-3' colSpan={3}>
                Totals
              </td>
              <td className='px-4 py-3 text-right'>
                {formatAmount(totalDebit)}
              </td>
              <td className='px-4 py-3 text-right'>
                {formatAmount(totalCredit)}
              </td>
              <td
                className={
                  difference < 0
                    ? 'px-4 py-3 text-right text-red-600'
                    : 'px-4 py-3 text-right'
                }
              >
                {formatBalance(difference)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  )
}
