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
import { parishCouncils } from '@/db/schema'
import {
  budgets,
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
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
  isClosed: boolean
}

type BudgetRow = {
  id: string
  code: string
  name: string
  type: 'INCOME' | 'EXPENDITURE'
  category: string | null
  actualAmount: number
  budget: number
  variance: number
  notes: string | null
}

type BudgetReport = {
  councilName: string | null
  financialYear: FinancialYear
  receiptRows: BudgetRow[]
  paymentRows: BudgetRow[]
  totalReceiptsActual: number
  totalReceiptsBudget: number
  totalPaymentsActual: number
  totalPaymentsBudget: number
  actualSurplus: number
  budgetSurplus: number
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

function formatAmount(value: number) {
  if (value === 0) return '-'

  return value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatWholePounds(value: number) {
  if (value === 0) return '-'

  return Math.round(value).toLocaleString('en-GB')
}

function formatCurrency(value: number) {
  if (Math.round(value * 100) === 0) return '£-'

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `£(${amount})` : `£${amount}`
}

function escapeFilename(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}

function normaliseNote(value: string | null | undefined) {
  const note = value?.trim()

  return note ? note : null
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
    marginBottom: 14
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
    marginBottom: 14
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
    fontSize: 12,
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
    minHeight: 22
  },
  headerRow: {
    backgroundColor: '#111827',
    color: '#ffffff'
  },
  totalRow: {
    backgroundColor: '#f8fafc'
  },
  cell: {
    paddingHorizontal: 5,
    paddingVertical: 5
  },
  headerCell: {
    fontSize: 7.5,
    fontWeight: 700
  },
  codeCell: {
    width: 58
  },
  nameCell: {
    flex: 1
  },
  moneyCell: {
    width: 82,
    textAlign: 'right'
  },
  totalLabelCell: {
    flex: 1,
    fontWeight: 700
  },
  totalMoneyCell: {
    width: 82,
    fontWeight: 700,
    textAlign: 'right'
  },
  adverseVariance: {
    color: '#dc2626'
  },
  muted: {
    color: '#64748b',
    fontSize: 7
  },
  noteBox: {
    marginTop: 6,
    border: '1px solid #dbe3ee',
    borderRadius: 4,
    padding: 8
  },
  noteTitle: {
    marginBottom: 4,
    fontSize: 9,
    fontWeight: 700
  },
  noteText: {
    color: '#475569',
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
  const [financialYear] = financialYearId
    ? await db
        .select({
          id: financialYears.id,
          label: financialYears.label,
          startDate: financialYears.startDate,
          endDate: financialYears.endDate,
          isClosed: financialYears.isClosed
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
          endDate: financialYears.endDate,
          isClosed: financialYears.isClosed
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

async function getBudgetReport({
  parishCouncilId,
  financialYear
}: {
  parishCouncilId: string
  financialYear: FinancialYear
}): Promise<BudgetReport> {
  const [council] = await db
    .select({ name: parishCouncils.name })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  const codes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      type: nominalCodes.type,
      category: nominalCodes.category
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id),
        inArray(nominalCodes.type, ['INCOME', 'EXPENDITURE'])
      )
    )
    .orderBy(nominalCodes.type, nominalCodes.code)

  const actualRows = await db
    .select({
      nominalCodeId: journalLines.nominalCodeId,
      debit: sql<number>`coalesce(sum(${journalLines.debit}), 0)`,
      credit: sql<number>`coalesce(sum(${journalLines.credit}), 0)`
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalEntries.id, journalLines.journalEntryId)
    )
    .where(
      and(
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, financialYear.id)
      )
    )
    .groupBy(journalLines.nominalCodeId)

  const budgetRows = await db
    .select({
      nominalCodeId: budgets.nominalCodeId,
      amount: budgets.amount,
      notes: budgets.notes
    })
    .from(budgets)
    .where(
      and(
        eq(budgets.parishCouncilId, parishCouncilId),
        eq(budgets.financialYearId, financialYear.id)
      )
    )

  const actualsByCode = new Map(
    actualRows.map(row => [
      row.nominalCodeId,
      {
        debit: Number(row.debit ?? 0),
        credit: Number(row.credit ?? 0)
      }
    ])
  )

  const budgetsByCode = new Map(
    budgetRows.map(row => [
      row.nominalCodeId,
      {
        amount: Number(row.amount ?? 0),
      notes: normaliseNote(row.notes)
      }
    ])
  )

  const rows = codes.map(code => {
    const actual = actualsByCode.get(code.id)
    const budget = budgetsByCode.get(code.id)
    const budgetAmount = budget?.amount ?? 0
    const actualAmount =
      code.type === 'INCOME'
        ? (actual?.credit ?? 0) - (actual?.debit ?? 0)
        : (actual?.debit ?? 0) - (actual?.credit ?? 0)

    return {
      id: code.id,
      code: code.code,
      name: code.name,
      type: code.type as 'INCOME' | 'EXPENDITURE',
      category: code.category,
      actualAmount,
      budget: budgetAmount,
      variance: budgetAmount - actualAmount,
      notes: normaliseNote(budget?.notes)
    }
  })

  const receiptRows = rows.filter(row => row.type === 'INCOME')
  const paymentRows = rows.filter(row => row.type === 'EXPENDITURE')
  const totalReceiptsActual = receiptRows.reduce(
    (sum, row) => sum + row.actualAmount,
    0
  )
  const totalReceiptsBudget = receiptRows.reduce(
    (sum, row) => sum + row.budget,
    0
  )
  const totalPaymentsActual = paymentRows.reduce(
    (sum, row) => sum + row.actualAmount,
    0
  )
  const totalPaymentsBudget = paymentRows.reduce(
    (sum, row) => sum + row.budget,
    0
  )

  return {
    councilName: council?.name ?? null,
    financialYear,
    receiptRows,
    paymentRows,
    totalReceiptsActual,
    totalReceiptsBudget,
    totalPaymentsActual,
    totalPaymentsBudget,
    actualSurplus: totalReceiptsActual - totalPaymentsActual,
    budgetSurplus: totalReceiptsBudget - totalPaymentsBudget
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

function budgetRow(row: BudgetRow) {
  return h(
    View,
    { key: row.id, style: styles.row, wrap: false },
    h(Text, { style: [styles.cell, styles.codeCell] }, row.code),
    h(
      View,
      { style: [styles.cell, styles.nameCell] },
      h(Text, null, row.name),
      row.category ? h(Text, { style: styles.muted }, row.category) : null
    ),
    h(Text, { style: [styles.cell, styles.moneyCell] }, formatAmount(row.actualAmount)),
    h(Text, { style: [styles.cell, styles.moneyCell] }, formatWholePounds(row.budget)),
    h(
      Text,
      {
        style: [
          styles.cell,
          styles.moneyCell,
          row.variance < 0 ? styles.adverseVariance : {}
        ]
      },
      formatCurrency(row.variance)
    )
  )
}

function budgetSection(title: string, rows: BudgetRow[]) {
  const totalActual = rows.reduce((sum, row) => sum + row.actualAmount, 0)
  const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0)
  const totalVariance = totalBudget - totalActual

  return h(
    View,
    { style: styles.section },
    h(Text, { style: styles.sectionTitle }, title),
    h(
      View,
      { style: styles.table },
      h(
        View,
        { style: [styles.row, styles.headerRow], fixed: true },
        h(Text, { style: [styles.cell, styles.headerCell, styles.codeCell] }, 'Code'),
        h(
          Text,
          { style: [styles.cell, styles.headerCell, styles.nameCell] },
          'Nominal code'
        ),
        h(
          Text,
          { style: [styles.cell, styles.headerCell, styles.moneyCell] },
          'Actual (£)'
        ),
        h(
          Text,
          { style: [styles.cell, styles.headerCell, styles.moneyCell] },
          'Budget (£)'
        ),
        h(
          Text,
          { style: [styles.cell, styles.headerCell, styles.moneyCell] },
          'Variance (£)'
        )
      ),
      rows.length > 0
        ? rows.map(budgetRow)
        : h(
            View,
            { style: styles.row },
            h(Text, { style: [styles.cell, styles.totalLabelCell] }, 'No nominal codes found.')
          ),
      h(
        View,
        { style: [styles.row, styles.totalRow], wrap: false },
        h(
          Text,
          { style: [styles.cell, styles.codeCell, { fontWeight: 700 }] },
          'Total'
        ),
        h(
          Text,
          { style: [styles.cell, styles.nameCell, { fontWeight: 700 }] },
          title.toLowerCase()
        ),
        h(Text, { style: [styles.cell, styles.totalMoneyCell] }, formatAmount(totalActual)),
        h(
          Text,
          { style: [styles.cell, styles.totalMoneyCell] },
          formatWholePounds(totalBudget)
        ),
        h(
          Text,
          {
            style: [
              styles.cell,
              styles.totalMoneyCell,
              totalVariance < 0 ? styles.adverseVariance : {}
            ]
          },
          formatCurrency(totalVariance)
        )
      )
    )
  )
}

function notesSection(rows: BudgetRow[]) {
  const rowsWithNotes = rows.flatMap(row => {
    const note = normaliseNote(row.notes)

    return note ? [{ ...row, notes: note }] : []
  })

  if (rowsWithNotes.length === 0) return null

  return h(
    View,
    { style: styles.noteBox },
    h(Text, { style: styles.noteTitle }, 'Budget notes'),
    ...rowsWithNotes.map(row =>
      h(
        Text,
        { key: row.id, style: styles.noteText },
        `${row.code} ${row.name}: ${row.notes}`
      )
    )
  )
}

function budgetPdf(report: BudgetReport) {
  const allRows = [...report.receiptRows, ...report.paymentRows]

  return h(
    Document,
    {
      title: `Budget - ${report.financialYear.label}`,
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
        h(Text, { style: styles.title }, 'Budget'),
        h(
          Text,
          { style: styles.subtitle },
          `Financial year ${report.financialYear.label} - ${formatDate(
            report.financialYear.startDate
          )} to ${formatDate(report.financialYear.endDate)}${
            report.financialYear.isClosed ? ' - Closed / read-only' : ''
          }`
        )
      ),
      h(
        View,
        { style: styles.summary },
        summaryCard('Receipts budget', formatCurrency(report.totalReceiptsBudget)),
        summaryCard('Payments budget', formatCurrency(report.totalPaymentsBudget)),
        summaryCard('Budget surplus / deficit', formatCurrency(report.budgetSurplus)),
        summaryCard(
          'Actual surplus / deficit',
          formatCurrency(report.actualSurplus)
        )
      ),
      budgetSection('Receipts', report.receiptRows),
      budgetSection('Payments', report.paymentRows),
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: [styles.row, styles.totalRow], wrap: false },
          h(
            Text,
            { style: [styles.cell, styles.totalLabelCell] },
            'Surplus/(deficit) against budget'
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatCurrency(report.actualSurplus)
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatWholePounds(report.budgetSurplus)
          ),
          h(
            Text,
            {
              style: [
                styles.cell,
                styles.totalMoneyCell,
                report.budgetSurplus - report.actualSurplus < 0
                  ? styles.adverseVariance
                  : {}
              ]
            },
            formatCurrency(report.budgetSurplus - report.actualSurplus)
          )
        )
      ),
      notesSection(allRows),
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

  const report = await getBudgetReport({
    parishCouncilId,
    financialYear
  })

  const pdf = await renderToBuffer(budgetPdf(report))
  const pdfBody = new ArrayBuffer(pdf.byteLength)
  new Uint8Array(pdfBody).set(pdf)
  const filename = `budget-${escapeFilename(financialYear.label)}.pdf`

  return new Response(pdfBody, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
