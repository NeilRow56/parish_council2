'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankConnections } from '@/db/schema/bankConnection'
import {
  financialYears,
  nominalCodes,
  nominalOpeningBalances
} from '@/db/schema/nominalLedger'
import { openingBalancesBalance } from '@/lib/opening-balances/validation'

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
    .select({
      id: financialYears.id,
      isClosed: financialYears.isClosed
    })
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

  if (financialYear.isClosed) {
    throw new Error('Opening balances cannot be changed for a closed year.')
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
  const proposedOpeningBalance = Number(openingBalance)

  const [codes, existingOpeningBalances] = await Promise.all([
    db
      .select({ id: nominalCodes.id })
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.parishCouncilId, parishCouncilId),
          eq(nominalCodes.financialYearId, input.financialYearId)
        )
      ),
    db
      .select({
        nominalCodeId: nominalOpeningBalances.nominalCodeId,
        amount: nominalOpeningBalances.amount
      })
      .from(nominalOpeningBalances)
      .where(
        and(
          eq(nominalOpeningBalances.parishCouncilId, parishCouncilId),
          eq(nominalOpeningBalances.financialYearId, input.financialYearId)
        )
      )
  ])

  const codeIds = new Set(codes.map(code => code.id))

  if (!codeIds.has(connection.nominalCodeId)) {
    throw new Error('Bank connection is not linked to this financial year.')
  }

  const proposedBalances = new Map(
    existingOpeningBalances
      .filter(row => codeIds.has(row.nominalCodeId))
      .map(row => [row.nominalCodeId, Number(row.amount)])
  )

  proposedBalances.set(connection.nominalCodeId, proposedOpeningBalance)

  if (!openingBalancesBalance(proposedBalances.values())) {
    throw new Error(
      'Opening balances would not balance. Update reserves, borrowings, or memo-reserve balances in Settings → Opening balances first.'
    )
  }

  await db
    .insert(nominalOpeningBalances)
    .values({
      parishCouncilId,
      financialYearId: input.financialYearId,
      nominalCodeId: connection.nominalCodeId,
      amount: openingBalance
    })
    .onConflictDoUpdate({
      target: [
        nominalOpeningBalances.financialYearId,
        nominalOpeningBalances.nominalCodeId
      ],
      set: {
        parishCouncilId,
        amount: openingBalance
      }
    })

  revalidatePath('/bank-connections/opening-balances')
  revalidatePath('/onboarding/opening-balances')
  revalidatePath('/reports/bank-reconciliation')
}
