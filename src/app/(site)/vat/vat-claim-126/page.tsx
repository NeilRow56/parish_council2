// app/(app)/vat/returns/page.tsx

import { SubmitVatReturnButton } from '../returns/_components/submit-vat-return-button'
import {
  getCurrentFinancialYearForVatReturns,
  getVat126InvoiceLines,
  getVatReturnTotals
} from '../returns/actions'

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
      <div className='mx-auto w-full max-w-7xl px-4 py-6'>
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

  const missingDetails = invoiceLines.filter(
    line =>
      !line.goodsSupplied ||
      !line.supplierVatNumberSnapshot ||
      !line.invoiceReference
  ).length

  const exportHref = `/vat/returns/export?financialYearId=${financialYearId}&periodStart=${periodStart.toISOString()}&periodEnd=${periodEnd.toISOString()}`

  return (
    <div className='mx-auto w-full max-w-7xl px-4 py-6'>
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

        <div className='grid gap-4 md:grid-cols-3'>
          <div className='bg-card rounded-lg border p-4'>
            <p className='text-muted-foreground text-sm'>Recoverable VAT</p>
            <p className='mt-1 text-2xl font-semibold'>
              {formatMoney(totals.inputVat)}
            </p>
          </div>

          <div className='bg-card rounded-lg border p-4'>
            <p className='text-muted-foreground text-sm'>Claim lines</p>
            <p className='mt-1 text-2xl font-semibold'>{invoiceLines.length}</p>
          </div>

          <div className='bg-card rounded-lg border p-4'>
            <p className='text-muted-foreground text-sm'>
              Lines missing detail
            </p>
            <p className='mt-1 text-2xl font-semibold'>{missingDetails}</p>
          </div>
        </div>

        <div className='overflow-hidden rounded-lg border'>
          <div className='border-b p-4'>
            <h2 className='font-medium'>VAT126 invoice breakdown</h2>
            <p className='text-muted-foreground text-sm'>
              Supporting detail for the VAT126 claim, including supplier,
              invoice and compliance fields.
            </p>
          </div>

          <div className='overflow-x-auto'>
            <table className='w-full table-fixed text-sm'>
              <colgroup>
                <col className='w-32' />
                <col className='w-48' />
                <col className='w-44' />
                <col className='w-36' />
                <col />
                <col className='w-56' />
                <col className='w-32' />
              </colgroup>

              <thead className='bg-muted/50 text-left'>
                <tr>
                  <th className='px-4 py-3 font-medium'>Date</th>
                  <th className='px-4 py-3 font-medium'>Reference</th>
                  <th className='px-4 py-3 font-medium'>Supplier</th>
                  <th className='px-4 py-3 font-medium'>VAT number</th>
                  <th className='px-4 py-3 font-medium'>VAT126 details</th>
                  <th className='px-4 py-3 font-medium'>Nominal</th>
                  <th className='px-4 py-3 text-right font-medium'>VAT</th>
                </tr>
              </thead>

              <tbody>
                {invoiceLines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className='text-muted-foreground px-4 py-8 text-center'
                    >
                      No recoverable VAT lines found for this period.
                    </td>
                  </tr>
                ) : (
                  invoiceLines.map(line => (
                    <tr key={line.journalLineId} className='border-t'>
                      <td className='px-4 py-3'>
                        {new Date(line.invoiceDate).toLocaleDateString('en-GB')}
                      </td>

                      <td className='px-4 py-3'>{line.reference}</td>

                      <td className='px-4 py-3'>{line.supplierName ?? '—'}</td>

                      <td className='px-4 py-3'>
                        {line.supplierVatNumberSnapshot || (
                          <span className='text-amber-700'>Missing</span>
                        )}
                      </td>

                      <td className='px-4 py-3'>
                        <div className='space-y-1'>
                          <p>
                            <span className='text-muted-foreground'>
                              Goods:{' '}
                            </span>
                            {line.goodsSupplied || (
                              <span className='text-amber-700'>Missing</span>
                            )}
                          </p>

                          <p>
                            <span className='text-muted-foreground'>
                              Invoice:{' '}
                            </span>
                            {line.invoiceReference || (
                              <span className='text-amber-700'>Missing</span>
                            )}
                          </p>
                        </div>
                      </td>

                      <td className='px-4 py-3'>
                        {line.nominalCode} — {line.nominalName}
                      </td>

                      <td className='px-4 py-3 text-right font-medium'>
                        {formatMoney(line.vatPaid)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {invoiceLines.length > 0 && (
                <tfoot className='bg-muted/50 border-t font-semibold'>
                  <tr>
                    <td className='px-4 py-3' colSpan={6}>
                      Total recoverable VAT
                    </td>
                    <td className='px-4 py-3 text-right'>
                      {formatMoney(totals.inputVat)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
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
