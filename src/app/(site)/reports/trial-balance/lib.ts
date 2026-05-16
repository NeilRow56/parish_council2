import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
  nominalOpeningBalances
} from '@/db/schema'

export type TrialBalanceFinancialYear = {
  id: string
  label: string
  startDate: string
  endDate: string
}

export type TrialBalanceRow = {
  nominalCodeId: string
  code: string
  name: string
  type: 'INCOME' | 'EXPENDITURE' | 'BALANCE_SHEET'
  debit: number
  credit: number
  balance: number
}

export type TrialBalanceReport = {
  financialYear: TrialBalanceFinancialYear
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  difference: number
}

export async function getTrialBalanceFinancialYear({
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

export async function getTrialBalanceReport({
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

export function formatAmount(value: number) {
  return value === 0
    ? '—'
    : value.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
}

export function formatCurrency(value: number) {
  return value === 0 ? '£—' : `£${formatAmount(value)}`
}
