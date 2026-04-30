// src/app/reports/income-expenditure/page.tsx

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema'

function formatAmount(value: number) {
  if (value === 0) return '—'

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `(${amount})` : amount
}

function formatCurrency(value: number) {
  if (value === 0) return '£—'

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `£(${amount})` : `£${amount}`
}

export default async function IncomeExpenditurePage() {
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
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        inArray(nominalCodes.type, ['INCOME', 'EXPENDITURE'])
      )
    )
    .groupBy(
      nominalCodes.id,
      nominalCodes.code,
      nominalCodes.name,
      nominalCodes.type
    )
    .orderBy(nominalCodes.code)

  const reportRows = rows.map(row => {
    const debit = Number(row.debit ?? 0)
    const credit = Number(row.credit ?? 0)

    const amount = row.type === 'INCOME' ? credit - debit : debit - credit

    return {
      ...row,
      debit,
      credit,
      amount
    }
  })

  const incomeRows = reportRows.filter(
    row => row.type === 'INCOME' && row.amount !== 0
  )

  const expenditureRows = reportRows.filter(
    row => row.type === 'EXPENDITURE' && row.amount !== 0
  )

  const totalIncome = incomeRows.reduce((sum, row) => sum + row.amount, 0)
  const totalExpenditure = expenditureRows.reduce(
    (sum, row) => sum + row.amount,
    0
  )
  const surplusOrDeficit = totalIncome - totalExpenditure

  return (
    <main className='mx-auto max-w-7xl px-6 py-8'>
      <div className='mb-8 flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Income &amp; Expenditure
          </h1>
          <p className='mt-1 text-sm text-zinc-600'>
            Summary of income and expenditure for the selected financial year.
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
          <p className='text-sm text-zinc-500'>Total income</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatCurrency(totalIncome)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Total expenditure</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatCurrency(totalExpenditure)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>
            {surplusOrDeficit >= 0 ? 'Surplus' : 'Deficit'}
          </p>
          <p
            className={
              surplusOrDeficit < 0
                ? 'mt-1 text-2xl font-semibold text-red-600'
                : 'mt-1 text-2xl font-semibold'
            }
          >
            {formatCurrency(surplusOrDeficit)}
          </p>
        </div>
      </div>

      <div className='space-y-6'>
        <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
          <div className='border-b bg-zinc-50 px-4 py-3'>
            <h2 className='font-semibold'>Income</h2>
          </div>

          <table className='w-full table-fixed border-collapse text-sm'>
            <colgroup>
              <col className='w-32' />
              <col />
              <col className='w-40' />
            </colgroup>
            <thead className='text-left text-zinc-600'>
              <tr>
                <th className='px-4 py-3 font-medium'>Code</th>
                <th className='px-4 py-3 font-medium'>Name</th>
                <th className='px-4 py-3 text-right font-medium'>Amount</th>
              </tr>
            </thead>

            <tbody>
              {incomeRows.map(row => (
                <tr key={row.nominalCodeId} className='border-t'>
                  <td className='px-4 py-3 font-medium'>{row.code}</td>
                  <td className='px-4 py-3'>{row.name}</td>
                  <td
                    className={
                      row.amount < 0
                        ? 'px-4 py-3 text-right text-red-600'
                        : 'px-4 py-3 text-right'
                    }
                  >
                    {formatAmount(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot className='border-t bg-zinc-50 font-semibold'>
              <tr>
                <td className='px-4 py-3' colSpan={2}>
                  Total income
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(totalIncome)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
          <div className='border-b bg-zinc-50 px-4 py-3'>
            <h2 className='font-semibold'>Expenditure</h2>
          </div>

          <table className='w-full table-fixed border-collapse text-sm'>
            <colgroup>
              <col className='w-32' />
              <col />
              <col className='w-40' />
            </colgroup>
            <thead className='text-left text-zinc-600'>
              <tr>
                <th className='px-4 py-3 font-medium'>Code</th>
                <th className='px-4 py-3 font-medium'>Name</th>
                <th className='px-4 py-3 text-right font-medium'>Amount</th>
              </tr>
            </thead>

            <tbody>
              {expenditureRows.map(row => (
                <tr key={row.nominalCodeId} className='border-t'>
                  <td className='px-4 py-3 font-medium'>{row.code}</td>
                  <td className='px-4 py-3'>{row.name}</td>
                  <td
                    className={
                      row.amount < 0
                        ? 'px-4 py-3 text-right text-red-600'
                        : 'px-4 py-3 text-right'
                    }
                  >
                    {formatAmount(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot className='border-t bg-zinc-50 font-semibold'>
              <tr>
                <td className='px-4 py-3' colSpan={2}>
                  Total expenditure
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(totalExpenditure)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className='rounded-lg border bg-white p-4 shadow-sm'>
          <div className='flex items-center justify-between text-sm'>
            <span className='font-semibold'>
              {surplusOrDeficit >= 0
                ? 'Surplus for the year'
                : 'Deficit for the year'}
            </span>
            <span
              className={
                surplusOrDeficit < 0
                  ? 'text-lg font-semibold text-red-600'
                  : 'text-lg font-semibold'
              }
            >
              {formatAmount(surplusOrDeficit)}
            </span>
          </div>
        </section>
      </div>
    </main>
  )
}
