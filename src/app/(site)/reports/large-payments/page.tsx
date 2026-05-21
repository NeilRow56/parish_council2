// src/app/(site)/reports/large-payments/page.tsx

import Link from 'next/link'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { ExportPdfButton } from './_components/export-pdf-button'
import {
  dateToInputDate,
  formatDate,
  formatMoney,
  getCurrentFinancialYearForLargePaymentsReport,
  getLargePaymentTotals,
  getLargePaymentsReport
} from './lib'

type SearchParams = {
  from?: string
  to?: string
  financialYearId?: string
}

export default async function LargePaymentsReportPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>
}) {
  const params = await searchParams

  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return <div className='p-6'>Unauthorised</div>
  }

  const parishCouncilId = session.user.parishCouncilId

  const currentYear = await getCurrentFinancialYearForLargePaymentsReport({
    parishCouncilId,
    financialYearId: params?.financialYearId
  })

  if (!currentYear) {
    return (
      <main className='p-6'>
        <h1 className='text-2xl font-semibold'>Payments over £100</h1>
        <p className='mt-4 text-sm text-slate-600'>
          No open financial year found.
        </p>
      </main>
    )
  }

  const from = params?.from ?? dateToInputDate(currentYear.startDate)
  const to = params?.to ?? dateToInputDate(currentYear.endDate)
  const financialYearQuery = `financialYearId=${currentYear.id}`

  const rows = await getLargePaymentsReport({
    parishCouncilId,
    financialYearId: currentYear.id,
    from,
    to
  })

  const totals = getLargePaymentTotals(rows)

  const csvHref = `/reports/large-payments/export?${financialYearQuery}&from=${from}&to=${to}`
  const pdfHref = `/reports/large-payments/pdf?${financialYearQuery}&from=${from}&to=${to}`
  const resetHref = `/reports/large-payments?${financialYearQuery}`

  return (
    <main className='min-h-screen bg-background p-6 print:bg-white'>
      <style>
        {`
          @media print {
            header,
            nav,
            .print\\:hidden {
              display: none !important;
            }

            main {
              padding: 0 !important;
            }

            table {
              page-break-inside: auto;
            }

            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          }
        `}
      </style>

      <div className='mx-auto max-w-7xl space-y-6'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-900'>
            Payments over £100
          </h1>
          <p className='mt-1 text-sm text-slate-600'>
            Statutory payment disclosure report for financial year{' '}
            {currentYear.label}.
            {currentYear.isClosed ? ' Closed / read-only.' : ''}
          </p>
        </div>

        <div className='rounded-xl border bg-white p-4 shadow-sm print:hidden'>
          <form className='flex flex-col gap-3 sm:flex-row sm:items-end'>
            <input
              type='hidden'
              name='financialYearId'
              value={currentYear.id}
            />

            <div>
              <label className='mb-1 block text-sm font-medium text-slate-700'>
                From
              </label>
              <input
                type='date'
                name='from'
                defaultValue={from}
                className='rounded-md border px-3 py-2 text-sm'
              />
            </div>

            <div>
              <label className='mb-1 block text-sm font-medium text-slate-700'>
                To
              </label>
              <input
                type='date'
                name='to'
                defaultValue={to}
                className='rounded-md border px-3 py-2 text-sm'
              />
            </div>

            <button
              type='submit'
              className='rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white'
            >
              Apply
            </button>

            <Link
              href={resetHref}
              className='rounded-md border bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-emerald-50/40'
            >
              Reset
            </Link>
          </form>
        </div>

        <div className='grid gap-4 sm:grid-cols-4 print:hidden'>
          <div className='rounded-lg border bg-white p-4'>
            <p className='text-sm text-slate-500'>Payments shown</p>
            <p className='mt-1 text-2xl font-semibold'>{rows.length}</p>
          </div>

          <div className='rounded-lg border bg-white p-4'>
            <p className='text-sm text-slate-500'>Net total</p>
            <p className='mt-1 text-2xl font-semibold'>
              {formatMoney(totals.net)}
            </p>
          </div>

          <div className='rounded-lg border bg-white p-4'>
            <p className='text-sm text-slate-500'>VAT total</p>
            <p className='mt-1 text-2xl font-semibold'>
              {formatMoney(totals.vat)}
            </p>
          </div>

          <div className='rounded-lg border bg-white p-4'>
            <p className='text-sm text-slate-500'>Gross total</p>
            <p className='mt-1 text-2xl font-semibold'>
              {formatMoney(totals.gross)}
            </p>
          </div>
        </div>

        <div className='flex gap-3 print:hidden'>
          <Link
            href={csvHref}
            className='rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white'
          >
            Export CSV
          </Link>

          <ExportPdfButton href={pdfHref} />
        </div>

        <div className='overflow-hidden rounded-xl border bg-white shadow-sm'>
          <div className='border-b p-4'>
            <h2 className='font-semibold text-slate-900'>Payments over £100</h2>
            <p className='text-sm text-slate-600'>
              Period: {formatDate(from)} to {formatDate(to)}
            </p>
          </div>

          {rows.length === 0 ? (
            <div className='p-10 text-center text-sm text-slate-500'>
              No payments over £100 were found for this period.
            </div>
          ) : (
            <table className='w-full text-sm'>
              <thead className='bg-emerald-50/30 text-left text-slate-500'>
                <tr>
                  <th className='px-4 py-3 font-medium'>Date</th>
                  <th className='px-4 py-3 font-medium'>Nominal code</th>
                  <th className='px-4 py-3 font-medium'>Description</th>
                  <th className='px-4 py-3 text-right font-medium'>Net</th>
                  <th className='px-4 py-3 text-right font-medium'>VAT</th>
                  <th className='px-4 py-3 text-right font-medium'>Gross</th>
                </tr>
              </thead>

              <tbody>
                {rows.map(row => (
                  <tr
                    key={`${row.reference}-${row.nominalCode}-${row.description}`}
                    className='border-t border-emerald-100'
                  >
                    <td className='px-4 py-3 whitespace-nowrap'>
                      {formatDate(row.date)}
                    </td>

                    <td className='px-4 py-3 whitespace-nowrap'>
                      {row.nominalCode} — {row.nominalName}
                    </td>

                    <td className='px-4 py-3'>{row.description}</td>

                    <td className='px-4 py-3 text-right'>
                      {formatMoney(row.net)}
                    </td>

                    <td className='px-4 py-3 text-right'>
                      {formatMoney(row.vat)}
                    </td>

                    <td className='px-4 py-3 text-right font-medium'>
                      {formatMoney(row.gross)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className='border-t bg-emerald-50/30 font-semibold'>
                <tr>
                  <td className='px-4 py-3' colSpan={3}>
                    Totals
                  </td>

                  <td className='px-4 py-3 text-right'>
                    {formatMoney(totals.net)}
                  </td>

                  <td className='px-4 py-3 text-right'>
                    {formatMoney(totals.vat)}
                  </td>

                  <td className='px-4 py-3 text-right'>
                    {formatMoney(totals.gross)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </main>
  )
}
