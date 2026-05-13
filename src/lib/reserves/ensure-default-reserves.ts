// src/lib/reserves/ensure-default-reserve.ts
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { reserves } from '@/db/schema'

export async function ensureDefaultReserve(parishCouncilId: string) {
  const existingDefault = await db.query.reserves.findFirst({
    where: and(
      eq(reserves.parishCouncilId, parishCouncilId),
      eq(reserves.isDefault, true)
    )
  })

  if (existingDefault) {
    if (existingDefault.isActive) {
      return existingDefault
    }

    const [updated] = await db
      .update(reserves)
      .set({
        isActive: true,
        updatedAt: new Date()
      })
      .where(eq(reserves.id, existingDefault.id))
      .returning()

    return updated
  }

  const existingGeneral = await db.query.reserves.findFirst({
    where: and(
      eq(reserves.parishCouncilId, parishCouncilId),
      eq(reserves.code, 'GENERAL')
    )
  })

  if (existingGeneral) {
    const [updated] = await db
      .update(reserves)
      .set({
        isDefault: true,
        isActive: true,
        updatedAt: new Date()
      })
      .where(eq(reserves.id, existingGeneral.id))
      .returning()

    return updated
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
    .returning()

  return created
}
