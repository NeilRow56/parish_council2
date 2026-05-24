// src/app/api/transactions/post/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/db'
import { bankConnections } from '@/db/schema/bankConnection'
import { bankTransactions } from '@/db/schema/bankTransactions'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'
import { reserves } from '@/db/schema'

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const parishCouncilId = session.user.parishCouncilId
  const userId = session.user.id

  const body = (await request.json().catch(() => ({}))) as {
    transactionIds?: string[]
  }

  const selectedIds = body.transactionIds
  // TODO(financial-year-selector): reconcile this legacy posting endpoint with
  // transaction-date year selection before exposing explicit year switching.
  const today = new Date().toISOString().split('T')[0]

  const [financialYear] = await db
    .select()
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        lte(financialYears.startDate, today),
        gte(financialYears.endDate, today),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1)

  if (!financialYear) {
    return NextResponse.json(
      { error: 'No open financial year found' },
      { status: 400 }
    )
  }

  const codedTransactions = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.parishCouncilId, parishCouncilId),
        eq(bankTransactions.status, 'CODED'),
        isNull(bankTransactions.journalEntryId),
        selectedIds && selectedIds.length > 0
          ? inArray(bankTransactions.id, selectedIds)
          : undefined
      )
    )

  let posted = 0
  const journalEntryIds: string[] = []
  const errors: Array<{ transactionId: string; error: string }> = []

  for (const tx of codedTransactions) {
    const nominalCodeId = tx.nominalCodeId

    if (!nominalCodeId) {
      errors.push({
        transactionId: tx.id,
        error: 'Missing nominal code'
      })
      continue
    }

    try {
      let journalEntryId: string | null = null

      await db.transaction(async trx => {
        const [connection] = await trx
          .select({
            nominalCodeId: bankConnections.nominalCodeId
          })
          .from(bankConnections)
          .where(
            and(
              eq(bankConnections.id, tx.connectionId),
              eq(bankConnections.parishCouncilId, parishCouncilId)
            )
          )
          .limit(1)

        if (!connection?.nominalCodeId) {
          throw new Error(
            'Bank connection is not linked to a nominal bank code'
          )
        }

        const [defaultReserve] = await trx
          .select({ id: reserves.id })
          .from(reserves)
          .where(
            and(
              eq(reserves.parishCouncilId, parishCouncilId),
              eq(reserves.isDefault, true),
              eq(reserves.isActive, true)
            )
          )
          .limit(1)

        if (!defaultReserve) {
          throw new Error('No active default reserve has been configured.')
        }
        const [bankCode] = await trx
          .select({
            id: nominalCodes.id
          })
          .from(nominalCodes)
          .where(
            and(
              eq(nominalCodes.id, connection.nominalCodeId),
              eq(nominalCodes.parishCouncilId, parishCouncilId),
              eq(nominalCodes.financialYearId, financialYear.id),
              eq(nominalCodes.isBank, true),
              eq(nominalCodes.isActive, true)
            )
          )
          .limit(1)

        if (!bankCode) {
          throw new Error(
            'Linked bank nominal code is inactive, missing, or not valid for this financial year'
          )
        }
        const [analysisCode] = await trx
          .select({ code: nominalCodes.code })
          .from(nominalCodes)
          .where(
            and(
              eq(nominalCodes.id, nominalCodeId),
              eq(nominalCodes.parishCouncilId, parishCouncilId),
              eq(nominalCodes.financialYearId, financialYear.id),
              eq(nominalCodes.isActive, true)
            )
          )
          .limit(1)

        if (!analysisCode) {
          throw new Error('Selected nominal code is inactive or missing.')
        }

        // ✅ SAFEGUARD — add this
        if (!tx.transactionType) {
          throw new Error(`Transaction ${tx.id} missing transaction type`)
        }
        const amount = Number(tx.amount)

        if (!Number.isFinite(amount) || amount === 0) {
          throw new Error('Invalid transaction amount')
        }

        const absoluteAmount = amount.toFixed(2)
        const isReceipt = tx.transactionType === 'CREDIT'
        const reference = `BNK-${tx.date}-${tx.id.slice(-6).toUpperCase()}`

        const [entry] = await trx
          .insert(journalEntries)
          .values({
            parishCouncilId,
            financialYearId: financialYear.id,
            reference,
            date: tx.date,
            description: tx.description,
            source: 'BANK_FEED',
            sourceId: tx.id,
            excludeFromAgar: analysisCode.code === '2100',
            postedById: userId
          })
          .returning()
        journalEntryId = entry.id

        if (isReceipt) {
          // Receipt: Dr Bank, Cr nominal
          await trx.insert(journalLines).values([
            {
              parishCouncilId,
              journalEntryId: entry.id,
              nominalCodeId: bankCode.id,
              reserveId: defaultReserve.id,
              debit: absoluteAmount,
              credit: '0.00',
              description: tx.description
            },
            {
              parishCouncilId,
              journalEntryId: entry.id,
              nominalCodeId,
              reserveId: defaultReserve.id,
              debit: '0.00',
              credit: absoluteAmount,
              description: tx.description
            }
          ])
        } else {
          // Payment: Dr nominal, Cr Bank
          await trx.insert(journalLines).values([
            {
              parishCouncilId,
              journalEntryId: entry.id,
              nominalCodeId,
              debit: absoluteAmount,
              reserveId: defaultReserve.id,
              credit: '0.00',
              description: tx.description
            },
            {
              parishCouncilId,
              journalEntryId: entry.id,
              nominalCodeId: bankCode.id,
              reserveId: defaultReserve.id,
              debit: '0.00',
              credit: absoluteAmount,
              description: tx.description
            }
          ])
        }

        await trx
          .update(bankTransactions)
          .set({
            status: 'POSTED',
            journalEntryId: entry.id,
            postedAt: new Date()
          })
          .where(
            and(
              eq(bankTransactions.id, tx.id),
              eq(bankTransactions.parishCouncilId, parishCouncilId)
            )
          )
      })

      posted++
      if (journalEntryId) {
        journalEntryIds.push(journalEntryId)
      }
    } catch (err) {
      errors.push({
        transactionId: tx.id,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }

  return NextResponse.json({
    posted,
    journalEntryIds,
    errors
  })
}
