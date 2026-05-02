// app/(app)/vat/returns/page.tsx

import { SubmitVatReturnButton } from './_components/submit-vat-return-button'
import {
  getCurrentFinancialYearForVatReturns,
  getVat126InvoiceLines,
  getVatReturnTotals
} from './actions'

type SearchParams = {
  periodStart?: string
  periodEnd?: string
  financialYearId?: string
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)
}

export default async function VatReturnsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  const currentFinancialYear = params.financialYearId
    ? null
    : await getCurrentFinancialYearForVatReturns()

  const financialYearId = params.financialYearId ?? currentFinancialYear?.id

  if (!financialYearId) {
    return (
      <div className='mx-auto w-full max-w-5xl px-4 py-6'>
        <div className='space-y-2'>
          <h1 className='text-2xl font-semibold'>VAT126 Reclaim</h1>
          <p className='text-muted-foreground text-sm'>
            No financial year was found for this parish council.
          </p>
        </div>
      </div>
    )
  }

  const periodStart = params.periodStart
    ? new Date(params.periodStart)
    : currentFinancialYear
      ? new Date(currentFinancialYear.startDate)
      : new Date('2025-04-01')

  const periodEnd = params.periodEnd
    ? new Date(params.periodEnd)
    : currentFinancialYear
      ? new Date(currentFinancialYear.endDate)
      : new Date('2025-06-30')

  const totals = await getVatReturnTotals({
    financialYearId,
    periodStart,
    periodEnd
  })

  const invoiceLines = await getVat126InvoiceLines({
    financialYearId,
    periodStart,
    periodEnd
  })

  const exportHref = `/vat/returns/export?financialYearId=${financialYearId}&periodStart=${periodStart.toISOString()}&periodEnd=${periodEnd.toISOString()}`

  return (
    <div className='mx-auto w-full max-w-5xl px-4 py-6'>
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-semibold'>VAT126 Reclaim</h1>
          <p className='text-muted-foreground text-sm'>
            Prepare a VAT126-style reclaim pack for HMRC using recoverable VAT
            from purchase transactions.
          </p>
        </div>

        <div className='bg-card rounded-lg border p-4'>
          <h2 className='font-medium'>Claim period</h2>
          <p className='text-muted-foreground mt-1 text-sm'>
            {periodStart.toLocaleDateString('en-GB')} to{' '}
            {periodEnd.toLocaleDateString('en-GB')}
          </p>
        </div>

        <div className='overflow-hidden rounded-lg border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50'>
              <tr>
                <th className='px-4 py-3 text-left font-medium'>Item</th>
                <th className='px-4 py-3 text-left font-medium'>Description</th>
                <th className='px-4 py-3 text-right font-medium'>Amount</th>
              </tr>
            </thead>

            <tbody>
              <tr className='border-t'>
                <td className='px-4 py-3'>Claim period</td>
                <td className='px-4 py-3'>Recoverable VAT on purchases</td>
                <td className='px-4 py-3 text-right'>
                  {formatMoney(totals.inputVat)}
                </td>
              </tr>

              <tr className='bg-muted/30 border-t font-medium'>
                <td className='px-4 py-3'>Refund claim</td>
                <td className='px-4 py-3'>Amount to reclaim using VAT126</td>
                <td className='px-4 py-3 text-right'>
                  {formatMoney(totals.inputVat)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className='overflow-hidden rounded-lg border'>
          <div className='border-b p-4'>
            <h2 className='font-medium'>VAT126 invoice breakdown</h2>
            <p className='text-muted-foreground text-sm'>
              Use this export as the supporting spreadsheet for the VAT126
              claim.
            </p>
          </div>

          <table className='w-full text-sm'>
            <thead className='bg-muted/50'>
              <tr>
                <th className='px-4 py-3 text-left font-medium'>
                  Invoice date
                </th>
                <th className='px-4 py-3 text-left font-medium'>Description</th>
                <th className='px-4 py-3 text-left font-medium'>
                  Supplier VAT No.
                </th>
                <th className='px-4 py-3 text-left font-medium'>
                  Addressed to
                </th>
                <th className='px-4 py-3 text-right font-medium'>VAT paid</th>
              </tr>
            </thead>

            <tbody>
              {invoiceLines.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className='text-muted-foreground px-4 py-6 text-center'
                  >
                    No recoverable VAT lines found for this period.
                  </td>
                </tr>
              ) : (
                invoiceLines.map((line, index) => (
                  <tr key={`${line.invoiceDate}-${index}`} className='border-t'>
                    <td className='px-4 py-3'>
                      {new Date(line.invoiceDate).toLocaleDateString('en-GB')}
                    </td>
                    <td className='px-4 py-3'>{line.description}</td>
                    <td className='text-muted-foreground px-4 py-3'>
                      Not recorded
                    </td>
                    <td className='text-muted-foreground px-4 py-3'>
                      Not recorded
                    </td>
                    <td className='px-4 py-3 text-right'>
                      {formatMoney(line.vatPaid)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className='flex flex-wrap gap-3'>
          <a
            href={exportHref}
            className='hover:bg-muted inline-flex h-9 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm'
          >
            Export VAT126 CSV
          </a>

          <SubmitVatReturnButton
            financialYearId={financialYearId}
            periodStart={periodStart.toISOString()}
            periodEnd={periodEnd.toISOString()}
            netVat={-totals.inputVat}
          />
        </div>
      </div>
    </div>
  )
}
