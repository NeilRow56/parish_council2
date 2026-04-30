import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, between, desc, eq, ilike, inArray, sql } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/db'
import { bankTransactions } from '@/db/schema/bankTransactions'
import { bankConnections } from '@/db/schema/bankConnection'
import { nominalCodes } from '@/db/schema/nominalLedger'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const parishCouncilId = session.user.parishCouncilId

  if (!parishCouncilId) {
    return NextResponse.json(
      { error: 'User is not linked to a parish council' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)

  const status = searchParams.get('status')
  const connectionId = searchParams.get('connectionId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const search = searchParams.get('search')
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const pageSize = 50

  const conditions = [
    eq(bankTransactions.parishCouncilId, parishCouncilId),
    inArray(bankTransactions.status, ['PENDING', 'CODED'])
  ]

  if (status && status !== 'all' && ['PENDING', 'CODED'].includes(status)) {
    conditions.push(eq(bankTransactions.status, status as 'PENDING' | 'CODED'))
  }

  if (connectionId && connectionId !== 'all') {
    conditions.push(eq(bankTransactions.connectionId, connectionId))
  }

  if (from && to) {
    conditions.push(between(bankTransactions.date, from, to))
  }

  if (search) {
    conditions.push(ilike(bankTransactions.description, `%${search}%`))
  }

  const where = and(...conditions)

  const rows = await db
    .select({
      id: bankTransactions.id,
      connectionId: bankTransactions.connectionId,
      date: bankTransactions.date,
      description: bankTransactions.description,
      amount: bankTransactions.amount,
      currency: bankTransactions.currency,
      merchantName: bankTransactions.merchantName,
      category: bankTransactions.category,
      transactionType: bankTransactions.transactionType,
      status: bankTransactions.status,
      matchingRule: bankTransactions.matchingRule,
      notes: bankTransactions.notes,
      importedAt: bankTransactions.importedAt,

      accountName: bankConnections.accountName,

      nominalCodeId: bankTransactions.nominalCodeId,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name,
      nominalType: nominalCodes.type
    })
    .from(bankTransactions)
    .innerJoin(
      bankConnections,
      and(
        eq(bankTransactions.connectionId, bankConnections.id),
        eq(bankConnections.parishCouncilId, parishCouncilId)
      )
    )
    .leftJoin(
      nominalCodes,
      and(
        eq(bankTransactions.nominalCodeId, nominalCodes.id),
        eq(nominalCodes.parishCouncilId, parishCouncilId)
      )
    )
    .where(where)
    .orderBy(desc(bankTransactions.date), desc(bankTransactions.importedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bankTransactions)
    .innerJoin(
      bankConnections,
      and(
        eq(bankTransactions.connectionId, bankConnections.id),
        eq(bankConnections.parishCouncilId, parishCouncilId)
      )
    )
    .where(where)

  const summaryConditions = [
    eq(bankTransactions.parishCouncilId, parishCouncilId),
    inArray(bankTransactions.status, ['PENDING', 'CODED'])
  ]

  if (connectionId && connectionId !== 'all') {
    summaryConditions.push(eq(bankTransactions.connectionId, connectionId))
  }

  if (from && to) {
    summaryConditions.push(between(bankTransactions.date, from, to))
  }

  if (search) {
    summaryConditions.push(ilike(bankTransactions.description, `%${search}%`))
  }

  const summary = await db
    .select({
      status: bankTransactions.status,
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${bankTransactions.amount}), 0)::text`
    })
    .from(bankTransactions)
    .where(and(...summaryConditions))
    .groupBy(bankTransactions.status)

  return NextResponse.json({
    transactions: rows,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize)
    },
    summary
  })
}
