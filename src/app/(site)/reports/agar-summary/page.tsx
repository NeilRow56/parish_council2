import { headers } from 'next/headers'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { parishCouncils } from '@/db/schema'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
  nominalOpeningBalances
} from '@/db/schema/nominalLedger'
import { ExportPdfButton } from './_components/export-pdf-button'

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

type SearchParams = {
  financialYearId?: string
}

type AccountingBasis = 'RECEIPTS_AND_PAYMENTS' | 'INCOME_AND_EXPENDITURE'

type AgarTotals = {
  precept: number
  otherReceipts: number
  staffCosts: number
  loanRepayments: number
  otherPayments: number
  cashAndShortTermInvestments: number
  fixedAssets: number
  borrowings: number
}

type AgarLine = {
  journalEntryId: string
  excludeFromAgar: boolean
  agarBox: string | null
  isBank: boolean
  isVatRecoverable: boolean
  isVatPayable: boolean
  debit: string
  credit: string
}

function getEffectiveAccountingBasis(
  value: string | null | undefined
): AccountingBasis {
  if (value === 'RECEIPTS_AND_PAYMENTS') return 'RECEIPTS_AND_PAYMENTS'
  return 'INCOME_AND_EXPENDITURE'
}

function getAccountingBasisLabel(accountingBasis: AccountingBasis) {
  return accountingBasis === 'RECEIPTS_AND_PAYMENTS'
    ? 'Receipts and payments'
    : 'Income and expenditure (accruals basis)'
}

function calculateReceiptsAndPaymentsTotals(
  baseTotals: AgarTotals,
  lines: AgarLine[]
): AgarTotals {
  const totals = { ...baseTotals }

  const linesByJournal = new Map<string, AgarLine[]>()

  for (const line of lines) {
    const existingLines = linesByJournal.get(line.journalEntryId) ?? []
    existingLines.push(line)
    linesByJournal.set(line.journalEntryId, existingLines)
  }

  for (const journalLinesForEntry of linesByJournal.values()) {
    if (journalLinesForEntry.some(line => line.excludeFromAgar)) {
      continue
    }

    const nonBankReportingLines = journalLinesForEntry.filter(
      line => !line.isBank && !line.isVatRecoverable && !line.isVatPayable
    )

    const hasPaymentBoxLine = nonBankReportingLines.some(
      line =>
        line.agarBox === 'BOX_4_STAFF_COSTS' ||
        line.agarBox === 'BOX_5_LOAN_REPAYMENTS' ||
        line.agarBox === 'BOX_6_OTHER_PAYMENTS' ||
        line.agarBox === 'BOX_9_FIXED_ASSETS'
    )

    const fixedAssetPayments = nonBankReportingLines
      .filter(line => line.agarBox === 'BOX_9_FIXED_ASSETS')
      .reduce(
        (sum, line) =>
          sum + Math.max(0, normalise(line.debit) - normalise(line.credit)),
        0
      )
    const borrowingCapitalRepayments = nonBankReportingLines
      .filter(line => line.agarBox === 'BOX_10_BORROWINGS')
      .reduce(
        (sum, line) =>
          sum + Math.max(0, normalise(line.debit) - normalise(line.credit)),
        0
      )

    totals.otherPayments += fixedAssetPayments
    totals.loanRepayments += borrowingCapitalRepayments

    for (const line of journalLinesForEntry) {
      if (line.isVatRecoverable && hasPaymentBoxLine) {
        totals.otherPayments += normalise(line.debit)
      }

      if (line.isVatRecoverable || line.isVatPayable) {
        totals.otherReceipts += normalise(line.credit)
      }
    }
  }

  return totals
}

