import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

import { bankConnections } from '@/db/schema'
import { db } from '@/db'
import { and, eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
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

  // ✅ THIS is where it goes
  const formData = await request.formData()
  const connectionId = formData.get('connectionId') as string | null

  // ------------------------------------------------------------------
  // If a specific connection is provided → sync ONE
  // ------------------------------------------------------------------
  if (connectionId) {
    const [connection] = await db
      .select()
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
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    return NextResponse.redirect(new URL('/bank-connections', request.url))
  }

  // ------------------------------------------------------------------
  // Otherwise → sync ALL (fallback behaviour)
  // ------------------------------------------------------------------

  return NextResponse.redirect(new URL('/bank-connections', request.url))
}
