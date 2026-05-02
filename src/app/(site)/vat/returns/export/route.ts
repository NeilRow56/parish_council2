// app/(app)/vat/returns/export/route.ts
import { NextRequest } from 'next/server'
import { getVat126InvoiceLines } from '../actions'

function csvEscape(value: string | number) {
  const stringValue = String(value)
  return `"${stringValue.replaceAll('"', '""')}"`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const financialYearId = searchParams.get('financialYearId')
  const periodStart = searchParams.get('periodStart')
  const periodEnd = searchParams.get('periodEnd')

  if (!financialYearId || !periodStart || !periodEnd) {
    return new Response('Missing export parameters', { status: 400 })
  }

  const lines = await getVat126InvoiceLines({
    financialYearId,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd)
  })

  const headers = [
    'Invoice date',
    'Supplier VAT registration number',
    'Brief description of supply',
    'Addressed to',
    'VAT paid'
  ]

  const rows = lines.map(line => [
    line.invoiceDate,
    line.supplierVatNumber,
    line.description,
    line.addressedTo,
    line.vatPaid.toFixed(2)
  ])

  const csv = [headers, ...rows]
    .map(row => row.map(csvEscape).join(','))
    .join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vat126-reclaim.csv"`
    }
  })
}
