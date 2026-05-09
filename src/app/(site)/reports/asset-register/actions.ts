// src/app/(site)/reports/asset-register/actions.ts

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { fixedAssets } from '@/db/schema'

type ActionResult = { success: true } | { success: false; error: string }

function nullableText(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

function nullableDecimal(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

function requiredText(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

export async function createFixedAsset(
  financialYearId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user?.parishCouncilId) {
      redirect('/auth/login')
    }

    const parishCouncilId = session.user.parishCouncilId

    const category = requiredText(formData.get('category'))
    const description = requiredText(formData.get('description'))
    const assetRegisterValue = requiredText(formData.get('assetRegisterValue'))

    if (!category || !description || !assetRegisterValue) {
      return {
        success: false,
        error: 'Category, description and asset value are required.'
      }
    }

    await db.insert(fixedAssets).values({
      parishCouncilId,
      financialYearId,
      nominalCodeId: nullableText(formData.get('nominalCodeId')),
      refNo: nullableText(formData.get('refNo')),
      category,
      description,
      location: nullableText(formData.get('location')),
      dateAcquired: nullableText(formData.get('dateAcquired')),
      purchaseCost: nullableDecimal(formData.get('purchaseCost')),
      assetRegisterValue,
      notes: nullableText(formData.get('notes'))
    })

    revalidatePath('/reports/asset-register')

    return { success: true }
  } catch (error) {
    console.error(error)

    return {
      success: false,
      error: 'Failed to create fixed asset.'
    }
  }
}

export async function updateFixedAsset(
  assetId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user?.parishCouncilId) {
      redirect('/auth/login')
    }

    const parishCouncilId = session.user.parishCouncilId

    const category = requiredText(formData.get('category'))
    const description = requiredText(formData.get('description'))
    const assetRegisterValue = requiredText(formData.get('assetRegisterValue'))

    if (!category || !description || !assetRegisterValue) {
      return {
        success: false,
        error: 'Category, description and asset value are required.'
      }
    }

    await db
      .update(fixedAssets)
      .set({
        nominalCodeId: nullableText(formData.get('nominalCodeId')),
        refNo: nullableText(formData.get('refNo')),
        category,
        description,
        location: nullableText(formData.get('location')),
        dateAcquired: nullableText(formData.get('dateAcquired')),
        purchaseCost: nullableDecimal(formData.get('purchaseCost')),
        assetRegisterValue,
        notes: nullableText(formData.get('notes')),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(fixedAssets.id, assetId),
          eq(fixedAssets.parishCouncilId, parishCouncilId)
        )
      )

    revalidatePath('/reports/asset-register')

    return { success: true }
  } catch (error) {
    console.error(error)

    return {
      success: false,
      error: 'Failed to update fixed asset.'
    }
  }
}

export async function disposeFixedAsset(
  assetId: string
): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user?.parishCouncilId) {
      redirect('/auth/login')
    }

    const parishCouncilId = session.user.parishCouncilId

    await db
      .update(fixedAssets)
      .set({
        isDisposed: true,
        disposalDate: new Date().toISOString().slice(0, 10),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(fixedAssets.id, assetId),
          eq(fixedAssets.parishCouncilId, parishCouncilId)
        )
      )

    revalidatePath('/reports/asset-register')

    return { success: true }
  } catch (error) {
    console.error(error)

    return {
      success: false,
      error: 'Failed to dispose fixed asset.'
    }
  }
}
