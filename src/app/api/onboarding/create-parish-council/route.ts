import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createId } from '@paralleldrive/cuid2'
import { eq } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/db'
import { parishCouncils, user } from '@/db/schema/authSchema'
import { seedDefaultChart } from '@/lib/nominal-codes/seedDefaulChart'

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  if (session.user.parishCouncilId) {
    return NextResponse.json(
      { error: 'User is already linked to a parish council' },
      { status: 409 }
    )
  }

  const body = (await request.json()) as {
    councilName?: string
  }

  const councilName = body.councilName?.trim()

  if (!councilName) {
    return NextResponse.json(
      { error: 'Parish council name is required' },
      { status: 400 }
    )
  }

  const parishCouncilId = createId()

  await db.transaction(async trx => {
    await trx.insert(parishCouncils).values({
      id: parishCouncilId,
      name: councilName,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    await trx
      .update(user)
      .set({
        parishCouncilId,
        role: 'CLERK',
        updatedAt: new Date()
      })
      .where(eq(user.id, session.user.id))
  })

  await seedDefaultChart({ parishCouncilId })

  return NextResponse.json({
    ok: true,
    parishCouncilId
  })
}
