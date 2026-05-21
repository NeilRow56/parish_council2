import { headers } from 'next/headers'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { parishCouncils } from '@/db/schema'
import {
  calculateBox7Box8Reconciliation,
  calculateReceiptsAndPaymentsTotals,
  getEffectiveAccountingBasis,
  type AgarTotals,
  type AccountingBasis,
  type Box7Box8CurrentBalance,
  type Box7Box8Reconciliation
} from '@/lib/reports/agar'
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

function getAccountingBasisLabel(accountingBasis: AccountingBasis) {
  return accountingBasis === 'RECEIPTS_AND_PAYMENTS'
    ? 'Receipts and payments'
    : 'Income and expenditure (accruals basis)'
}

function formatSignedWholePounds(value: number) {
  const formatted = formatWholePounds(Math.abs(value))

  if (value > 0) return `+£${formatted}`
  if (value < 0) return `-£${formatted}`
  return '£0'
}

function ReconciliationAmount({ value }: { value: number }) {
  const className =
    value < 0
      ? 'text-red-700'
      : value > 0
        ? 'text-emerald-700'
        : 'text-slate-900'

  return <span className={className}>{formatSignedWholePounds(value)}</span>
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
            source: journalEntries.source,
            nominalCode: nominalCodes.code,
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

  const rawBox7Box8Difference =
    balancesCarriedForward - cashAndShortTermInvestments
  const shouldShowBox7Box8Reconciliation =
    accountingBasis === 'INCOME_AND_EXPENDITURE' ||
    Math.abs(rawBox7Box8Difference) >= 0.005

  const box7Box8Reconciliation: Box7Box8Reconciliation | null =
    shouldShowBox7Box8Reconciliation
      ? await (async () => {
          const openingRows = await db
            .select({
              code: nominalCodes.code,
              name: nominalCodes.name,
              category: nominalCodes.category,
              agarBox: nominalCodes.agarBox,
              isBank: nominalCodes.isBank,
              amount: sql<string>`coalesce(sum(${nominalOpeningBalances.amount}), 0)`
            })
            .from(nominalOpeningBalances)
            .innerJoin(
              nominalCodes,
              eq(nominalOpeningBalances.nominalCodeId, nominalCodes.id)
            )
            .where(
              and(
                eq(nominalOpeningBalances.parishCouncilId, parishCouncilId),
                eq(nominalOpeningBalances.financialYearId, year.id),
                eq(nominalCodes.type, 'BALANCE_SHEET')
              )
            )
            .groupBy(
              nominalCodes.code,
              nominalCodes.name,
              nominalCodes.category,
              nominalCodes.agarBox,
              nominalCodes.isBank
            )

          const movementRows = await db
            .select({
              code: nominalCodes.code,
              name: nominalCodes.name,
              category: nominalCodes.category,
              agarBox: nominalCodes.agarBox,
              isBank: nominalCodes.isBank,
              amount: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)`
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
                lte(journalEntries.date, year.endDate),
                // The AGAR reconciliation uses AGAR-adjusted balance sheet
                // balances, so VAT settlement journals do not clear the
                // debtor/creditor explanation used between Box 7 and Box 8.
                eq(journalEntries.excludeFromAgar, false),
                eq(nominalCodes.type, 'BALANCE_SHEET')
              )
            )
            .groupBy(
              nominalCodes.code,
              nominalCodes.name,
              nominalCodes.category,
              nominalCodes.agarBox,
              nominalCodes.isBank
            )

          const balancesByCode = new Map<string, Box7Box8CurrentBalance>()

          for (const row of openingRows) {
            balancesByCode.set(row.code, {
              code: row.code,
              name: row.name,
              category: row.category,
              agarBox: row.agarBox,
              isBank: row.isBank,
              balance: normalise(row.amount)
            })
          }

          for (const row of movementRows) {
            const existing = balancesByCode.get(row.code)

            balancesByCode.set(row.code, {
              code: row.code,
              name: row.name,
              category: row.category,
              agarBox: row.agarBox,
              isBank: row.isBank,
              balance: (existing?.balance ?? 0) + normalise(row.amount)
            })
          }

          const currentBalances = [...balancesByCode.values()]
          const agarAdjustedBox8Cash = currentBalances
            .filter(
              balance =>
                balance.isBank ||
                balance.agarBox === 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS'
            )
            .reduce((sum, balance) => sum + balance.balance, 0)

          const reconciliation = calculateBox7Box8Reconciliation({
            accountingBasis,
            box7Reserves: balancesCarriedForward,
            reportedBox8Cash: agarAdjustedBox8Cash,
            currentBalances
          })

          return accountingBasis === 'RECEIPTS_AND_PAYMENTS' &&
            reconciliation.agrees
            ? null
            : reconciliation
        })()
      : null

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

        {box7Box8Reconciliation ? (
          <section className='overflow-hidden rounded-xl border bg-white shadow-sm'>
            <div className='flex items-start justify-between gap-4 border-b p-4'>
              <div>
                <h2 className='font-semibold text-slate-900'>
                  Box 7 to Box 8 reconciliation
                </h2>
                <p className='text-sm text-slate-600'>
                  Box 7 is reserves/current fund. Box 8 is cash only;
                  non-cash balances explain the difference.
                </p>
              </div>

              <div
                className={
                  box7Box8Reconciliation.agrees
                    ? 'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800'
                    : 'rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800'
                }
              >
                {box7Box8Reconciliation.agrees
                  ? 'Agrees to Box 8'
                  : `Difference ${formatSignedWholePounds(
                      box7Box8Reconciliation.difference
                    )}`}
              </div>
            </div>

            <table className='w-full border-collapse text-sm'>
              <tbody>
                <tr className='border-t'>
                  <td className='px-4 py-3 font-medium'>
                    Box 7 reserves/current fund
                  </td>
                  <td className='px-4 py-3 text-right font-semibold'>
                    £{formatWholePounds(box7Box8Reconciliation.box7Reserves)}
                  </td>
                </tr>
                {box7Box8Reconciliation.rows.map(row => (
                  <tr key={row.code} className='border-t'>
                    <td className='px-4 py-3 text-slate-600'>{row.label}</td>
                    <td className='px-4 py-3 text-right font-medium'>
                      <ReconciliationAmount value={row.amount} />
                    </td>
                  </tr>
                ))}
                <tr className='border-t bg-slate-50'>
                  <td className='px-4 py-3 font-semibold'>
                    Reconciled Box 8 cash
                  </td>
                  <td className='px-4 py-3 text-right font-semibold'>
                    £
                    {formatWholePounds(
                      box7Box8Reconciliation.reconciledBox8Cash
                    )}
                  </td>
                </tr>
                <tr className='border-t'>
                  <td className='px-4 py-3 font-medium'>
                    AGAR-adjusted Box 8 cash and short-term investments
                  </td>
                  <td className='px-4 py-3 text-right font-semibold'>
                    £
                    {formatWholePounds(
                      box7Box8Reconciliation.reportedBox8Cash
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        ) : null}

        <p className='rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
          Draft report: boxes 1, 8, 9 and 10 now include opening balances where
          entered. Borrowings and fixed assets should still be reviewed before
          final AGAR submission.
        </p>
      </div>
    </main>
  )
}
