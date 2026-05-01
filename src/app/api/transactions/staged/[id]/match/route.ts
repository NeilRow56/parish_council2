import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq, gte, lte } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankConnections } from '@/db/schema/bankConnection'
import { bankTransactions } from '@/db/schema/bankTransactions'
import {
  financialYears,
  journalEntries,
  journalLines
} from '@/db/schema/nominalLedger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const parishCouncilId = session.user.parishCouncilId

  const body = (await request.json().catch(() => null)) as {
    journalEntryId?: string
  } | null

  if (!body?.journalEntryId) {
    return NextResponse.json(
      { error: 'Journal entry is required' },
      { status: 400 }
    )
  }

  const [transaction] = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.id, id),
        eq(bankTransactions.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!transaction) {
    return NextResponse.json(
      { error: 'Transaction not found' },
      { status: 404 }
    )
  }

  if (!['PENDING', 'CODED'].includes(transaction.status)) {
    return NextResponse.json(
      { error: 'Only pending or coded transactions can be matched' },
      { status: 400 }
    )
  }

  const [connection] = await db
    .select({
      nominalCodeId: bankConnections.nominalCodeId
    })
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.id, transaction.connectionId),
        eq(bankConnections.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!connection?.nominalCodeId) {
    return NextResponse.json(
      { error: 'Bank connection is not linked to a nominal code' },
      { status: 400 }
    )
  }

  const [financialYear] = await db
    .select({ id: financialYears.id })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        lte(financialYears.startDate, transaction.date),
        gte(financialYears.endDate, transaction.date)
      )
    )
    .limit(1)

  if (!financialYear) {
    return NextResponse.json(
      { error: 'No financial year found for transaction date' },
      { status: 400 }
    )
  }

  const amount = Math.abs(Number(transaction.amount)).toFixed(2)
  const isReceipt = transaction.transactionType === 'CREDIT'

  const [matchingBankLine] = await db
    .select({
      id: journalLines.id
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .where(
      and(
        eq(journalEntries.id, body.journalEntryId),
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, financialYear.id),
        eq(journalEntries.source, 'MANUAL'),
        eq(journalLines.nominalCodeId, connection.nominalCodeId),
        isReceipt
          ? eq(journalLines.debit, amount)
          : eq(journalLines.credit, amount)
      )
    )
    .limit(1)

  if (!matchingBankLine) {
    return NextResponse.json(
      { error: 'Selected journal does not match this bank transaction' },
      { status: 400 }
    )
  }

  await db
    .update(bankTransactions)
    .set({
      status: 'MATCHED',
      matchedJournalEntryId: body.journalEntryId,
      matchedAt: new Date()
    })
    .where(
      and(
        eq(bankTransactions.id, transaction.id),
        eq(bankTransactions.parishCouncilId, parishCouncilId)
      )
    )

  return NextResponse.json({ ok: true })
}
