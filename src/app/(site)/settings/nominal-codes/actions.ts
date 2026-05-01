'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { nominalCodes } from '@/db/schema/nominalLedger'

const nominalCodeTypeSchema = z.enum(['INCOME', 'EXPENDITURE', 'BALANCE_SHEET'])

const createNominalCodeSchema = z.object({
  financialYearId: z.string().min(1, 'Financial year is required'),
  code: z.string().trim().min(1, 'Code is required').max(20),
  name: z.string().trim().min(1, 'Name is required').max(120),
  type: nominalCodeTypeSchema,
  category: z.string().trim().max(80).optional(),
  isBank: z.boolean().default(false)
})

const updateNominalCodeSchema = z.object({
  id: z.string().min(1, 'Nominal code id is required'),
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: z.string().trim().max(80).optional(),
  isActive: z.boolean()
})

function normaliseOptionalText(value: string | undefined) {
  const cleaned = value?.trim()
  return cleaned ? cleaned : null
}

async function getSessionContext() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user) {
    throw new Error('Unauthorised')
  }

  const parishCouncilId = session.user.parishCouncilId

  if (!parishCouncilId) {
    throw new Error('User is not linked to a parish council')
  }

  return {
    parishCouncilId,
    userId: session.user.id
  }
}

export async function createNominalCodeAction(input: unknown) {
  const { parishCouncilId } = await getSessionContext()
  const parsed = createNominalCodeSchema.parse(input)

  if (parsed.isBank && parsed.type !== 'BALANCE_SHEET') {
    throw new Error('Bank/cash nominal codes must be balance sheet codes.')
  }

  const [existingCode] = await db
    .select({ id: nominalCodes.id })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, parsed.financialYearId),
        eq(nominalCodes.code, parsed.code)
      )
    )
    .limit(1)

  if (existingCode) {
    throw new Error('A nominal code with this code already exists.')
  }

  await db.insert(nominalCodes).values({
    parishCouncilId,
    financialYearId: parsed.financialYearId,
    code: parsed.code,
    name: parsed.name,
    type: parsed.type,
    category: normaliseOptionalText(parsed.category),
    isBank: parsed.isBank,
    isActive: true
  })

  revalidatePath('/settings/nominal-codes')
}

export async function updateNominalCodeAction(input: unknown) {
  const { parishCouncilId } = await getSessionContext()
  const parsed = updateNominalCodeSchema.parse(input)

  const [existingCode] = await db
    .select({ id: nominalCodes.id })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.id, parsed.id),
        eq(nominalCodes.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!existingCode) {
    throw new Error('Nominal code not found.')
  }

  await db
    .update(nominalCodes)
    .set({
      name: parsed.name,
      category: normaliseOptionalText(parsed.category),
      isActive: parsed.isActive
    })
    .where(
      and(
        eq(nominalCodes.id, parsed.id),
        eq(nominalCodes.parishCouncilId, parishCouncilId)
      )
    )

  revalidatePath('/settings/nominal-codes')
}
