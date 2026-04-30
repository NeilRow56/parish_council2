// src/app/api/transactions/bulk-assign-nominal/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankTransactions } from '@/db/schema/bankTransactions'
import { nominalCodes } from '@/db/schema/nominalLedger'

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const parishCouncilId = session.user.parishCouncilId

  const body = (await request.json().catch(() => null)) as {
    transactionIds?: string[]
    nominalCodeId?: string
  } | null

  const transactionIds = body?.transactionIds ?? []
  const nominalCodeId = body?.nominalCodeId

  if (transactionIds.length === 0 || !nominalCodeId) {
    return NextResponse.json(
      { error: 'Transactions and nominal code are required' },
      { status: 400 }
    )
  }

  const [nominalCode] = await db
    .select({ id: nominalCodes.id })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.id, nominalCodeId),
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.isActive, true)
      )
    )
    .limit(1)

  if (!nominalCode) {
    return NextResponse.json(
      { error: 'Invalid nominal code selected' },
      { status: 400 }
    )
  }

  await db
    .update(bankTransactions)
    .set({
      nominalCodeId,
      status: 'CODED'
    })
    .where(
      and(
        eq(bankTransactions.parishCouncilId, parishCouncilId),
        inArray(bankTransactions.id, transactionIds),
        inArray(bankTransactions.status, ['PENDING', 'CODED'])
      )
    )

  return NextResponse.json({
    ok: true,
    updated: transactionIds.length
  })
}
