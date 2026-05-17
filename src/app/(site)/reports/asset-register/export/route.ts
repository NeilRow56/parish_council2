import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer
} from '@react-pdf/renderer'
import { and, asc, desc, eq, gte, isNull, lte, or } from 'drizzle-orm'
import { headers } from 'next/headers'
import { createElement } from 'react'

import { db } from '@/db'
import { fixedAssets, parishCouncils } from '@/db/schema'
import { financialYears } from '@/db/schema/nominalLedger'
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

type FixedAssetRow = {
  id: string
  refNo: string | null
  category: string
  insuranceCategory: string | null
  description: string
  location: string | null
  dateAcquired: string | null
  purchaseCost: string | null
  assetRegisterValue: string
  isDisposed: boolean
  disposalDate: string | null
}

type AssetRegisterReport = {
  councilName: string | null
  financialYear: FinancialYear
  assets: FixedAssetRow[]
  totalPurchaseCost: number
  totalAssetRegisterValue: number
}

function formatDate(value: string | Date | null) {
  if (!value) return 'Not known'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

function formatAmount(value: string | number | null) {
  const amount = Number(value ?? 0)

  if (amount === 0) return '-'

  return amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatCurrency(value: number) {
  if (value === 0) return '£-'

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)
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
    fontSize: 7.5
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
    minHeight: 24
  },
  headerRow: {
    backgroundColor: '#111827',
    color: '#ffffff'
  },
  totalRow: {
    backgroundColor: '#f8fafc'
  },
  cell: {
    paddingHorizontal: 4,
    paddingVertical: 5
  },
  headerCell: {
    fontSize: 7,
    fontWeight: 700
  },
  refCell: {
    width: 46
  },
  categoryCell: {
    width: 82
  },
  insuranceCell: {
    width: 78
  },
  descriptionCell: {
    flex: 1
  },
  locationCell: {
    width: 92
  },
  dateCell: {
    width: 62
  },
  moneyCell: {
    width: 68,
    textAlign: 'right'
  },
  statusCell: {
    width: 58
  },
  totalLabelCell: {
    flex: 1,
    fontWeight: 700
  },
  totalMoneyCell: {
    width: 68,
    fontWeight: 700,
    textAlign: 'right'
  },
  muted: {
    color: '#64748b',
    fontSize: 7
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

async function getAssetRegisterReport({
  parishCouncilId,
  financialYear
}: {
  parishCouncilId: string
  financialYear: FinancialYear
}): Promise<AssetRegisterReport> {
  const [council] = await db
    .select({ name: parishCouncils.name })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  const assets = await db
    .select({
      id: fixedAssets.id,
      refNo: fixedAssets.refNo,
      category: fixedAssets.category,
      insuranceCategory: fixedAssets.insuranceCategory,
      description: fixedAssets.description,
      location: fixedAssets.location,
      dateAcquired: fixedAssets.dateAcquired,
      purchaseCost: fixedAssets.purchaseCost,
      assetRegisterValue: fixedAssets.assetRegisterValue,
      isDisposed: fixedAssets.isDisposed,
      disposalDate: fixedAssets.disposalDate
    })
    .from(fixedAssets)
    .where(
      and(
        eq(fixedAssets.parishCouncilId, parishCouncilId),
        or(
          isNull(fixedAssets.dateAcquired),
          lte(fixedAssets.dateAcquired, financialYear.endDate)
        ),
        or(
          eq(fixedAssets.isDisposed, false),
          isNull(fixedAssets.disposalDate),
          gte(fixedAssets.disposalDate, financialYear.startDate)
        )
      )
    )
    .orderBy(
      asc(fixedAssets.category),
      asc(fixedAssets.insuranceCategory),
      asc(fixedAssets.refNo)
    )

  return {
    councilName: council?.name ?? null,
    financialYear,
    assets,
    totalPurchaseCost: assets.reduce(
      (sum, asset) => sum + Number(asset.purchaseCost ?? 0),
      0
    ),
    totalAssetRegisterValue: assets.reduce(
      (sum, asset) => sum + Number(asset.assetRegisterValue ?? 0),
      0
    )
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

function assetStatus(asset: FixedAssetRow) {
  if (!asset.isDisposed) return 'Active'

  return asset.disposalDate ? `Disposed ${formatDate(asset.disposalDate)}` : 'Disposed'
}

function assetRow(asset: FixedAssetRow) {
  return h(
    View,
    { key: asset.id, style: styles.row, wrap: false },
    h(Text, { style: [styles.cell, styles.refCell] }, asset.refNo || '-'),
    h(Text, { style: [styles.cell, styles.categoryCell] }, asset.category),
    h(
      Text,
      { style: [styles.cell, styles.insuranceCell] },
      asset.insuranceCategory || '-'
    ),
    h(
      View,
      { style: [styles.cell, styles.descriptionCell] },
      h(Text, null, asset.description)
    ),
    h(Text, { style: [styles.cell, styles.locationCell] }, asset.location || '-'),
    h(Text, { style: [styles.cell, styles.dateCell] }, formatDate(asset.dateAcquired)),
    h(Text, { style: [styles.cell, styles.moneyCell] }, formatAmount(asset.purchaseCost)),
    h(
      Text,
      { style: [styles.cell, styles.moneyCell] },
      formatAmount(asset.assetRegisterValue)
    ),
    h(Text, { style: [styles.cell, styles.statusCell] }, assetStatus(asset))
  )
}

function assetRegisterPdf(report: AssetRegisterReport) {
  return h(
    Document,
    {
      title: `Fixed Asset Register - ${report.financialYear.label}`,
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
        h(Text, { style: styles.title }, 'Fixed Asset Register'),
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
        summaryCard('Assets listed', String(report.assets.length)),
        summaryCard('Purchase cost total', formatCurrency(report.totalPurchaseCost)),
        summaryCard(
          'Asset register value',
          formatCurrency(report.totalAssetRegisterValue)
        )
      ),
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: [styles.row, styles.headerRow], fixed: true },
          h(Text, { style: [styles.cell, styles.headerCell, styles.refCell] }, 'Ref'),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.categoryCell] },
            'Category'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.insuranceCell] },
            'Insurance'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.descriptionCell] },
            'Description'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.locationCell] },
            'Location'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.dateCell] },
            'Acquired'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Cost'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Value'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.statusCell] },
            'Status'
          )
        ),
        report.assets.length > 0
          ? report.assets.map(assetRow)
          : h(
              View,
              { style: styles.row },
              h(
                Text,
                { style: [styles.cell, styles.totalLabelCell] },
                'No fixed assets found for this financial year.'
              )
            ),
        h(
          View,
          { style: [styles.row, styles.totalRow], wrap: false },
          h(Text, { style: [styles.cell, styles.refCell] }, ''),
          h(Text, { style: [styles.cell, styles.categoryCell] }, ''),
          h(Text, { style: [styles.cell, styles.insuranceCell] }, ''),
          h(Text, { style: [styles.cell, styles.descriptionCell, { fontWeight: 700 }] }, 'Totals'),
          h(Text, { style: [styles.cell, styles.locationCell] }, ''),
          h(Text, { style: [styles.cell, styles.dateCell] }, ''),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatAmount(report.totalPurchaseCost)
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatAmount(report.totalAssetRegisterValue)
          ),
          h(Text, { style: [styles.cell, styles.statusCell] }, '')
        )
      ),
      h(
        Text,
        { style: styles.note },
        'Assets are included if acquired on or before the financial year end date, and excluded only if disposed before the financial year start date.'
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

  const report = await getAssetRegisterReport({
    parishCouncilId,
    financialYear
  })

  const pdf = await renderToBuffer(assetRegisterPdf(report))
  const pdfBody = new ArrayBuffer(pdf.byteLength)
  new Uint8Array(pdfBody).set(pdf)
  const filename = `fixed-asset-register-${escapeFilename(financialYear.label)}.pdf`

  return new Response(pdfBody, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
