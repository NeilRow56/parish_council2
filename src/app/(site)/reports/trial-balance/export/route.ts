import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer
} from '@react-pdf/renderer'
import { and, eq, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { createElement } from 'react'

import { db } from '@/db'
import {
  journalEntries,
  journalLines,
  nominalCodes,
  nominalOpeningBalances,
  parishCouncils
} from '@/db/schema'
import { auth } from '@/lib/auth'
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const h = createElement

type TrialBalanceFinancialYear = {
  id: string
  label: string
  startDate: string
  endDate: string
}

type TrialBalanceRow = {
  nominalCodeId: string
  code: string
  name: string
  type: 'INCOME' | 'EXPENDITURE' | 'BALANCE_SHEET'
  debit: number
  credit: number
  balance: number
}

type TrialBalanceReport = {
  financialYear: TrialBalanceFinancialYear
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  difference: number
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
  return value === 0
    ? '—'
    : value.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
}

function formatCurrency(value: number) {
  return value === 0 ? '£—' : `£${formatAmount(value)}`
}

function formatDifference(value: number) {
  if (value === 0) return '£—'

  return value < 0
    ? `£(${formatAmount(Math.abs(value))})`
    : `£${formatAmount(value)}`
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
    width: 58
  },
  nameCell: {
    flex: 1.9
  },
  typeCell: {
    width: 92
  },
  moneyCell: {
    width: 88,
    textAlign: 'right'
  },
  totalLabelCell: {
    flex: 1,
    fontWeight: 700
  },
  totalMoneyCell: {
    width: 88,
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
  const { financialYear } = await getSelectedFinancialYear(
    parishCouncilId,
    financialYearId
  )

  return financialYear ?? null
}

async function getTrialBalanceReport({
  parishCouncilId,
  financialYear
}: {
  parishCouncilId: string
  financialYear: TrialBalanceFinancialYear
}): Promise<TrialBalanceReport> {
  const rows = await db
    .select({
      nominalCodeId: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      type: nominalCodes.type,
      openingBalance: sql<number>`coalesce(max(${nominalOpeningBalances.amount}), 0)`,
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
    .leftJoin(
      nominalOpeningBalances,
      and(
        eq(nominalOpeningBalances.nominalCodeId, nominalCodes.id),
        eq(nominalOpeningBalances.financialYearId, financialYear.id),
        eq(nominalOpeningBalances.parishCouncilId, parishCouncilId)
      )
    )
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
        eq(nominalCodes.financialYearId, financialYear.id)
      )
    )
    .groupBy(
      nominalCodes.id,
      nominalCodes.code,
      nominalCodes.name,
      nominalCodes.type
    )
    .orderBy(nominalCodes.code)

  const trialBalanceRows = rows.map(row => {
    const openingBalance =
      row.type === 'BALANCE_SHEET' ? Number(row.openingBalance ?? 0) : 0
    const currentYearDebit = Number(row.debit ?? 0)
    const currentYearCredit = Number(row.credit ?? 0)
    const movement = currentYearDebit - currentYearCredit
    const balance = openingBalance + movement
    const debit = balance > 0 ? balance : 0
    const credit = balance < 0 ? Math.abs(balance) : 0

    return {
      nominalCodeId: row.nominalCodeId,
      code: row.code,
      name: row.name,
      type: row.type,
      debit,
      credit,
      balance
    }
  })

  const totalDebit = trialBalanceRows.reduce((sum, row) => sum + row.debit, 0)
  const totalCredit = trialBalanceRows.reduce((sum, row) => sum + row.credit, 0)

  return {
    financialYear,
    rows: trialBalanceRows,
    totalDebit,
    totalCredit,
    difference: totalDebit - totalCredit
  }
}

function reportRow(row: TrialBalanceRow) {
  return h(
    View,
    { key: row.nominalCodeId, style: styles.row, wrap: false },
    h(Text, { style: [styles.cell, styles.codeCell] }, row.code),
    h(Text, { style: [styles.cell, styles.nameCell] }, row.name),
    h(Text, { style: [styles.cell, styles.typeCell] }, row.type),
    h(Text, { style: [styles.cell, styles.moneyCell] }, formatAmount(row.debit)),
    h(Text, { style: [styles.cell, styles.moneyCell] }, formatAmount(row.credit))
  )
}

function summaryCard(label: string, value: string) {
  return h(
    View,
    { style: styles.summaryCard },
    h(Text, { style: styles.summaryLabel }, label),
    h(Text, { style: styles.summaryValue }, value)
  )
}

function trialBalancePdf({
  parishCouncilName,
  report
}: {
  parishCouncilName: string | null
  report: TrialBalanceReport
}) {
  return h(
    Document,
    {
      title: `Trial Balance - ${report.financialYear.label}`,
      author: parishCouncilName ?? undefined
    },
    h(
      Page,
      { size: 'A4', orientation: 'landscape', style: styles.page },
      h(
        View,
        { style: styles.header },
        parishCouncilName
          ? h(Text, { style: styles.eyebrow }, parishCouncilName)
          : null,
        h(Text, { style: styles.title }, 'Trial Balance'),
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
        summaryCard('Total debits', formatCurrency(report.totalDebit)),
        summaryCard('Total credits', formatCurrency(report.totalCredit)),
        summaryCard('Difference', formatDifference(report.difference))
      ),
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: [styles.row, styles.headerRow], fixed: true },
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.codeCell] },
            'Code'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.nameCell] },
            'Name'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.typeCell] },
            'Type'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Debit'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Credit'
          )
        ),
        report.rows.map(reportRow),
        h(
          View,
          { style: [styles.row, styles.totalRow], wrap: false },
          h(Text, { style: [styles.cell, styles.totalLabelCell] }, 'Totals'),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatAmount(report.totalDebit)
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatAmount(report.totalCredit)
          )
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

  const report = await getTrialBalanceReport({
    parishCouncilId,
    financialYear
  })

  const pdf = await renderToBuffer(
    trialBalancePdf({
      parishCouncilName: parishCouncil?.name ?? null,
      report
    })
  )
  const pdfBody = new ArrayBuffer(pdf.byteLength)
  new Uint8Array(pdfBody).set(pdf)
  const filename = `trial-balance-${escapeFilename(financialYear.label)}.pdf`

  return new Response(pdfBody, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
