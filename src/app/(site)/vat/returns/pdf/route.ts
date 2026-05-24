import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer
} from '@react-pdf/renderer'
import { and, eq, gte, lte, ne, sql } from 'drizzle-orm'
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
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const h = createElement

type VatReturnFrequency = 'ANNUAL' | 'QUARTERLY' | 'MONTHLY'

type FinancialYear = {
  id: string
  label: string
  startDate: string
  endDate: string
  isClosed: boolean
}

type VatTotals = {
  inputVat: number
  outputVat: number
  netVat: number
  box6OutputsNet: number
  box7InputsNet: number
}

type VatBoxRow = {
  box: string
  description: string
  amount: number
  emphasis?: boolean
  brackets?: boolean
}

type VatReturnReport = {
  councilName: string | null
  financialYear: FinancialYear
  frequency: VatReturnFrequency
  periodStart: Date
  periodEnd: Date
  totals: VatTotals
  boxes: VatBoxRow[]
}

function toMoneyNumber(value: unknown) {
  return Number(value ?? 0)
}

function dateToInputDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)
}

function formatCurrencyWithBrackets(value: number) {
  const formatted = formatCurrency(Math.abs(value))

  return value < 0 ? `(${formatted})` : formatted
}

function getFrequencyLabel(frequency: VatReturnFrequency) {
  if (frequency === 'ANNUAL') return 'Annual'
  if (frequency === 'QUARTERLY') return 'Quarterly'
  return 'Monthly'
}

function parseDateParam(value: string | null) {
  if (!value) return null

  const date = new Date(value)

  return Number.isNaN(date.valueOf()) ? null : date
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
  meta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
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
    fontSize: 12,
    fontWeight: 700
  },
  sectionTitle: {
    marginBottom: 7,
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
    minHeight: 25
  },
  headerRow: {
    backgroundColor: '#111827',
    color: '#ffffff'
  },
  totalRow: {
    backgroundColor: '#f8fafc'
  },
  cell: {
    paddingHorizontal: 7,
    paddingVertical: 6
  },
  headerCell: {
    fontSize: 8,
    fontWeight: 700
  },
  boxCell: {
    width: 58
  },
  descriptionCell: {
    flex: 1
  },
  amountCell: {
    width: 130,
    textAlign: 'right'
  },
  amountText: {
    fontWeight: 700
  },
  note: {
    marginTop: 12,
    border: '1px solid #dbe3ee',
    borderRadius: 4,
    padding: 8,
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
  financialYearId,
  periodStart,
  periodEnd
}: {
  parishCouncilId: string
  financialYearId?: string
  periodStart?: Date
  periodEnd?: Date
}) {
  if (financialYearId) {
    const { financialYear } = await getSelectedFinancialYear(
      parishCouncilId,
      financialYearId
    )

    return financialYear ?? null
  }

  if (periodStart && periodEnd) {
    const [financialYear] = await db
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
          lte(financialYears.startDate, dateToInputDate(periodStart)),
          gte(financialYears.endDate, dateToInputDate(periodEnd))
        )
      )
      .limit(1)

    return financialYear ?? null
  }

  const { financialYear } = await getSelectedFinancialYear(parishCouncilId)

  return financialYear ?? null
}

