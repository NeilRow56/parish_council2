// src/app/(app)/settings/vat-rates/actions.ts

'use server'

import { revalidatePath } from 'next/cache'
import { and, count, eq, ne } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { vatRates } from '@/db/schema'
import { requireParishCouncil } from '@/lib/auth/require-parish-council'

export type VatRateActionState = {
  error?: string
  success?: string
}

const checkboxBoolean = z
  .union([z.literal('on'), z.literal('true'), z.literal(true)])
  .optional()
  .transform(value => Boolean(value))

const updateVatRateSchema = z.object({
  id: z.string().trim().min(1, 'VAT rate id is required.'),

  name: z
    .string()
    .trim()
    .min(1, 'VAT rate name is required.')
    .max(120, 'VAT rate name must be 120 characters or fewer.'),

  ratePercent: z
    .string()
    .trim()
    .min(1, 'VAT rate percentage is required.')
    .refine(value => Number.isFinite(Number(value)), {
      message: 'VAT rate percentage must be a valid number.'
    })
    .refine(value => Number(value) >= 0 && Number(value) <= 100, {
      message: 'VAT rate percentage must be between 0 and 100.'
    })
    .transform(value => Number(value).toFixed(2)),

  sortOrder: z
    .string()
    .trim()
    .optional()
    .transform(value => {
      const parsed = Number(value || 0)
      return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
    }),

  isActive: checkboxBoolean
})

function clean(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

export async function updateVatRateAction(
  _prevState: VatRateActionState,
  formData: FormData
): Promise<VatRateActionState> {
  const { parishCouncilId } = await requireParishCouncil()

  const parsed = updateVatRateSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    ratePercent: formData.get('ratePercent'),
    sortOrder: formData.get('sortOrder'),
    isActive: formData.get('isActive')
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid VAT rate.'
    }
  }

  const data = parsed.data

  const [existingRate] = await db
    .select({
      id: vatRates.id,
      code: vatRates.code,
      isActive: vatRates.isActive
    })
    .from(vatRates)
    .where(
      and(
        eq(vatRates.id, data.id),
        eq(vatRates.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!existingRate) {
    return {
      error: 'VAT rate not found.'
    }
  }

  if (existingRate.code === 'NO_VAT' && !data.isActive) {
    return {
      error: 'The No VAT rate must remain active.'
    }
  }

  if (!data.isActive && existingRate.isActive) {
    const [activeCount] = await db
      .select({ total: count() })
      .from(vatRates)
      .where(
        and(
          eq(vatRates.parishCouncilId, parishCouncilId),
          eq(vatRates.isActive, true),
          ne(vatRates.id, data.id)
        )
      )

    if ((activeCount?.total ?? 0) === 0) {
      return {
        error: 'At least one VAT rate must remain active.'
      }
    }
  }

  try {
    await db
      .update(vatRates)
      .set({
        name: data.name,
        ratePercent: data.ratePercent,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(vatRates.id, data.id),
          eq(vatRates.parishCouncilId, parishCouncilId)
        )
      )
  } catch {
    return {
      error: 'Could not update VAT rate.'
    }
  }

  revalidatePath('/settings/vat-rates')
  revalidatePath('/ledger/bank-entry/new')

  return {
    success: 'VAT rate saved.'
  }
}

export async function deleteVatRateAction(formData: FormData) {
  const { parishCouncilId } = await requireParishCouncil()

  const id = clean(formData.get('id'))

  if (!id) {
    return
  }

  const [rate] = await db
    .select({
      id: vatRates.id,
      isSystem: vatRates.isSystem
    })
    .from(vatRates)
    .where(
      and(eq(vatRates.id, id), eq(vatRates.parishCouncilId, parishCouncilId))
    )
    .limit(1)

  if (!rate) {
    return
  }

  if (rate.isSystem) {
    return
  }

  await db
    .delete(vatRates)
    .where(
      and(eq(vatRates.id, id), eq(vatRates.parishCouncilId, parishCouncilId))
    )

  revalidatePath('/settings/vat-rates')
  revalidatePath('/ledger/bank-entry/new')
}
