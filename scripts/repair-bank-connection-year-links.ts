// scripts/repair-bank-connection-year-links.ts

import dotenv from 'dotenv'
import { and, desc, eq } from 'drizzle-orm'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing after loading .env.local')
}

async function run() {
  const { db } = await import('@/db')
  const { parishCouncils } = await import('@/db/schema/authSchema')
  const { bankConnections } = await import('@/db/schema/bankConnection')
  const { bankOpeningBalances } = await import('@/db/schema/bankOpeningBalances')
  const { financialYears, nominalCodes } = await import(
    '@/db/schema/nominalLedger'
  )

  const councils = await db.select({ id: parishCouncils.id }).from(parishCouncils)

  let repairedConnections = 0
  let repairedOpeningBalances = 0

  for (const council of councils) {
    const [currentYear] = await db
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

    if (!currentYear) {
      continue
    }

    const currentBankCodes = await db
      .select({
        id: nominalCodes.id,
        code: nominalCodes.code
      })
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.parishCouncilId, council.id),
          eq(nominalCodes.financialYearId, currentYear.id),
          eq(nominalCodes.isBank, true),
          eq(nominalCodes.isActive, true)
        )
      )

    const currentBankCodeIdByCode = new Map(
      currentBankCodes.map(code => [code.code, code.id])
    )

    const connections = await db
      .select({
        id: bankConnections.id,
        nominalCodeId: bankConnections.nominalCodeId,
        nominalCode: nominalCodes.code,
        nominalFinancialYearId: nominalCodes.financialYearId
      })
      .from(bankConnections)
      .leftJoin(nominalCodes, eq(bankConnections.nominalCodeId, nominalCodes.id))
      .where(eq(bankConnections.parishCouncilId, council.id))

    for (const connection of connections) {
      if (!connection.nominalCode) {
        continue
      }

      const currentNominalCodeId = currentBankCodeIdByCode.get(
        connection.nominalCode
      )

      if (!currentNominalCodeId) {
        continue
      }

      if (connection.nominalCodeId !== currentNominalCodeId) {
        await db
          .update(bankConnections)
          .set({
            nominalCodeId: currentNominalCodeId,
            updatedAt: new Date()
          })
          .where(eq(bankConnections.id, connection.id))

        repairedConnections += 1
      }

      const result = await db
        .update(bankOpeningBalances)
        .set({
          nominalCodeId: currentNominalCodeId,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(bankOpeningBalances.parishCouncilId, council.id),
            eq(bankOpeningBalances.financialYearId, currentYear.id),
            eq(bankOpeningBalances.connectionId, connection.id)
          )
        )

      repairedOpeningBalances += result.rowCount ?? 0
    }
  }

  console.log(
    `Done. Repaired ${repairedConnections} bank connection links and ${repairedOpeningBalances} bank opening balance links.`
  )
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