async function getVatReturnReport({
  parishCouncilId,
  financialYear,
  periodStart,
  periodEnd
}: {
  parishCouncilId: string
  financialYear: FinancialYear
  periodStart: Date
  periodEnd: Date
}): Promise<VatReturnReport> {
  const [council] = await db
    .select({
      name: parishCouncils.name,
      vatReturnFrequency: parishCouncils.vatClaimFrequency
    })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  const periodStartString = dateToInputDate(periodStart)
  const periodEndString = dateToInputDate(periodEnd)

  const [row] = await db
    .select({
      inputVat: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.isVatRecoverable} = true
             and ${journalLines.debit} > 0
            then ${journalLines.debit}
            else 0
          end
        ), 0)
      `,
      outputVat: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.isVatPayable} = true
             and ${journalLines.credit} > 0
            then ${journalLines.credit}
            else 0
          end
        ), 0)
      `,
      box6OutputsNet: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.type} = 'INCOME'
             and ${journalLines.credit} > 0
            then ${journalLines.credit}
            else 0
          end
        ), 0)
      `,
      box7InputsNet: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.type} = 'EXPENDITURE'
             and ${journalLines.debit} > 0
            then ${journalLines.debit}
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
        ne(journalEntries.source, 'VAT_RETURN'),
        gte(journalEntries.date, periodStartString),
        lte(journalEntries.date, periodEndString)
      )
    )

  const inputVat = toMoneyNumber(row?.inputVat)
  const outputVat = toMoneyNumber(row?.outputVat)
  const totals = {
    inputVat,
    outputVat,
    netVat: outputVat - inputVat,
    box6OutputsNet: toMoneyNumber(row?.box6OutputsNet),
    box7InputsNet: toMoneyNumber(row?.box7InputsNet)
  }

  return {
    councilName: council?.name ?? null,
    financialYear,
    frequency: (council?.vatReturnFrequency ??
      'QUARTERLY') as VatReturnFrequency,
    periodStart,
    periodEnd,
    totals,
    boxes: [
      {
        box: 'Box 1',
        description: 'Output VAT',
        amount: totals.outputVat
      },
      {
        box: 'Box 2',
        description: 'EU & NI VAT',
        amount: 0
      },
      {
        box: 'Box 3',
        description: 'Total Output VAT',
        amount: totals.outputVat
      },
      {
        box: 'Box 4',
        description: 'Input VAT',
        amount: totals.inputVat
      },
      {
        box: 'Box 5',
        description: 'Net VAT payable / (repayable)',
        amount: totals.netVat,
        emphasis: true,
        brackets: true
      },
      {
        box: 'Box 6',
        description: 'Total value of sales and other outputs excluding VAT',
        amount: totals.box6OutputsNet
      },
      {
        box: 'Box 7',
        description: 'Total value of purchases and other inputs excluding VAT',
        amount: totals.box7InputsNet
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

function summaryCard(label: string, value: string) {
  return h(
    View,
    { style: styles.summaryCard },
    h(Text, { style: styles.summaryLabel }, label),
    h(Text, { style: styles.summaryValue }, value)
  )
}

function vatBoxRow(row: VatBoxRow) {
  const rowStyle = row.emphasis ? [styles.row, styles.totalRow] : styles.row
  const boxCellStyle = row.emphasis
    ? [styles.cell, styles.boxCell, styles.amountText]
    : [styles.cell, styles.boxCell]
  const descriptionCellStyle = row.emphasis
    ? [styles.cell, styles.descriptionCell, styles.amountText]
    : [styles.cell, styles.descriptionCell]
  const amountCellStyle = row.emphasis
    ? [styles.cell, styles.amountCell, styles.amountText]
    : [styles.cell, styles.amountCell]

  return h(
    View,
    {
      key: row.box,
      style: rowStyle,
      wrap: false
    },
    h(Text, { style: boxCellStyle }, row.box),
    h(Text, { style: descriptionCellStyle }, row.description),
    h(
      Text,
      { style: amountCellStyle },
      row.brackets
        ? formatCurrencyWithBrackets(row.amount)
        : formatCurrency(row.amount)
    )
  )
}

function vatReturnPdf(report: VatReturnReport) {
  return h(
    Document,
    {
      title: `VAT Return - ${report.financialYear.label}`,
      author: report.councilName ?? undefined
    },
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(
        View,
        { style: styles.header },
        report.councilName
          ? h(Text, { style: styles.eyebrow }, report.councilName)
          : null,
        h(Text, { style: styles.title }, 'VAT Return'),
        h(
          Text,
          { style: styles.subtitle },
          `Financial year ${report.financialYear.label}${
            report.financialYear.isClosed ? ' - Closed / read-only' : ''
          }`
        )
      ),
      h(
        View,
        { style: styles.meta },
        metaCard(
          'Return period',
          `${formatDate(report.periodStart)} to ${formatDate(report.periodEnd)}`
        ),
        metaCard('Return frequency', getFrequencyLabel(report.frequency)),
        metaCard(
          'Financial year dates',
          `${formatDate(report.financialYear.startDate)} to ${formatDate(
            report.financialYear.endDate
          )}`
        )
      ),
      h(
        View,
        { style: styles.summary },
        summaryCard('Output VAT', formatCurrency(report.totals.outputVat)),
        summaryCard('Input VAT', formatCurrency(report.totals.inputVat)),
        summaryCard(
          'VAT payable / repayable',
          formatCurrencyWithBrackets(report.totals.netVat)
        )
      ),
      h(Text, { style: styles.sectionTitle }, 'VAT return boxes'),
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: [styles.row, styles.headerRow], fixed: true },
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.boxCell] },
            'Box'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.descriptionCell] },
            'Description'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.amountCell] },
            'Amount'
          )
        ),
        report.boxes.map(vatBoxRow)
      ),
      h(
        Text,
        { style: styles.note },
        'Box values are calculated from posted journal lines in the selected financial year and return period. VAT return clearing journals are excluded.'
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
  const requestedPeriodStart = parseDateParam(searchParams.get('periodStart'))
  const requestedPeriodEnd = parseDateParam(searchParams.get('periodEnd'))

  const financialYear = await getFinancialYear({
    parishCouncilId,
    financialYearId: financialYearId ?? undefined,
    periodStart: requestedPeriodStart ?? undefined,
    periodEnd: requestedPeriodEnd ?? undefined
  })

  if (!financialYear) {
    return new Response('Financial year not found', { status: 404 })
  }

  const periodStart = requestedPeriodStart ?? new Date(financialYear.startDate)
  const periodEnd = requestedPeriodEnd ?? new Date(financialYear.endDate)

  const report = await getVatReturnReport({
    parishCouncilId,
    financialYear,
    periodStart,
    periodEnd
  })

  const pdf = await renderToBuffer(vatReturnPdf(report))
  const pdfBody = new ArrayBuffer(pdf.byteLength)
  new Uint8Array(pdfBody).set(pdf)
  const filename = `vat-return-${escapeFilename(financialYear.label)}-${dateToInputDate(periodEnd)}.pdf`

  return new Response(pdfBody, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
