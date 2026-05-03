// src/lib/reserves/ensure-default-reserve.ts
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { reserves } from '@/db/schema'

export async function ensureDefaultReserve(parishCouncilId: string) {
  const existing = await db.query.reserves.findFirst({
    where: and(
      eq(reserves.parishCouncilId, parishCouncilId),
      eq(reserves.isDefault, true)
    )
  })

  if (existing) {
    return existing
  }

  const [created] = await db
    .insert(reserves)
    .values({
      parishCouncilId,
      code: 'GENERAL',
      name: 'General reserve',
      isDefault: true,
      isActive: true
    })
    .onConflictDoNothing()
    .returning()

  if (created) {
    return created
  }

  const fallback = await db.query.reserves.findFirst({
    where: and(
      eq(reserves.parishCouncilId, parishCouncilId),
      eq(reserves.code, 'GENERAL')
    )
  })

  if (!fallback) {
    throw new Error('Could not create or find General reserve.')
  }

  return fallback
}
