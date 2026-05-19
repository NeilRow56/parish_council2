// src/app/(app)/settings/reserves/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { reserves } from '@/db/schema'
import { requireParishCouncil } from '@/lib/auth/require-parish-council'
import {
  createReserveSchema,
  updateReserveSchema
} from '@/lib/validation/reserves-projects-suppliers'

export type ReserveActionState = {
  error?: string
  success?: string
}

function clean(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

export async function createReserveAction(
  _prevState: ReserveActionState,
  formData: FormData
): Promise<ReserveActionState> {
  const { parishCouncilId } = await requireParishCouncil()

  const parsed = createReserveSchema.safeParse({
    code: formData.get('code'),
    name: formData.get('name')
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid reserve.'
    }
  }

  const data = parsed.data

  try {
    await db.insert(reserves).values({
      parishCouncilId,
      code: data.code,
      name: data.name,
      isDefault: false,
      isActive: true
    })
  } catch {
    return {
      error: 'A reserve with this code or name already exists.'
    }
  }

  revalidatePath('/settings/reserves')

  return {
    success: 'Reserve added.'
  }
}

export async function updateReserveAction(
  _prevState: ReserveActionState,
  formData: FormData
): Promise<ReserveActionState> {
  const { parishCouncilId } = await requireParishCouncil()

  const parsed = updateReserveSchema.safeParse({
    id: formData.get('id'),
    code: formData.get('code'),
    name: formData.get('name'),
    isActive: formData.get('isActive')
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid reserve.'
    }
  }

  const data = parsed.data

  try {
    await db
      .update(reserves)
      .set({
        code: data.code,
        name: data.name,
        isActive: data.isActive,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(reserves.id, data.id),
          eq(reserves.parishCouncilId, parishCouncilId)
        )
      )
  } catch {
    return {
      error:
        'Could not update reserve. A reserve with this code or name may already exist.'
    }
  }

  revalidatePath('/settings/reserves')

  return {
    success: 'Reserve saved.'
  }
}

export async function deleteReserveAction(formData: FormData) {
  const { parishCouncilId } = await requireParishCouncil()

  const id = clean(formData.get('id'))

  if (!id) {
    return
  }

  const existing = await db.query.reserves.findFirst({
    where: and(
      eq(reserves.id, id),
      eq(reserves.parishCouncilId, parishCouncilId)
    )
  })

  if (!existing) {
    return
  }

  if (existing.isDefault) {
    return
  }

  await db
    .delete(reserves)
    .where(
      and(eq(reserves.id, id), eq(reserves.parishCouncilId, parishCouncilId))
    )

  revalidatePath('/settings/reserves')
}
