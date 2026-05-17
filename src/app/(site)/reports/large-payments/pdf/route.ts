import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer
} from '@react-pdf/renderer'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { createElement } from 'react'

import { db } from '@/db'
import { parishCouncils } from '@/db/schema'
import { auth } from '@/lib/auth'
import {
  dateToInputDate,
  formatDate,
  formatMoney,
  getCurrentFinancialYearForLargePaymentsReport,
  getLargePaymentTotals,
  getLargePaymentsReport
} from '../lib'
import type { LargePaymentRow } from '../lib'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const h = createElement

type FinancialYear = {
  id: string
  label: string
  startDate: string | Date
  endDate: string | Date
  isClosed: boolean
}

type LargePaymentsReport = {
  councilName: string | null
  financialYear: FinancialYear
  from: string
  to: string
  rows: LargePaymentRow[]
  totals: {
    net: number
    vat: number
    gross: number
  }
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
  table: {
    border: '1px solid #dbe3ee',
    borderBottom: 0
  },
  row: {
    flexDirection: 'row',
    borderBottom: '1px solid #dbe3ee',
    minHeight: 23
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
  dateCell: {
    width: 66
  },
  nominalCell: {
    width: 142
  },
  descriptionCell: {
    flex: 1
  },
  moneyCell: {
    width: 72,
    textAlign: 'right'
  },
  totalLabelCell: {
    flex: 1,
    fontWeight: 700
  },
  totalMoneyCell: {
    width: 72,
    fontWeight: 700,
    textAlign: 'right'
  },
  note: {
    marginTop: 10,
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

function summaryCard(label: string, value: string) {
  return h(
    View,
    { style: styles.summaryCard },
    h(Text, { style: styles.summaryLabel }, label),
    h(Text, { style: styles.summaryValue }, value)
  )
}

function paymentRow(row: LargePaymentRow) {
  return h(
    View,
    {
      key: `${row.reference}-${row.nominalCode}-${row.description}`,
      style: styles.row,
      wrap: false
    },
    h(Text, { style: [styles.cell, styles.dateCell] }, formatDate(row.date)),
    h(
      Text,
      { style: [styles.cell, styles.nominalCell] },
      `${row.nominalCode} - ${row.nominalName}`
    ),
    h(Text, { style: [styles.cell, styles.descriptionCell] }, row.description),
    h(Text, { style: [styles.cell, styles.moneyCell] }, formatMoney(row.net)),
    h(Text, { style: [styles.cell, styles.moneyCell] }, formatMoney(row.vat)),
    h(Text, { style: [styles.cell, styles.moneyCell] }, formatMoney(row.gross))
  )
}

function largePaymentsPdf(report: LargePaymentsReport) {
  return h(
    Document,
    {
      title: `Payments over £100 - ${report.financialYear.label}`,
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
        h(Text, { style: styles.title }, 'Payments over £100'),
        h(
          Text,
          { style: styles.subtitle },
          `Financial year ${report.financialYear.label} - ${formatDate(
            dateToInputDate(report.financialYear.startDate)
          )} to ${formatDate(dateToInputDate(report.financialYear.endDate))}${
            report.financialYear.isClosed ? ' - Closed / read-only' : ''
          }`
        ),
        h(
          Text,
          { style: styles.subtitle },
          `Report period ${formatDate(report.from)} to ${formatDate(report.to)}`
        )
      ),
      h(
        View,
        { style: styles.summary },
        summaryCard('Payments shown', String(report.rows.length)),
        summaryCard('Net total', formatMoney(report.totals.net)),
        summaryCard('VAT total', formatMoney(report.totals.vat)),
        summaryCard('Gross total', formatMoney(report.totals.gross))
      ),
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: [styles.row, styles.headerRow], fixed: true },
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.dateCell] },
            'Date'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.nominalCell] },
            'Nominal code'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.descriptionCell] },
            'Description'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Net'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'VAT'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Gross'
          )
        ),
        report.rows.length > 0
          ? report.rows.map(paymentRow)
          : h(
              View,
              { style: styles.row },
              h(
                Text,
                { style: [styles.cell, styles.totalLabelCell] },
                'No payments over £100 were found for this period.'
              )
            ),
        h(
          View,
          { style: [styles.row, styles.totalRow], wrap: false },
          h(Text, { style: [styles.cell, styles.dateCell] }, ''),
          h(Text, { style: [styles.cell, styles.nominalCell] }, ''),
          h(
            Text,
            { style: [styles.cell, styles.descriptionCell, { fontWeight: 700 }] },
            'Totals'
          ),
          h(Text, { style: [styles.cell, styles.totalMoneyCell] }, formatMoney(report.totals.net)),
          h(Text, { style: [styles.cell, styles.totalMoneyCell] }, formatMoney(report.totals.vat)),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatMoney(report.totals.gross)
          )
        )
      ),
      h(
        Text,
        { style: styles.note },
        'This report lists payment entries where the bank payment is over £100, split across the relevant expenditure nominal lines.'
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

  const financialYear = await getCurrentFinancialYearForLargePaymentsReport({
    parishCouncilId,
    financialYearId: financialYearId ?? undefined
  })

  if (!financialYear) {
    return new Response('No financial year found', { status: 400 })
  }

  const from = searchParams.get('from') ?? dateToInputDate(financialYear.startDate)
  const to = searchParams.get('to') ?? dateToInputDate(financialYear.endDate)

  const [council] = await db
    .select({ name: parishCouncils.name })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  const rows = await getLargePaymentsReport({
    parishCouncilId,
    financialYearId: financialYear.id,
    from,
    to
  })

  const report = {
    councilName: council?.name ?? null,
    financialYear,
    from,
    to,
    rows,
    totals: getLargePaymentTotals(rows)
  }

  const pdf = await renderToBuffer(largePaymentsPdf(report))
  const pdfBody = new ArrayBuffer(pdf.byteLength)
  new Uint8Array(pdfBody).set(pdf)
  const filename = `payments-over-100-${escapeFilename(financialYear.label)}-${from}-to-${to}.pdf`

  return new Response(pdfBody, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
