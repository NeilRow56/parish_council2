'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { financialYears, nominalCodes } from '@/db/schema/nominalLedger'

const nominalCodeTypeSchema = z.enum(['INCOME', 'EXPENDITURE', 'BALANCE_SHEET'])

const agarBoxSchema = z
  .enum([
    'BOX_2_PRECEPT',
    'BOX_3_OTHER_RECEIPTS',
    'BOX_4_STAFF_COSTS',
    'BOX_5_LOAN_REPAYMENTS',
    'BOX_6_OTHER_PAYMENTS',
    'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS',
    'BOX_9_FIXED_ASSETS',
    'BOX_10_BORROWINGS'
  ])
  .nullable()
  .optional()

const createNominalCodeSchema = z.object({
  financialYearId: z.string().min(1, 'Financial year is required'),
  code: z.string().trim().min(1, 'Code is required').max(20),
  name: z.string().trim().min(1, 'Name is required').max(120),
  type: nominalCodeTypeSchema,
  category: z.string().trim().max(80).optional(),
  agarBox: agarBoxSchema,
  isBank: z.boolean().default(false)
})

const updateNominalCodeSchema = z.object({
  id: z.string().min(1, 'Nominal code id is required'),
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: z.string().trim().max(80).optional(),
  agarBox: agarBoxSchema,
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

async function assertOpenFinancialYear({
  parishCouncilId,
  financialYearId
}: {
  parishCouncilId: string
  financialYearId: string
}) {
  const [financialYear] = await db
    .select({ id: financialYears.id })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.id, financialYearId),
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1)

  if (!financialYear) {
    throw new Error('Nominal codes cannot be changed for a closed year.')
  }
}

export async function createNominalCodeAction(input: unknown) {
  const { parishCouncilId } = await getSessionContext()
  const parsed = createNominalCodeSchema.parse(input)

  if (parsed.isBank && parsed.type !== 'BALANCE_SHEET') {
    throw new Error('Bank/cash nominal codes must be balance sheet codes.')
  }

  await assertOpenFinancialYear({
    parishCouncilId,
    financialYearId: parsed.financialYearId
  })

  const [existingCode] = await db
    .select({
      id: nominalCodes.id,
      financialYearId: nominalCodes.financialYearId
    })
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
    agarBox: parsed.agarBox ?? null,
    isBank: parsed.isBank,
    isActive: true
  })

  revalidatePath('/settings/nominal-codes')
}

export async function updateNominalCodeAction(input: unknown) {
  const { parishCouncilId } = await getSessionContext()
  const parsed = updateNominalCodeSchema.parse(input)

  const [existingCode] = await db
    .select({
      id: nominalCodes.id,
      financialYearId: nominalCodes.financialYearId
    })
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

  await assertOpenFinancialYear({
    parishCouncilId,
    financialYearId: existingCode.financialYearId
  })

  await db
    .update(nominalCodes)
    .set({
      name: parsed.name,
      category: normaliseOptionalText(parsed.category),
      agarBox: parsed.agarBox ?? null,
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
