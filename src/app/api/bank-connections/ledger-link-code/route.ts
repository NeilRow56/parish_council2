// src/app/api/bank-connections/link-ledger-code/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankConnections } from '@/db/schema/bankConnection'
import { nominalCodes } from '@/db/schema/nominalLedger'
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const parishCouncilId = session.user.parishCouncilId
  const formData = await request.formData()

  const connectionId = String(formData.get('connectionId') ?? '')
  const nominalCodeId = String(formData.get('nominalCodeId') ?? '')

  if (!connectionId || !nominalCodeId) {
    return NextResponse.json(
      { error: 'Connection and nominal code are required' },
      { status: 400 }
    )
  }

  const { financialYear: currentYear } =
    await getSelectedFinancialYear(parishCouncilId)

  if (!currentYear) {
    return NextResponse.json(
      { error: 'No financial year found' },
      { status: 400 }
    )
  }

  if (currentYear.isClosed) {
    return NextResponse.json(
      { error: 'Bank ledger links cannot be changed for a closed year' },
      { status: 400 }
    )
  }

  const [connection] = await db
    .select({ id: bankConnections.id })
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.id, connectionId),
        eq(bankConnections.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!connection) {
    return NextResponse.json(
      { error: 'Bank connection not found' },
      { status: 404 }
    )
  }

  const [nominalCode] = await db
    .select({ id: nominalCodes.id })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.id, nominalCodeId),
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, currentYear.id),
        eq(nominalCodes.isBank, true),
        eq(nominalCodes.isActive, true)
      )
    )
    .limit(1)

  if (!nominalCode) {
    return NextResponse.json(
      { error: 'Invalid bank nominal code' },
      { status: 400 }
    )
  }

  await db
    .update(bankConnections)
    .set({
      nominalCodeId,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(bankConnections.id, connectionId),
        eq(bankConnections.parishCouncilId, parishCouncilId)
      )
    )

  return NextResponse.redirect(new URL('/bank-connections', request.url))
}
