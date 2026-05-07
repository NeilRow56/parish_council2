import { headers } from 'next/headers'
import { and, eq, gte, lte, sql } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { parishCouncils } from '@/db/schema'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'

function formatWholePounds(value: number) {
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 0
  }).format(Math.round(value))
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value))
}

function normalise(value: unknown) {
  return Number(value ?? 0)
}

export default async function AgarSummaryPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return <main className='p-6'>Unauthorised</main>
  }

  const parishCouncilId = session.user.parishCouncilId

  const [council] = await db
    .select()
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  const [year] = await db
    .select()
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1)

  if (!year) {
    return (
      <main className='p-6'>
        <h1 className='text-2xl font-semibold'>AGAR summary</h1>
        <p className='mt-2 text-sm text-slate-600'>
          No open financial year found.
        </p>
      </main>
    )
  }

  const [totals] = await db
    .select({
      precept: sql<string>`
      coalesce(sum(
        case
          when ${nominalCodes.agarBox} = 'BOX_2_PRECEPT'
          then ${journalLines.credit} - ${journalLines.debit}
          else 0
        end
      ), 0)
    `,

      otherReceipts: sql<string>`
      coalesce(sum(
        case
          when ${nominalCodes.agarBox} = 'BOX_3_OTHER_RECEIPTS'
          then ${journalLines.credit} - ${journalLines.debit}
          else 0
        end
      ), 0)
    `,

      staffCosts: sql<string>`
      coalesce(sum(
        case
          when ${nominalCodes.agarBox} = 'BOX_4_STAFF_COSTS'
          then ${journalLines.debit} - ${journalLines.credit}
          else 0
        end
      ), 0)
    `,

      loanRepayments: sql<string>`
      coalesce(sum(
        case
          when ${nominalCodes.agarBox} = 'BOX_5_LOAN_REPAYMENTS'
          then ${journalLines.debit} - ${journalLines.credit}
          else 0
        end
      ), 0)
    `,

      otherPayments: sql<string>`
      coalesce(sum(
        case
          when ${nominalCodes.agarBox} = 'BOX_6_OTHER_PAYMENTS'
          then ${journalLines.debit} - ${journalLines.credit}
          else 0
        end
      ), 0)
    `,

      cashAndShortTermInvestments: sql<string>`
      coalesce(sum(
        case
          when ${nominalCodes.agarBox} = 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS'
          then ${journalLines.debit} - ${journalLines.credit}
          else 0
        end
      ), 0)
    `,

      fixedAssets: sql<string>`
      coalesce(sum(
        case
          when ${nominalCodes.agarBox} = 'BOX_9_FIXED_ASSETS'
          then ${journalLines.debit} - ${journalLines.credit}
          else 0
        end
      ), 0)
    `,

      borrowings: sql<string>`
      coalesce(sum(
        case
          when ${nominalCodes.agarBox} = 'BOX_10_BORROWINGS'
          then ${journalLines.credit} - ${journalLines.debit}
          else 0
        end
      ), 0)
    `
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
        eq(journalEntries.financialYearId, year.id),
        gte(journalEntries.date, year.startDate),
        lte(journalEntries.date, year.endDate)
      )
    )

  const balancesBroughtForward = 0 // replace when opening balances are stored
  const precept = normalise(totals?.precept)
  const otherReceipts = normalise(totals?.otherReceipts)
  const staffCosts = normalise(totals?.staffCosts)
  const loanRepayments = normalise(totals?.loanRepayments)
  const otherPayments = normalise(totals?.otherPayments)
  const cashAndShortTermInvestments = normalise(
    totals?.cashAndShortTermInvestments
  )
  const fixedAssets = normalise(totals?.fixedAssets)
  const borrowings = normalise(totals?.borrowings)

  const balancesCarriedForward =
    balancesBroughtForward +
    precept +
    otherReceipts -
    staffCosts -
    loanRepayments -
    otherPayments

  const rows = [
    {
      box: '1',
      label: 'Balances brought forward',
      guidance: 'Total balances and reserves at the beginning of the year.',
      amount: balancesBroughtForward
    },
    {
      box: '2',
      label: '(+) Precept or rates and levies',
      guidance:
        'Total amount of precept, rates and levies received or receivable in the year.',
      amount: precept
    },
    {
      box: '3',
      label: '(+) Total other receipts',
      guidance: 'Total income or receipts less precept/rates/levies.',
      amount: otherReceipts
    },
    {
      box: '4',
      label: '(-) Staff costs',
      guidance:
        'Total expenditure or payments made to and on behalf of employees.',
      amount: staffCosts
    },
    {
      box: '5',
      label: '(-) Loan interest / capital repayments',
      guidance:
        'Total expenditure or payments of capital and interest on borrowings.',
      amount: loanRepayments
    },
    {
      box: '6',
      label: '(-) All other payments',
      guidance:
        'Total expenditure or payments less staff costs and loan repayments.',
      amount: otherPayments
    },
    {
      box: '7',
      label: '(=) Balances carried forward',
      guidance:
        'Total balances and reserves at the end of the year. Must equal (1 + 2 + 3) - (4 + 5 + 6).',
      amount: balancesCarriedForward
    },
    {
      box: '8',
      label: 'Total value of cash and short term investments',
      guidance:
        'Sum of current and deposit bank accounts, cash holdings and short term investments.',
      amount: cashAndShortTermInvestments
    },
    {
      box: '9',
      label: 'Total fixed assets plus long term investments and assets',
      guidance: 'Value of property and assets owned by the authority.',
      amount: fixedAssets
    },
    {
      box: '10',
      label: 'Total borrowings',
      guidance: 'Outstanding capital balance of loans from third parties.',
      amount: borrowings
    }
  ]

  return (
    <main className='min-h-screen bg-slate-50 p-6'>
      <div className='mx-auto max-w-7xl space-y-6'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-900'>
            AGAR accounting statements
          </h1>
          <p className='mt-1 text-sm text-slate-600'>
            Draft accounting statement totals for the current financial year.
          </p>
        </div>

        <section className='rounded-xl border bg-white p-4 shadow-sm'>
          <dl className='grid gap-4 text-sm md:grid-cols-3'>
            <div>
              <dt className='text-slate-500'>Parish council</dt>
              <dd className='mt-1 font-medium'>{council?.name ?? '—'}</dd>
            </div>

            <div>
              <dt className='text-slate-500'>Financial year</dt>
              <dd className='mt-1 font-medium'>{year.label}</dd>
            </div>

            <div>
              <dt className='text-slate-500'>Period</dt>
              <dd className='mt-1 font-medium'>
                {formatDate(year.startDate)} to {formatDate(year.endDate)}
              </dd>
            </div>
          </dl>
        </section>

        <section className='overflow-hidden rounded-xl border bg-white shadow-sm'>
          <div className='border-b p-4'>
            <h2 className='font-semibold text-slate-900'>
              Section 2 — Accounting statements
            </h2>
            <p className='text-sm text-slate-600'>
              Figures are rounded to the nearest £1.
            </p>
          </div>

          <table className='w-full border-collapse text-sm'>
            <thead className='bg-slate-900 text-left text-white'>
              <tr>
                <th className='w-24 px-4 py-3 font-medium'>Box</th>
                <th className='px-4 py-3 font-medium'>Description</th>
                <th className='w-48 px-4 py-3 text-right font-medium'>
                  {year.label}
                </th>
                <th className='px-4 py-3 font-medium'>Notes and guidance</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(row => (
                <tr key={row.box} className='border-t'>
                  <td className='px-4 py-3 font-semibold'>{row.box}</td>
                  <td className='px-4 py-3 font-medium'>{row.label}</td>
                  <td className='px-4 py-3 text-right font-semibold'>
                    £{formatWholePounds(row.amount)}
                  </td>
                  <td className='px-4 py-3 text-slate-600'>{row.guidance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className='rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
          Draft report: boxes 1, 8, 9 and 10 may need refinement once opening
          balances, fixed assets and borrowings are finalised.
        </p>
      </div>
    </main>
  )
}
