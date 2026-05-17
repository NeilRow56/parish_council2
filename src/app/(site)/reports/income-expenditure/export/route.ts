import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer
} from '@react-pdf/renderer'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { createElement } from 'react'

import { db } from '@/db'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
  parishCouncils
} from '@/db/schema'
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

type ReportRow = {
  nominalCodeId: string
  code: string
  name: string
  type: 'INCOME' | 'EXPENDITURE'
  amount: number
}

type IncomeExpenditureReport = {
  financialYear: FinancialYear
  incomeRows: ReportRow[]
  expenditureRows: ReportRow[]
  totalIncome: number
  totalExpenditure: number
  surplusOrDeficit: number
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

function escapeFilename(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}

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

const styles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: '#ffffff',
    color: '#111827',
    fontFamily: 'Helvetica',
    fontSize: 9
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
  summary: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  summaryCard: {
    flex: 1,
    border: '1px solid #dbe3ee',
    borderRadius: 4,
    padding: 8
  },
  summaryLabel: {
    marginBottom: 4,
    color: '#64748b',
    fontSize: 8
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: 700
  },
  section: {
    marginBottom: 14
  },
  sectionTitle: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 700
  },
  table: {
    border: '1px solid #dbe3ee',
    borderBottom: 0
  },
  row: {
    flexDirection: 'row',
    borderBottom: '1px solid #dbe3ee',
    minHeight: 20
  },
  headerRow: {
    backgroundColor: '#f8fafc'
  },
  totalRow: {
    backgroundColor: '#f8fafc'
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 5
  },
  headerCell: {
    color: '#475569',
    fontSize: 8,
    fontWeight: 700
  },
  codeCell: {
    width: 70
  },
  nameCell: {
    flex: 1
  },
  moneyCell: {
    width: 110,
    textAlign: 'right'
  },
  totalLabelCell: {
    flex: 1,
    fontWeight: 700
  },
  totalMoneyCell: {
    width: 110,
    fontWeight: 700,
    textAlign: 'right'
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
  const [financialYear] = financialYearId
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

  return financialYear ?? null
}

