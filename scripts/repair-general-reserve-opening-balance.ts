// scripts/repair-general-reserve-opening-balance.ts

import dotenv from 'dotenv'
import { and, eq } from 'drizzle-orm'

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

function getArg(name: string) {
  const prefix = `--${name}=`
  const match = process.argv.find(arg => arg.startsWith(prefix))

  return match?.slice(prefix.length)
}

async function run() {
  const yearId = getArg('financialYearId')
  const yearLabel = getArg('label')

  if (!yearId && !yearLabel) {
    throw new Error(
      'Provide --financialYearId=<id> or --label=<financial-year-label>.'
    )
  }

  const { db } = await import('@/db')
  const {
    financialYears,
    nominalCodes,
    nominalOpeningBalances
  } = await import('@/db/schema/nominalLedger')

  const [financialYear] = await db
    .select({
      id: financialYears.id,
      parishCouncilId: financialYears.parishCouncilId,
      label: financialYears.label
    })
    .from(financialYears)
    .where(
      yearId
        ? eq(financialYears.id, yearId)
        : eq(financialYears.label, String(yearLabel))
    )
    .limit(1)

  if (!financialYear) {
    throw new Error('Financial year not found.')
  }

  const codes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      type: nominalCodes.type
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, financialYear.parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id),
        eq(nominalCodes.type, 'BALANCE_SHEET'),
        eq(nominalCodes.isActive, true)
      )
    )

  const generalReserveCode = codes.find(code => code.code === '3000')

  if (!generalReserveCode) {
    throw new Error('No active 3000 General Reserve nominal code found.')
  }

  const openingRows = await db
    .select({
      nominalCodeId: nominalOpeningBalances.nominalCodeId,
      amount: nominalOpeningBalances.amount
    })
    .from(nominalOpeningBalances)
    .where(
      and(
        eq(
          nominalOpeningBalances.parishCouncilId,
          financialYear.parishCouncilId
        ),
        eq(nominalOpeningBalances.financialYearId, financialYear.id)
      )
    )

  const openingByCodeId = new Map(
    openingRows.map(row => [row.nominalCodeId, toNumber(row.amount)])
  )

  const nonReserveOpeningTotal = codes
    .filter(code => !isReserveCode(code.code))
    .reduce((total, code) => total + (openingByCodeId.get(code.id) ?? 0), 0)

  const otherReserveOpeningTotal = codes
    .filter(code => isReserveCode(code.code) && code.id !== generalReserveCode.id)
    .reduce((total, code) => total + (openingByCodeId.get(code.id) ?? 0), 0)

  const previousGeneralReserve =
    openingByCodeId.get(generalReserveCode.id) ?? null
  const repairedGeneralReserve = -(
    nonReserveOpeningTotal + otherReserveOpeningTotal
  )
  const previousOpeningTotal =
    nonReserveOpeningTotal +
    otherReserveOpeningTotal +
    (previousGeneralReserve ?? 0)
  const repairedOpeningTotal =
    nonReserveOpeningTotal + otherReserveOpeningTotal + repairedGeneralReserve

  console.log(
    `Repairing General Reserve opening balance for ${financialYear.label} (${financialYear.id})`
  )
  console.log(`  Non-reserve opening total: ${formatAmount(nonReserveOpeningTotal)}`)
  console.log(
    `  Other reserve opening total: ${formatAmount(otherReserveOpeningTotal)}`
  )
  console.log(
    `  General Reserve: ${formatAmount(previousGeneralReserve)} -> ${formatAmount(repairedGeneralReserve)}`
  )
  console.log(`  Opening total before: ${formatAmount(previousOpeningTotal)}`)
  console.log(`  Opening total after: ${formatAmount(repairedOpeningTotal)}`)

  if (
    previousGeneralReserve !== null &&
    Math.abs(previousGeneralReserve - repairedGeneralReserve) < 0.005
  ) {
    console.log('No change needed.')
    process.exit(0)
  }

  await db
    .insert(nominalOpeningBalances)
    .values({
      parishCouncilId: financialYear.parishCouncilId,
      financialYearId: financialYear.id,
      nominalCodeId: generalReserveCode.id,
      amount: repairedGeneralReserve.toFixed(2)
    })
    .onConflictDoUpdate({
      target: [
        nominalOpeningBalances.financialYearId,
        nominalOpeningBalances.nominalCodeId
      ],
      set: {
        amount: repairedGeneralReserve.toFixed(2)
      }
    })

  console.log('Done.')
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
