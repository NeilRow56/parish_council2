// scripts/repair-year-end-opening-balances.ts

import dotenv from 'dotenv'
import { and, desc, eq, sql } from 'drizzle-orm'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing after loading .env.local')
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function isReserveCode(code: string) {
  const numericCode = Number.parseInt(code, 10)

  return (
    Number.isFinite(numericCode) && numericCode >= 3000 && numericCode < 4000
  )
}

function formatAmount(value: number | null) {
  if (value === null) return 'none'

  return value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

async function run() {
  const { db } = await import('@/db')
  const { parishCouncils } = await import('@/db/schema/authSchema')
  const {
    financialYears,
    journalEntries,
    journalLines,
    nominalCodes,
    nominalOpeningBalances,
    yearEndRuns
  } = await import('@/db/schema/nominalLedger')

  const councils = await db.select({ id: parishCouncils.id }).from(parishCouncils)

  let repairedRows = 0
  let skippedCouncils = 0

  for (const council of councils) {
    const [targetYear] = await db
      .select({
        id: financialYears.id,
        label: financialYears.label
      })
      .from(financialYears)
      .where(
        and(
          eq(financialYears.parishCouncilId, council.id),
          eq(financialYears.isClosed, false)
        )
      )
      .orderBy(desc(financialYears.startDate))
      .limit(1)

    if (!targetYear) {
      console.log(`Council ${council.id}: skipped, no open financial year.`)
      skippedCouncils += 1
      continue
    }

    const [yearEndRun] = await db
      .select({
        fromFinancialYearId: yearEndRuns.fromFinancialYearId
      })
      .from(yearEndRuns)
      .where(
        and(
          eq(yearEndRuns.parishCouncilId, council.id),
          eq(yearEndRuns.toFinancialYearId, targetYear.id),
          eq(yearEndRuns.status, 'COMPLETED')
        )
      )
      .limit(1)

    if (!yearEndRun) {
      console.log(
        `Council ${council.id}: skipped ${targetYear.label}, no completed year-end run into latest open year.`
      )
      skippedCouncils += 1
      continue
    }

    const [sourceYear] = await db
      .select({
        id: financialYears.id,
        label: financialYears.label
      })
      .from(financialYears)
      .where(
        and(
          eq(financialYears.id, yearEndRun.fromFinancialYearId),
          eq(financialYears.parishCouncilId, council.id)
        )
      )
      .limit(1)

    if (!sourceYear) {
      console.log(
        `Council ${council.id}: skipped ${targetYear.label}, source financial year not found.`
      )
      skippedCouncils += 1
      continue
    }

    const sourceCodes = await db
      .select({
        id: nominalCodes.id,
        code: nominalCodes.code,
        name: nominalCodes.name,
        type: nominalCodes.type
      })
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.parishCouncilId, council.id),
          eq(nominalCodes.financialYearId, sourceYear.id),
          eq(nominalCodes.isActive, true)
        )
      )
      .orderBy(nominalCodes.code)

    const targetCodes = await db
      .select({
        id: nominalCodes.id,
        code: nominalCodes.code
      })
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.parishCouncilId, council.id),
          eq(nominalCodes.financialYearId, targetYear.id),
          eq(nominalCodes.isActive, true)
        )
      )

    const targetCodeByCode = new Map(
      targetCodes.map(code => [code.code, code.id])
    )

    const sourceOpeningRows = await db
      .select({
        nominalCodeId: nominalOpeningBalances.nominalCodeId,
        amount: nominalOpeningBalances.amount
      })
      .from(nominalOpeningBalances)
      .where(
        and(
          eq(nominalOpeningBalances.parishCouncilId, council.id),
          eq(nominalOpeningBalances.financialYearId, sourceYear.id)
        )
      )

    const sourceMovementRows = await db
      .select({
        nominalCodeId: journalLines.nominalCodeId,
        debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`
      })
      .from(journalLines)
      .innerJoin(
        journalEntries,
        eq(journalLines.journalEntryId, journalEntries.id)
      )
      .where(
        and(
          eq(journalLines.parishCouncilId, council.id),
          eq(journalEntries.financialYearId, sourceYear.id)
        )
      )
      .groupBy(journalLines.nominalCodeId)

    const targetOpeningRows = await db
      .select({
        nominalCodeId: nominalOpeningBalances.nominalCodeId,
        amount: nominalOpeningBalances.amount
      })
      .from(nominalOpeningBalances)
      .where(
        and(
          eq(nominalOpeningBalances.parishCouncilId, council.id),
          eq(nominalOpeningBalances.financialYearId, targetYear.id)
        )
      )

    const sourceOpeningByCodeId = new Map(
      sourceOpeningRows.map(row => [row.nominalCodeId, toNumber(row.amount)])
    )

    const sourceMovementByCodeId = new Map(
      sourceMovementRows.map(row => {
        const debit = toNumber(row.debit)
        const credit = toNumber(row.credit)

        return [row.nominalCodeId, debit - credit]
      })
    )

    const targetOpeningByCodeId = new Map(
      targetOpeningRows.map(row => [row.nominalCodeId, toNumber(row.amount)])
    )

    const balanceSheetCodes = sourceCodes.filter(
      code => code.type === 'BALANCE_SHEET'
    )
    const reserveCodes = balanceSheetCodes.filter(code =>
      isReserveCode(code.code)
    )
    const generalReserveCode =
      reserveCodes.find(code => code.code === '3000') ?? reserveCodes[0]

    if (!generalReserveCode) {
      console.log(
        `Council ${council.id}: skipped ${targetYear.label}, no reserve code found.`
      )
      skippedCouncils += 1
      continue
    }

    const normalOpeningBalanceByCodeId = new Map(
      balanceSheetCodes.map(code => {
        const openingBalance = sourceOpeningByCodeId.get(code.id) ?? 0
        const movement = sourceMovementByCodeId.get(code.id) ?? 0

        return [code.id, openingBalance + movement]
      })
    )

    const nonReserveOpeningTotal = balanceSheetCodes
      .filter(code => !isReserveCode(code.code))
      .reduce(
        (total, code) => total + (normalOpeningBalanceByCodeId.get(code.id) ?? 0),
        0
      )

    const otherReserveOpeningTotal = reserveCodes
      .filter(code => code.id !== generalReserveCode.id)
      .reduce(
        (total, code) => total + (normalOpeningBalanceByCodeId.get(code.id) ?? 0),
        0
      )

    const generalReserveOpening = -(
      nonReserveOpeningTotal + otherReserveOpeningTotal
    )

    console.log(
      `Council ${council.id}: repairing ${sourceYear.label} -> ${targetYear.label}`
    )
    console.log(
      `  nonReserveOpeningTotal=${formatAmount(nonReserveOpeningTotal)}, otherReserveOpeningTotal=${formatAmount(otherReserveOpeningTotal)}, derivedGeneralReserve=${formatAmount(generalReserveOpening)}`
    )

    for (const sourceCode of balanceSheetCodes) {
      const targetNominalCodeId = targetCodeByCode.get(sourceCode.code)

      if (!targetNominalCodeId) {
        console.log(
          `  ${sourceCode.code} ${sourceCode.name}: skipped, no matching target nominal code.`
        )
        continue
      }

      const normalOpeningBalance =
        normalOpeningBalanceByCodeId.get(sourceCode.id) ?? 0
      const repairedAmount =
        sourceCode.id === generalReserveCode.id
          ? generalReserveOpening
          : normalOpeningBalance
      const existingAmount = targetOpeningByCodeId.get(targetNominalCodeId)
      const existingForLog = existingAmount ?? null

      console.log(
        `  ${sourceCode.code} ${sourceCode.name}: ${formatAmount(existingForLog)} -> ${formatAmount(repairedAmount)}`
      )

      if (
        existingAmount !== undefined &&
        Math.abs(existingAmount - repairedAmount) < 0.005
      ) {
        continue
      }

      await db
        .insert(nominalOpeningBalances)
        .values({
          parishCouncilId: council.id,
          financialYearId: targetYear.id,
          nominalCodeId: targetNominalCodeId,
          amount: repairedAmount.toFixed(2)
        })
        .onConflictDoUpdate({
          target: [
            nominalOpeningBalances.financialYearId,
            nominalOpeningBalances.nominalCodeId
          ],
          set: {
            amount: repairedAmount.toFixed(2)
          }
        })

      repairedRows += 1
    }
  }

  console.log(
    `Done. Repaired ${repairedRows} opening balance rows. Skipped ${skippedCouncils} councils.`
  )
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