async function getIncomeExpenditureReport({
  parishCouncilId,
  financialYear
}: {
  parishCouncilId: string
  financialYear: FinancialYear
}): Promise<IncomeExpenditureReport> {
  const rows = await db
    .select({
      nominalCodeId: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      type: nominalCodes.type,
      debit: sql<number>`
        coalesce(sum(
          case
            when ${journalEntries.id} is not null
            then ${journalLines.debit}
            else 0
          end
        ), 0)
      `,
      credit: sql<number>`
        coalesce(sum(
          case
            when ${journalEntries.id} is not null
            then ${journalLines.credit}
            else 0
          end
        ), 0)
      `
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
        eq(nominalCodes.financialYearId, financialYear.id),
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
      nominalCodeId: row.nominalCodeId,
      code: row.code,
      name: row.name,
      type: row.type as 'INCOME' | 'EXPENDITURE',
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

  return {
    financialYear,
    incomeRows,
    expenditureRows,
    totalIncome,
    totalExpenditure,
    surplusOrDeficit: totalIncome - totalExpenditure
  }
}

function summaryCard(label: string, value: string) {
  return h(
    View,
    { style: styles.summaryCard },
    h(Text, { style: styles.summaryLabel }, label),
    h(Text, { style: styles.summaryValue }, value)
  )
}

function tableHeader() {
  return h(
    View,
    { style: [styles.row, styles.headerRow], fixed: true },
    h(Text, { style: [styles.cell, styles.headerCell, styles.codeCell] }, 'Code'),
    h(Text, { style: [styles.cell, styles.headerCell, styles.nameCell] }, 'Name'),
    h(
      Text,
      { style: [styles.cell, styles.headerCell, styles.moneyCell] },
      'Amount'
    )
  )
}

function reportRow(row: ReportRow) {
  return h(
    View,
    { key: row.nominalCodeId, style: styles.row, wrap: false },
    h(Text, { style: [styles.cell, styles.codeCell] }, row.code),
    h(Text, { style: [styles.cell, styles.nameCell] }, row.name),
    h(Text, { style: [styles.cell, styles.moneyCell] }, formatAmount(row.amount))
  )
}

function reportSection({
  title,
  rows,
  total,
  totalLabel
}: {
  title: string
  rows: ReportRow[]
  total: number
  totalLabel: string
}) {
  return h(
    View,
    { style: styles.section },
    h(Text, { style: styles.sectionTitle }, title),
    h(
      View,
      { style: styles.table },
      tableHeader(),
      rows.length > 0
        ? rows.map(reportRow)
        : h(
            View,
            { style: styles.row },
            h(Text, { style: [styles.cell, styles.nameCell] }, 'No entries'),
            h(Text, { style: [styles.cell, styles.moneyCell] }, '—')
          ),
      h(
        View,
        { style: [styles.row, styles.totalRow], wrap: false },
        h(Text, { style: [styles.cell, styles.totalLabelCell] }, totalLabel),
        h(Text, { style: [styles.cell, styles.totalMoneyCell] }, formatAmount(total))
      )
    )
  )
}

function incomeExpenditurePdf({
  parishCouncilName,
  report
}: {
  parishCouncilName: string | null
  report: IncomeExpenditureReport
}) {
  return h(
    Document,
    {
      title: `Income and Expenditure - ${report.financialYear.label}`,
      author: parishCouncilName ?? undefined
    },
    h(
      Page,
      { size: 'A4', orientation: 'portrait', style: styles.page },
      h(
        View,
        { style: styles.header },
        parishCouncilName
          ? h(Text, { style: styles.eyebrow }, parishCouncilName)
          : null,
        h(Text, { style: styles.title }, 'Income & Expenditure'),
        h(
          Text,
          { style: styles.subtitle },
          `Financial year ${report.financialYear.label} - ${formatDate(
            report.financialYear.startDate
          )} to ${formatDate(report.financialYear.endDate)}`
        )
      ),
      h(
        View,
        { style: styles.summary },
        summaryCard('Total income', formatCurrency(report.totalIncome)),
        summaryCard('Total expenditure', formatCurrency(report.totalExpenditure)),
        summaryCard(
          report.surplusOrDeficit >= 0 ? 'Surplus' : 'Deficit',
          formatCurrency(report.surplusOrDeficit)
        )
      ),
      reportSection({
        title: 'Income',
        rows: report.incomeRows,
        total: report.totalIncome,
        totalLabel: 'Total income'
      }),
      reportSection({
        title: 'Expenditure',
        rows: report.expenditureRows,
        total: report.totalExpenditure,
        totalLabel: 'Total expenditure'
      }),
      h(
        View,
        { style: [styles.row, styles.totalRow], wrap: false },
        h(
          Text,
          { style: [styles.cell, styles.totalLabelCell] },
          report.surplusOrDeficit >= 0
            ? 'Surplus for the year'
            : 'Deficit for the year'
        ),
        h(
          Text,
          { style: [styles.cell, styles.totalMoneyCell] },
          formatAmount(report.surplusOrDeficit)
        )
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

  const [parishCouncil] = await db
    .select({ name: parishCouncils.name })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  const report = await getIncomeExpenditureReport({
    parishCouncilId,
    financialYear
  })

  const pdf = await renderToBuffer(
    incomeExpenditurePdf({
      parishCouncilName: parishCouncil?.name ?? null,
      report
    })
  )
  const pdfBody = new ArrayBuffer(pdf.byteLength)
  new Uint8Array(pdfBody).set(pdf)
  const filename = `income-expenditure-${escapeFilename(financialYear.label)}.pdf`

  return new Response(pdfBody, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
