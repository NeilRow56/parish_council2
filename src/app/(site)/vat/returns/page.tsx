// app/(site)/vat/returns/page.tsx

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { parishCouncils } from '@/db/schema'
import {
  getFinancialYearForVatReports,
  getVatReturnTotals,
  getVatReturnTransactionLines
} from './actions'
import { SubmitVatReturnButton } from './_components/submit-vat-return-button'
import { VatReturnPeriodSelect } from './_components/vat-return-period-select'

type SearchParams = {
  periodStart?: string
  periodEnd?: string
  financialYearId?: string
}

type VatReturnFrequency = 'ANNUAL' | 'QUARTERLY' | 'MONTHLY'

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-GB')
}

function dateToInputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function formatMoneyWithBrackets(value: number) {
  const formatted = formatMoney(Math.abs(value))

  return value < 0 ? `(${formatted})` : formatted
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getFrequencyLabel(frequency: VatReturnFrequency) {
  if (frequency === 'ANNUAL') return 'Annual'
  if (frequency === 'QUARTERLY') return 'Quarterly'
  return 'Monthly'
}

function getVatPeriodOptions({
  financialYearStart,
  financialYearEnd,
  frequency
}: {
  financialYearStart: Date
  financialYearEnd: Date
  frequency: VatReturnFrequency
}) {
  if (frequency === 'ANNUAL') {
    return [
      {
        label: `${formatDate(financialYearStart)} to ${formatDate(
          financialYearEnd
        )}`,
        periodStart: dateToInputDate(financialYearStart),
        periodEnd: dateToInputDate(financialYearEnd)
      }
    ]
  }

  const monthsPerPeriod = frequency === 'QUARTERLY' ? 3 : 1
  const periods: Array<{
    label: string
    periodStart: string
    periodEnd: string
  }> = []

  let start = new Date(financialYearStart)

  while (start <= financialYearEnd) {
    const nextPeriodStart = addMonths(start, monthsPerPeriod)
    const end = addDays(nextPeriodStart, -1)
    const periodEnd = end > financialYearEnd ? financialYearEnd : end

    periods.push({
      label: `${formatDate(start)} to ${formatDate(periodEnd)}`,
      periodStart: dateToInputDate(start),
      periodEnd: dateToInputDate(periodEnd)
    })

    start = nextPeriodStart
  }

  return periods
}

export default async function VatReturnsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login?next=/vat/returns')
  }

  const [council] = await db
    .select({
      vatReturnFrequency: parishCouncils.vatClaimFrequency
    })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, session.user.parishCouncilId))
    .limit(1)

  const vatReturnFrequency = (council?.vatReturnFrequency ??
    'QUARTERLY') as VatReturnFrequency

  const financialYear = await getFinancialYearForVatReports(
    params.financialYearId
  )
  const financialYearId = financialYear?.id

  if (!financialYearId || !financialYear) {
    return (
      <div className='mx-auto max-w-5xl px-4 py-6'>
        <h1 className='text-2xl font-semibold'>VAT Return</h1>
        <p className='text-muted-foreground text-sm'>
          No financial year was found for this parish council.
        </p>
      </div>
    )
  }

  const periodOptions = getVatPeriodOptions({
    financialYearStart: new Date(financialYear.startDate),
    financialYearEnd: new Date(financialYear.endDate),
    frequency: vatReturnFrequency
  })

  const defaultPeriod = periodOptions[0]

  const periodStartString = params.periodStart ?? defaultPeriod.periodStart
  const periodEndString = params.periodEnd ?? defaultPeriod.periodEnd

  const periodStart = new Date(periodStartString)
  const periodEnd = new Date(periodEndString)

  const totals = await getVatReturnTotals({
    financialYearId,
    periodStart,
    periodEnd
  })

  const transactionLines = await getVatReturnTransactionLines({
    financialYearId,
    periodStart,
    periodEnd
  })

  const transactionOutputVat = transactionLines
    .filter(line => line.type === 'OUTPUT')
    .reduce((sum, line) => sum + line.vatAmount, 0)

  const transactionInputVat = transactionLines
    .filter(line => line.type === 'INPUT')
    .reduce((sum, line) => sum + line.vatAmount, 0)

  return (
    <div className='mx-auto max-w-5xl space-y-6 px-4 py-6'>
      <div>
        <h1 className='text-2xl font-semibold'>VAT Return</h1>
        <p className='text-muted-foreground text-sm'>
          Summary of VAT for the selected period.
        </p>
        <p className='text-muted-foreground mt-1 text-sm'>
          Financial year: {financialYear.label}
          {financialYear.isClosed ? ' (closed / read-only)' : ''}
        </p>
      </div>

      <div className='rounded-lg border p-4'>
        <div className='grid gap-4 md:grid-cols-2'>
          <div>
            <h2 className='font-medium'>Return frequency</h2>
            <p className='text-muted-foreground text-sm'>
              {getFrequencyLabel(vatReturnFrequency)}
            </p>
          </div>

          <div>
            <label className='mb-1 block text-sm font-medium'>
              Return period
            </label>

            <VatReturnPeriodSelect
              financialYearId={financialYearId}
              selectedStart={periodStartString}
              selectedEnd={periodEndString}
              options={periodOptions}
            />
          </div>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-3'>
        <div className='rounded-lg border p-4'>
          <p className='text-muted-foreground text-sm'>Output VAT</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatMoney(totals.outputVat)}
          </p>
        </div>

        <div className='rounded-lg border p-4'>
          <p className='text-muted-foreground text-sm'>Input VAT</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatMoney(totals.inputVat)}
          </p>
        </div>

        <div className='rounded-lg border p-4'>
          <p className='text-muted-foreground text-sm'>
            VAT payable / repayable
          </p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatMoneyWithBrackets(totals.netVat)}
          </p>
        </div>
      </div>

      <div className='overflow-hidden rounded-lg border'>
        <table className='w-full text-sm'>
          <thead className='bg-muted/50'>
            <tr>
              <th className='px-4 py-3 text-left font-medium'>Box</th>
              <th className='px-4 py-3 text-left font-medium'>Description</th>
              <th className='px-4 py-3 text-right font-medium'>Amount</th>
            </tr>
          </thead>

          <tbody>
            <tr className='border-t'>
              <td className='px-4 py-3'>Box 1</td>
              <td className='px-4 py-3'>Output VAT</td>
              <td className='px-4 py-3 text-right'>
                {formatMoney(totals.outputVat)}
              </td>
            </tr>
            <tr className='bg-muted/50 border-t'>
              <td className='px-4 py-3'>Box 2</td>
              <td className='px-4 py-3'>EU & NI VAT</td>
              <td className='px-4 py-3 text-right'>0</td>
            </tr>
            <tr className='border-t'>
              <td className='px-4 py-3'>Box 3</td>
              <td className='px-4 py-3'>Total Output VAT</td>
              <td className='px-4 py-3 text-right'>
                {formatMoney(totals.outputVat)}
              </td>
            </tr>

            <tr className='border-t'>
              <td className='px-4 py-3'>Box 4</td>
              <td className='px-4 py-3'>Input VAT</td>
              <td className='px-4 py-3 text-right'>
                {formatMoney(totals.inputVat)}
              </td>
            </tr>
            <tr className='bg-muted/30 border-t font-semibold'>
              <td className='px-4 py-3'>Box 5</td>
              <td className='px-4 py-3'>Net VAT payable / (repayable)</td>
              <td className='px-4 py-3 text-right'>
                {formatMoneyWithBrackets(totals.netVat)}
              </td>
            </tr>
            <tr className='border-t'>
              <td className='px-4 py-3'>Box 6</td>
              <td className='px-4 py-3'>
                Total value of sales and other outputs excluding VAT
              </td>
              <td className='px-4 py-3 text-right'>
                {formatMoney(totals.box6OutputsNet)}
              </td>
            </tr>

            <tr className='border-t'>
              <td className='px-4 py-3'>Box 7</td>
              <td className='px-4 py-3'>
                Total value of purchases and other inputs excluding VAT
              </td>
              <td className='px-4 py-3 text-right'>
                {formatMoney(totals.box7InputsNet)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className='overflow-hidden rounded-lg border'>
        <div className='border-b p-4'>
          <h2 className='font-medium'>Transactions included in this return</h2>
          <p className='text-muted-foreground text-sm'>
            VAT lines included in the selected return period.
          </p>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50'>
              <tr>
                <th className='px-4 py-3 text-left font-medium'>Date</th>
                <th className='px-4 py-3 text-left font-medium'>Reference</th>
                <th className='px-4 py-3 text-left font-medium'>Type</th>
                <th className='px-4 py-3 text-left font-medium'>Description</th>
                <th className='px-4 py-3 text-left font-medium'>Nominal</th>
                <th className='px-4 py-3 text-right font-medium'>VAT</th>
              </tr>
            </thead>

            <tbody>
              {transactionLines.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className='text-muted-foreground px-4 py-8 text-center'
                  >
                    No VAT transactions found for this period.
                  </td>
                </tr>
              ) : (
                transactionLines.map(line => (
                  <tr key={line.journalLineId} className='border-t'>
                    <td className='px-4 py-3'>
                      {new Date(line.date).toLocaleDateString('en-GB')}
                    </td>
                    <td className='px-4 py-3'>{line.reference}</td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        line.type === 'OUTPUT'
                          ? 'text-blue-600'
                          : 'text-zinc-700'
                      }`}
                    >
                      {line.type === 'INPUT' ? 'Input VAT' : 'Output VAT'}
                    </td>
                    <td className='px-4 py-3'>{line.description ?? '—'}</td>
                    <td className='px-4 py-3'>
                      {line.nominalCode} — {line.nominalName}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        line.type === 'OUTPUT' ? 'text-blue-600' : ''
                      }`}
                    >
                      {formatMoney(line.vatAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {transactionLines.length > 0 && (
              <tfoot className='bg-muted/50 border-t font-semibold'>
                <tr>
                  <td className='px-4 py-3' colSpan={5}>
                    Output VAT total
                  </td>
                  <td className='px-4 py-3 text-right'>
                    {formatMoney(transactionOutputVat)}
                  </td>
                </tr>

                <tr className='border-t'>
                  <td className='px-4 py-3' colSpan={5}>
                    Input VAT total
                  </td>
                  <td className='px-4 py-3 text-right'>
                    {formatMoney(transactionInputVat)}
                  </td>
                </tr>

                <tr className='border-t'>
                  <td className='px-4 py-3' colSpan={5}>
                    Net VAT payable / (repayable)
                  </td>
                  <td className='px-4 py-3 text-right'>
                    {formatMoneyWithBrackets(
                      transactionOutputVat - transactionInputVat
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {!financialYear.isClosed ? (
        <SubmitVatReturnButton
          financialYearId={financialYearId}
          periodStart={periodStart.toISOString()}
          periodEnd={periodEnd.toISOString()}
          netVat={totals.netVat}
        />
      ) : null}
    </div>
  )
}
