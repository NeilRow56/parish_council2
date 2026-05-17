import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer
} from '@react-pdf/renderer'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { createElement } from 'react'

import { db } from '@/db'
import { parishCouncils } from '@/db/schema'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
  nominalOpeningBalances
} from '@/db/schema/nominalLedger'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const h = createElement

type FinancialYear = {
  id: string
  label: string
  startDate: string
  endDate: string
}

type AgarRow = {
  box: string
  label: string
  guidance: string
  amount: number
}

type AgarReport = {
  councilName: string | null
  financialYear: FinancialYear
  rows: AgarRow[]
}

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

function escapeFilename(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: '#ffffff',
    color: '#111827',
    fontFamily: 'Helvetica',
    fontSize: 8
  },
  header: {
    marginBottom: 16
  },
  eyebrow: {
    marginBottom: 3,
    color: '#64748b',
    fontSize: 8,
    textTransform: 'uppercase'
  },
  title: {
    fontSize: 20,
    fontWeight: 700
  },
  subtitle: {
    marginTop: 5,
    color: '#475569',
    fontSize: 9
  },
  meta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  metaCard: {
    flex: 1,
    border: '1px solid #dbe3ee',
    borderRadius: 4,
    padding: 8
  },
  metaLabel: {
    marginBottom: 4,
    color: '#64748b',
    fontSize: 8
  },
  metaValue: {
    fontSize: 10,
    fontWeight: 700
  },
  table: {
    border: '1px solid #dbe3ee',
    borderBottom: 0
  },
  row: {
    flexDirection: 'row',
    borderBottom: '1px solid #dbe3ee',
    minHeight: 24
  },
  headerRow: {
    backgroundColor: '#111827',
    color: '#ffffff'
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 5
  },
  headerCell: {
    fontSize: 8,
    fontWeight: 700
  },
  boxCell: {
    width: 38
  },
  descriptionCell: {
    flex: 1.35
  },
  amountCell: {
    width: 88,
    textAlign: 'right'
  },
  guidanceCell: {
    flex: 1.75,
    color: '#475569'
  },
  amountText: {
    fontWeight: 700
  },
  note: {
    marginTop: 12,
    border: '1px solid #fde68a',
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#fffbeb',
    color: '#92400e',
    fontSize: 8
  },
  pageNumber: {
    position: 'absolute',
    right: 28,
    bottom: 18,
    color: '#64748b',
    fontSize: 8
  }
})

async function getFinancialYear({
  parishCouncilId,
  financialYearId
}: {
  parishCouncilId: string
  financialYearId?: string
}) {
  const [year] = financialYearId
    ? await db
        .select({
          id: financialYears.id,
          label: financialYears.label,
          startDate: financialYears.startDate,
          endDate: financialYears.endDate
        })
        .from(financialYears)
        .where(
          and(
            eq(financialYears.parishCouncilId, parishCouncilId),
            eq(financialYears.id, financialYearId)
          )
        )
        .limit(1)
    : await db
        .select({
          id: financialYears.id,
          label: financialYears.label,
          startDate: financialYears.startDate,
          endDate: financialYears.endDate
        })
        .from(financialYears)
        .where(
          and(
            eq(financialYears.parishCouncilId, parishCouncilId),
            eq(financialYears.isClosed, false)
          )
        )
        .orderBy(desc(financialYears.startDate))
        .limit(1)

  return year ?? null
}

