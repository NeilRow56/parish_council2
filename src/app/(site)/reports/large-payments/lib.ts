// src/app/(site)/reports/large-payments/lib.ts

import { and, asc, eq, gte, lte } from 'drizzle-orm'

import { db } from '@/db'
import {
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'

export type LargePaymentRow = {
  date: string
  reference: string
  nominalCode: string
  nominalName: string
  description: string
  net: number
  vat: number
  gross: number
}

type RawLedgerLine = {
  entryId: string
  date: string
  reference: string
  entryDescription: string | null
  lineId: string
  lineDescription: string | null
  nominalCodeId: string
  nominalCode: string
  nominalName: string
  isVatRecoverable: boolean
  isVatPayable: boolean
  debit: string
  credit: string
}

export function dateToInputDate(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10)
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export function getLargePaymentTotals(rows: LargePaymentRow[]) {
  return rows.reduce(
    (totals, row) => ({
      net: totals.net + row.net,
      vat: totals.vat + row.vat,
      gross: totals.gross + row.gross
    }),
    {
      net: 0,
      vat: 0,
      gross: 0
    }
  )
}

function buildLargePaymentsReport({
  rawRows,
  bankNominalCodeIds
}: {
  rawRows: RawLedgerLine[]
  bankNominalCodeIds: Set<string>
}) {
  const rowsByEntryId = new Map<string, RawLedgerLine[]>()

  for (const row of rawRows) {
    const existing = rowsByEntryId.get(row.entryId) ?? []
    existing.push(row)
    rowsByEntryId.set(row.entryId, existing)
  }

  const reportRows: LargePaymentRow[] = []

  for (const entryRows of rowsByEntryId.values()) {
    const bankPaymentLine = entryRows.find(
      row => bankNominalCodeIds.has(row.nominalCodeId) && Number(row.credit) > 0
    )

    if (!bankPaymentLine) {
      continue
    }

    const grossPayment = Number(bankPaymentLine.credit)

    if (grossPayment <= 100) {
      continue
    }

    const totalVat = entryRows
      .filter(row => row.isVatRecoverable && Number(row.debit) > 0)
      .reduce((sum, row) => sum + Number(row.debit), 0)

    const expenseRows = entryRows.filter(
      row =>
        !bankNominalCodeIds.has(row.nominalCodeId) &&
        !row.isVatRecoverable &&
        !row.isVatPayable &&
        Number(row.debit) > 0
    )

    const totalNet = expenseRows.reduce(
      (sum, row) => sum + Number(row.debit),
      0
    )

    for (const expenseRow of expenseRows) {
      const net = Number(expenseRow.debit)

      const vat =
        totalNet > 0 ? Math.round((totalVat * net * 100) / totalNet) / 100 : 0

      reportRows.push({
        date: expenseRow.date,
        reference: expenseRow.reference,
        nominalCode: expenseRow.nominalCode,
        nominalName: expenseRow.nominalName,
        description:
          expenseRow.lineDescription ??
          expenseRow.entryDescription ??
          expenseRow.reference,
        net,
        vat,
        gross: net + vat
      })
    }
  }

  return reportRows.sort((a, b) => {
    if (a.date === b.date) return a.reference.localeCompare(b.reference)
    return a.date < b.date ? -1 : 1
  })
}

export async function getCurrentFinancialYearForLargePaymentsReport({
  parishCouncilId,
  financialYearId
}: {
  parishCouncilId: string
  financialYearId?: string
}) {
  const { financialYear: currentYear } = await getSelectedFinancialYear(
    parishCouncilId,
    financialYearId
  )

  return currentYear ?? null
}

export async function getLargePaymentsReport({
  parishCouncilId,
  financialYearId,
  from,
  to
}: {
  parishCouncilId: string
  financialYearId: string
  from: string
  to: string
}) {
  const bankNominalCodes = await db
    .select({
      nominalCodeId: nominalCodes.id
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYearId),
        eq(nominalCodes.isBank, true)
      )
    )

  const bankNominalCodeIds = new Set(
    bankNominalCodes.map(row => row.nominalCodeId)
  )

  const rawRows = await db
    .select({
      entryId: journalEntries.id,
      date: journalEntries.date,
      reference: journalEntries.reference,
      entryDescription: journalEntries.description,

      lineId: journalLines.id,
      lineDescription: journalLines.description,
      nominalCodeId: nominalCodes.id,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name,
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
    .innerJoin(nominalCodes, eq(journalLines.nominalCodeId, nominalCodes.id))
    .where(
      and(
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, financialYearId),
        gte(journalEntries.date, from),
        lte(journalEntries.date, to)
      )
    )
    .orderBy(asc(journalEntries.date), asc(journalEntries.createdAt))

  return buildLargePaymentsReport({
    rawRows,
    bankNominalCodeIds
  })
}

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`
}

export function buildLargePaymentsCsv(rows: LargePaymentRow[]) {
  const totals = getLargePaymentTotals(rows)

  const header = [
    'Date',
    'Reference',
    'Nominal code',
    'Description',
    'Net',
    'VAT',
    'Gross'
  ]

  const body = rows.map(row => [
    formatDate(row.date),
    row.reference,
    `${row.nominalCode} - ${row.nominalName}`,
    row.description,
    row.net.toFixed(2),
    row.vat.toFixed(2),
    row.gross.toFixed(2)
  ])

  const footer = [
    '',
    '',
    '',
    'Totals',
    totals.net.toFixed(2),
    totals.vat.toFixed(2),
    totals.gross.toFixed(2)
  ]

  return [header, ...body, footer]
    .map(row => row.map(escapeCsv).join(','))
    .join('\n')
}
