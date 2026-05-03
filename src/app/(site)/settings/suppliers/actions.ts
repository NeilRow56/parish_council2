// src/app/(app)/settings/suppliers/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { suppliers } from '@/db/schema'
import { requireParishCouncil } from '@/lib/auth/require-parish-council'
import {
  createSupplierSchema,
  updateSupplierSchema
} from '@/lib/validation/reserves-projects-suppliers'

export type SupplierActionState = {
  error?: string
  success?: string
}

function clean(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

export async function createSupplierAction(
  _prevState: SupplierActionState,
  formData: FormData
): Promise<SupplierActionState> {
  const { parishCouncilId } = await requireParishCouncil()

  const parsed = createSupplierSchema.safeParse({
    name: formData.get('name'),
    vatNumber: formData.get('vatNumber'),
    defaultGoodsSupplied: formData.get('defaultGoodsSupplied'),
    defaultNominalCodeId: formData.get('defaultNominalCodeId'),
    defaultReserveId: formData.get('defaultReserveId'),
    defaultProjectId: formData.get('defaultProjectId')
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid supplier.'
    }
  }

  const data = parsed.data

  try {
    await db.insert(suppliers).values({
      parishCouncilId,
      name: data.name,
      vatNumber: data.vatNumber,
      defaultGoodsSupplied: data.defaultGoodsSupplied,
      defaultNominalCodeId: data.defaultNominalCodeId,
      defaultReserveId: data.defaultReserveId,
      defaultProjectId: data.defaultProjectId,
      isActive: true
    })
  } catch {
    return {
      error: 'A supplier with this name already exists.'
    }
  }

  revalidatePath('/settings/suppliers')

  return {
    success: 'Supplier added.'
  }
}

export async function updateSupplierAction(
  _prevState: SupplierActionState,
  formData: FormData
): Promise<SupplierActionState> {
  const { parishCouncilId } = await requireParishCouncil()

  const parsed = updateSupplierSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    vatNumber: formData.get('vatNumber'),
    defaultGoodsSupplied: formData.get('defaultGoodsSupplied'),
    defaultNominalCodeId: formData.get('defaultNominalCodeId'),
    defaultReserveId: formData.get('defaultReserveId'),
    defaultProjectId: formData.get('defaultProjectId'),
    isActive: formData.get('isActive')
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid supplier.'
    }
  }

  const data = parsed.data

  try {
    await db
      .update(suppliers)
      .set({
        name: data.name,
        vatNumber: data.vatNumber,
        defaultGoodsSupplied: data.defaultGoodsSupplied,
        defaultNominalCodeId: data.defaultNominalCodeId,
        defaultReserveId: data.defaultReserveId,
        defaultProjectId: data.defaultProjectId,
        isActive: data.isActive,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(suppliers.id, data.id),
          eq(suppliers.parishCouncilId, parishCouncilId)
        )
      )
  } catch {
    return {
      error:
        'Could not update supplier. A supplier with this name may already exist.'
    }
  }

  revalidatePath('/settings/suppliers')

  return {
    success: 'Supplier saved.'
  }
}

export async function deleteSupplierAction(formData: FormData) {
  const { parishCouncilId } = await requireParishCouncil()

  const id = clean(formData.get('id'))

  if (!id) {
    throw new Error('Supplier id is required.')
  }

  await db
    .delete(suppliers)
    .where(
      and(eq(suppliers.id, id), eq(suppliers.parishCouncilId, parishCouncilId))
    )

  revalidatePath('/settings/suppliers')
}