async function getAgarReport({
  parishCouncilId,
  financialYear
}: {
  parishCouncilId: string
  financialYear: FinancialYear
}): Promise<AgarReport> {
  const [council] = await db
    .select({ name: parishCouncils.name })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  const [openingTotals] = await db
    .select({
      reserves: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.category} = 'Reserves'
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
        eq(nominalOpeningBalances.financialYearId, financialYear.id)
      )
    )

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
        eq(journalEntries.financialYearId, financialYear.id),
        gte(journalEntries.date, financialYear.startDate),
        lte(journalEntries.date, financialYear.endDate)
      )
    )

  const balancesBroughtForward = normalise(openingTotals?.reserves)

  const precept = normalise(totals?.precept)
  const otherReceipts = normalise(totals?.otherReceipts)
  const staffCosts = normalise(totals?.staffCosts)
  const loanRepayments = normalise(totals?.loanRepayments)
  const otherPayments = normalise(totals?.otherPayments)

  const cashAndShortTermInvestments =
    normalise(openingTotals?.cashAndShortTermInvestments) +
    normalise(totals?.cashAndShortTermInvestments)

  const fixedAssets =
    normalise(openingTotals?.fixedAssets) + normalise(totals?.fixedAssets)

  const borrowings =
    normalise(openingTotals?.borrowings) + normalise(totals?.borrowings)

  const balancesCarriedForward =
    balancesBroughtForward +
    precept +
    otherReceipts -
    staffCosts -
    loanRepayments -
    otherPayments

  return {
    councilName: council?.name ?? null,
    financialYear,
    rows: [
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
  }
}

function metaCard(label: string, value: string) {
  return h(
    View,
    { style: styles.metaCard },
    h(Text, { style: styles.metaLabel }, label),
    h(Text, { style: styles.metaValue }, value)
  )
}

function reportRow(row: AgarRow) {
  return h(
    View,
    { key: row.box, style: styles.row, wrap: false },
    h(Text, { style: [styles.cell, styles.boxCell] }, row.box),
    h(Text, { style: [styles.cell, styles.descriptionCell] }, row.label),
    h(
      Text,
      { style: [styles.cell, styles.amountCell, styles.amountText] },
      `£${formatWholePounds(row.amount)}`
    ),
    h(Text, { style: [styles.cell, styles.guidanceCell] }, row.guidance)
  )
}

function agarPdf(report: AgarReport) {
  return h(
    Document,
    {
      title: `AGAR accounting statements - ${report.financialYear.label}`,
      author: report.councilName ?? undefined
    },
    h(
      Page,
      { size: 'A4', orientation: 'landscape', style: styles.page },
      h(
        View,
        { style: styles.header },
        report.councilName
          ? h(Text, { style: styles.eyebrow }, report.councilName)
          : null,
        h(Text, { style: styles.title }, 'AGAR accounting statements'),
        h(
          Text,
          { style: styles.subtitle },
          'Draft Section 2 accounting statement totals'
        )
      ),
      h(
        View,
        { style: styles.meta },
        metaCard('Parish council', report.councilName ?? '—'),
        metaCard('Financial year', report.financialYear.label),
        metaCard(
          'Period',
          `${formatDate(report.financialYear.startDate)} to ${formatDate(
            report.financialYear.endDate
          )}`
        )
      ),
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: [styles.row, styles.headerRow], fixed: true },
          h(Text, { style: [styles.cell, styles.headerCell, styles.boxCell] }, 'Box'),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.descriptionCell] },
            'Description'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.amountCell] },
            report.financialYear.label
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.guidanceCell] },
            'Notes and guidance'
          )
        ),
        report.rows.map(reportRow)
      ),
      h(
        Text,
        { style: styles.note },
        'Draft report: boxes 1, 8, 9 and 10 include opening balances where entered. Borrowings and fixed assets should still be reviewed before final AGAR submission.'
      ),
      h(Text, {
        style: styles.pageNumber,
        render: ({
          pageNumber,
          totalPages
        }: {
          pageNumber: number
          totalPages: number
        }) => `Page ${pageNumber} of ${totalPages}`,
        fixed: true
      })
    )
  )
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return new Response('Unauthorised', { status: 401 })
  }

  const parishCouncilId = session.user.parishCouncilId
  const { searchParams } = new URL(request.url)
  const financialYearId = searchParams.get('financialYearId')

  const financialYear = await getFinancialYear({
    parishCouncilId,
    financialYearId: financialYearId ?? undefined
  })

  if (!financialYear) {
    return new Response('Financial year not found', { status: 404 })
  }

  const report = await getAgarReport({
    parishCouncilId,
    financialYear
  })

  const pdf = await renderToBuffer(agarPdf(report))
  const pdfBody = new ArrayBuffer(pdf.byteLength)
  new Uint8Array(pdfBody).set(pdf)
  const filename = `agar-summary-${escapeFilename(financialYear.label)}.pdf`

  return new Response(pdfBody, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
