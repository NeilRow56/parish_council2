// src/app/reports/trial-balance/page.tsx

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import {
  formatAmount,
  getTrialBalanceFinancialYear,
  getTrialBalanceReport
} from './lib'
import { ExportPdfButton } from './_components/export-pdf-button'

function formatCurrency(value: number) {
  return value === 0 ? '£—' : `£${formatAmount(value)}`
}

function formatCurrencyBalance(value: number) {
  if (value === 0) return '£—'

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `£(${amount})` : `£${amount}`
}

type SearchParams = {
  financialYearId?: string
}

export default async function TrialBalancePage({
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

  const financialYear = await getTrialBalanceFinancialYear({
    parishCouncilId,
    financialYearId: params?.financialYearId
  })

  if (!financialYear) {
    redirect('/')
  }

  const report = await getTrialBalanceReport({
    parishCouncilId,
    financialYear
  })

  const exportHref = `/reports/trial-balance/export?financialYearId=${financialYear.id}`

  return (
    <main className='mx-auto max-w-7xl px-6 py-8'>
      <div className='mb-8 flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Trial Balance
          </h1>
          <p className='mt-1 text-sm text-zinc-600'>
            Summary of opening balances and current-year movements by nominal
            code.
          </p>
          <p className='mt-1 text-sm text-zinc-500'>
            Positive balances are shown as debits; negative balances are shown
            as credits.
          </p>
          <p className='mt-2 text-sm text-zinc-500'>
            Financial year:{' '}
            <span className='font-medium text-zinc-700'>
              {financialYear.label}
            </span>
          </p>
        </div>

        <div className='flex gap-2'>
          <ExportPdfButton href={exportHref} />

          <Link
            href='/ledger'
            className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
          >
            Back to ledger
          </Link>
        </div>
      </div>

      <div className='mb-6 grid gap-4 md:grid-cols-3'>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Total debits</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatCurrency(report.totalDebit)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Total credits</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatCurrency(report.totalCredit)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Difference</p>
          <p
            className={
              report.difference < 0
                ? 'mt-1 text-2xl font-semibold text-red-600'
                : 'mt-1 text-2xl font-semibold'
            }
          >
            {formatCurrencyBalance(report.difference)}
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
            </tr>
          </thead>

          <tbody>
            {report.rows.map(row => (
              <tr
                key={row.nominalCodeId}
                className='border-t transition-colors hover:bg-slate-50'
              >
                <td className='px-4 py-3 font-medium'>
                  <Link
                    href={`/ledger/${row.nominalCodeId}`}
                    className='text-slate-900 hover:text-blue-600 hover:underline'
                  >
                    {row.code}
                  </Link>
                </td>

                <td className='px-4 py-3'>
                  <Link
                    href={`/ledger/${row.nominalCodeId}`}
                    className='text-slate-900 hover:text-blue-600 hover:underline'
                  >
                    {row.name}
                  </Link>
                </td>
                <td className='px-4 py-3 text-zinc-500'>{row.type}</td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(row.debit)}
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(row.credit)}
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
                {formatAmount(report.totalDebit)}
              </td>
              <td className='px-4 py-3 text-right'>
                {formatAmount(report.totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  )
}
