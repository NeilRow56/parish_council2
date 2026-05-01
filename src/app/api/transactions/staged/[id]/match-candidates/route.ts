import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq, gte, lte, sql } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankConnections } from '@/db/schema/bankConnection'
import { bankTransactions } from '@/db/schema/bankTransactions'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'

export async function GET(
  _request: NextRequest,
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

  const [transaction] = await db
    .select({
      id: bankTransactions.id,
      connectionId: bankTransactions.connectionId,
      date: bankTransactions.date,
      amount: bankTransactions.amount,
      transactionType: bankTransactions.transactionType,
      description: bankTransactions.description,
      status: bankTransactions.status
    })
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
    return NextResponse.json({ candidates: [] })
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
    return NextResponse.json({ candidates: [] })
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
    return NextResponse.json({ candidates: [] })
  }

  const amount = Math.abs(Number(transaction.amount)).toFixed(2)
  const isReceipt = transaction.transactionType === 'CREDIT'

  const bankLineAmountCondition = isReceipt
    ? eq(journalLines.debit, amount)
    : eq(journalLines.credit, amount)

  const candidates = await db
    .select({
      journalEntryId: journalEntries.id,
      reference: journalEntries.reference,
      date: journalEntries.date,
      description: journalEntries.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name
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
        eq(journalEntries.financialYearId, financialYear.id),
        eq(journalEntries.source, 'MANUAL'),
        eq(journalLines.nominalCodeId, connection.nominalCodeId),
        bankLineAmountCondition
      )
    )
    .orderBy(sql`abs(${journalEntries.date}::date - ${transaction.date}::date)`)
    .limit(10)

  return NextResponse.json({ candidates })
}