export default async function AgarSummaryPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>
}) {
  const params = await searchParams

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

  const [year] = params?.financialYearId
    ? await db
        .select()
        .from(financialYears)
        .where(
          and(
            eq(financialYears.parishCouncilId, parishCouncilId),
            eq(financialYears.id, params.financialYearId)
          )
        )
        .limit(1)
    : await db
        .select()
        .from(financialYears)
        .where(
          and(
            eq(financialYears.parishCouncilId, parishCouncilId),
            eq(financialYears.isClosed, false)
          )
        )
        .orderBy(desc(financialYears.startDate))
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

  const [openingTotals] = await db
    .select({
      reserves: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.category} = 'Reserves'
              and ${nominalCodes.code} not in ('3090', '3095')
            then ${nominalOpeningBalances.amount}
            else 0
          end
        ), 0)
      `,

      cashAndShortTermInvestments: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS'
            then ${nominalOpeningBalances.amount}
            else 0
          end
        ), 0)
      `,

      fixedAssets: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_9_FIXED_ASSETS'
            then ${nominalOpeningBalances.amount}
            else 0
          end
        ), 0)
      `,

      borrowings: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_10_BORROWINGS'
            then ${nominalOpeningBalances.amount}
            else 0
          end
        ), 0)
      `
    })
    .from(nominalOpeningBalances)
    .innerJoin(
      nominalCodes,
      eq(nominalOpeningBalances.nominalCodeId, nominalCodes.id)
    )
    .where(
      and(
        eq(nominalOpeningBalances.parishCouncilId, parishCouncilId),
        eq(nominalOpeningBalances.financialYearId, year.id)
      )
    )

  const accountingBasis = getEffectiveAccountingBasis(council?.accountingBasis)
  const includeOperationalAgarEntrySql =
    accountingBasis === 'RECEIPTS_AND_PAYMENTS'
      ? sql`${journalEntries.excludeFromAgar} = false`
      : sql`true`

  const [totals] = await db
    .select({
      precept: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_2_PRECEPT'
              and ${includeOperationalAgarEntrySql}
            then ${journalLines.credit} - ${journalLines.debit}
            else 0
          end
        ), 0)
      `,

      otherReceipts: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_3_OTHER_RECEIPTS'
              and ${includeOperationalAgarEntrySql}
            then ${journalLines.credit} - ${journalLines.debit}
            else 0
          end
        ), 0)
      `,

      staffCosts: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_4_STAFF_COSTS'
              and ${includeOperationalAgarEntrySql}
            then ${journalLines.debit} - ${journalLines.credit}
            else 0
          end
        ), 0)
      `,

      loanRepayments: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_5_LOAN_REPAYMENTS'
              and ${includeOperationalAgarEntrySql}
            then ${journalLines.debit} - ${journalLines.credit}
            else 0
          end
        ), 0)
      `,

      otherPayments: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_6_OTHER_PAYMENTS'
              and ${includeOperationalAgarEntrySql}
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

  const baseTotals: AgarTotals = {
    precept: normalise(totals?.precept),
    otherReceipts: normalise(totals?.otherReceipts),
    staffCosts: normalise(totals?.staffCosts),
    loanRepayments: normalise(totals?.loanRepayments),
    otherPayments: normalise(totals?.otherPayments),
    cashAndShortTermInvestments: normalise(totals?.cashAndShortTermInvestments),
    fixedAssets: normalise(totals?.fixedAssets),
    borrowings: normalise(totals?.borrowings)
  }

  const agarLineRows =
    accountingBasis === 'RECEIPTS_AND_PAYMENTS'
      ? await db
          .select({
            journalEntryId: journalLines.journalEntryId,
            excludeFromAgar: journalEntries.excludeFromAgar,
            agarBox: nominalCodes.agarBox,
            isBank: nominalCodes.isBank,
            isVatRecoverable: nominalCodes.isVatRecoverable,
            isVatPayable: nominalCodes.isVatPayable,
            debit: journalLines.debit,
            credit: journalLines.credit
          })
          .from(journalLines)
          .innerJoin(
            journalEntries,
            eq(journalLines.journalEntryId, journalEntries.id)
          )
          .innerJoin(
            nominalCodes,
            eq(journalLines.nominalCodeId, nominalCodes.id)
          )
          .where(
            and(
              eq(journalEntries.parishCouncilId, parishCouncilId),
              eq(journalEntries.financialYearId, year.id),
              gte(journalEntries.date, year.startDate),
              lte(journalEntries.date, year.endDate)
            )
          )
      : []

  const reportTotals =
    accountingBasis === 'RECEIPTS_AND_PAYMENTS'
      ? calculateReceiptsAndPaymentsTotals(baseTotals, agarLineRows)
      : baseTotals

  const openingFixedAssets = normalise(openingTotals?.fixedAssets)
  const openingBorrowings = Math.abs(normalise(openingTotals?.borrowings))
  const balancesBroughtForward = Math.abs(normalise(openingTotals?.reserves))

  const precept = reportTotals.precept
  const otherReceipts = reportTotals.otherReceipts
  const staffCosts = reportTotals.staffCosts
  const loanRepayments = reportTotals.loanRepayments
  const otherPayments = reportTotals.otherPayments

  const cashAndShortTermInvestments =
    normalise(openingTotals?.cashAndShortTermInvestments) +
    reportTotals.cashAndShortTermInvestments

  const fixedAssets = openingFixedAssets + reportTotals.fixedAssets

  const borrowings = openingBorrowings + reportTotals.borrowings

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
      guidance:
        'Opening cash-backed balances and reserves, excluding fixed assets and borrowings.',
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
        'Closing cash-backed balances and reserves, excluding fixed assets and borrowings. Must equal (1 + 2 + 3) - (4 + 5 + 6).',
      amount: balancesCarriedForward
    },
    {
      box: '8',
      label: 'Total value of cash and short term investments',
      guidance:
        'Opening bank balances plus current year bank account movements.',
      amount: cashAndShortTermInvestments
    },
    {
      box: '9',
      label: 'Total fixed assets plus long term investments and assets',
      guidance: 'Opening fixed assets plus current year fixed asset movements.',
      amount: fixedAssets
    },
    {
      box: '10',
      label: 'Total borrowings',
      guidance: 'Opening borrowings plus current year borrowing movements.',
      amount: borrowings
    }
  ]
  const exportHref = `/reports/agar-summary/export?financialYearId=${year.id}`

  return (
    <main className='min-h-screen bg-slate-50 p-6'>
      <div className='mx-auto max-w-7xl space-y-6'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>
              AGAR accounting statements
            </h1>
            <p className='mt-1 text-sm text-slate-600'>
              Draft accounting statement totals for the current financial year.
            </p>
          </div>

          <ExportPdfButton href={exportHref} />
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

            <div>
              <dt className='text-slate-500'>Accounting basis</dt>
              <dd className='mt-1 font-medium'>
                {getAccountingBasisLabel(accountingBasis)}
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
          Draft report: boxes 1, 8, 9 and 10 now include opening balances where
          entered. Borrowings and fixed assets should still be reviewed before
          final AGAR submission.
        </p>
      </div>
    </main>
  )
}
