'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankConnections } from '@/db/schema/bankConnection'
import { bankOpeningBalances } from '@/db/schema/bankOpeningBalances'
import { financialYears } from '@/db/schema/nominalLedger'

function parseMoney(value: string) {
  const cleaned = value.replace(/,/g, '').trim()
  const parsed = Number(cleaned)

  if (!Number.isFinite(parsed)) {
    throw new Error('Opening balance must be a valid number.')
  }

  return parsed.toFixed(2)
}

export async function saveBankOpeningBalanceAction(input: {
  financialYearId: string
  connectionId: string
  openingBalance: string
}) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    throw new Error('Unauthorised')
  }

  const parishCouncilId = session.user.parishCouncilId

  const [financialYear] = await db
    .select({ id: financialYears.id })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.id, input.financialYearId),
        eq(financialYears.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!financialYear) {
    throw new Error('Financial year not found.')
  }

  const [connection] = await db
    .select({
      id: bankConnections.id,
      nominalCodeId: bankConnections.nominalCodeId
    })
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.id, input.connectionId),
        eq(bankConnections.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!connection) {
    throw new Error('Bank connection not found.')
  }

  if (!connection.nominalCodeId) {
    throw new Error('Bank connection is not linked to a nominal code.')
  }

  const openingBalance = parseMoney(input.openingBalance)

  await db
    .insert(bankOpeningBalances)
    .values({
      parishCouncilId,
      financialYearId: input.financialYearId,
      connectionId: input.connectionId,
      nominalCodeId: connection.nominalCodeId,
      openingBalance,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [
        bankOpeningBalances.connectionId,
        bankOpeningBalances.financialYearId
      ],
      set: {
        nominalCodeId: connection.nominalCodeId,
        openingBalance,
        updatedAt: new Date()
      }
    })

  revalidatePath('/bank-connections/opening-balances')
  revalidatePath('/reports/bank-reconciliation')
}
