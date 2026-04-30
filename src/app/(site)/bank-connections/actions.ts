// src/app/bank-connections/actions.ts

'use server'

import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankConnections } from '@/db/schema/bankConnection'
import { syncConnection } from '@/lib/truelayer/sync'

export async function syncBankConnectionAction(connectionId: string) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    throw new Error('Unauthorised')
  }

  const parishCouncilId = session.user.parishCouncilId

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
    throw new Error('Bank connection not found.')
  }

  const result = await syncConnection({
    connection,
    parishCouncilId
  })

  revalidatePath('/bank-connections')
  revalidatePath('/reports/bank-reconciliation')
  revalidatePath('/transactions/inbox')

  return result
}
