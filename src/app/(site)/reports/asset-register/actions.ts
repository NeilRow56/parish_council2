// src/app/(site)/reports/asset-register/actions.ts

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { fixedAssets, parishCouncils, reserves } from '@/db/schema'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'
import { getFinancialYearDateWarning } from '@/lib/financial-years/date-range'
import { getEffectiveAccountingBasis } from '@/lib/reports/agar'

type ActionResult = { success: true } | { success: false; error: string }

type DisposalInput = {
  disposalDate: string
  proceeds: string
}

type DisposalNominalSpec = {
  code: string
  name: string
  type: 'INCOME' | 'EXPENDITURE'
  category: string
  agarBox: 'BOX_3_OTHER_RECEIPTS' | 'BOX_6_OTHER_PAYMENTS'
}

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

function amountToPence(value: string | number | null | undefined) {
  const amount = Number(String(value ?? '0').replace(/,/g, '').trim() || 0)

  if (!Number.isFinite(amount)) {
    throw new Error('Amount must be a valid number.')
  }

  return Math.round(amount * 100)
}

function formatPence(value: number) {
  return (value / 100).toFixed(2)
}

function assetLabel(asset: {
  refNo: string | null
  description: string
}) {
  return [asset.refNo, asset.description].filter(Boolean).join(' ')
}

function normaliseCategory(value: string | null) {
  return value
    ?.toLowerCase()
    .replace(/^fixed assets?\s*-\s*/, '')
    .trim()
}

async function ensureDisposalNominalCode({
  parishCouncilId,
  financialYearId,
  spec
}: {
  parishCouncilId: string
  financialYearId: string
  spec: DisposalNominalSpec
}) {
  const [existing] = await db
    .select({
      id: nominalCodes.id,
      type: nominalCodes.type,
      agarBox: nominalCodes.agarBox,
      isActive: nominalCodes.isActive
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYearId),
        eq(nominalCodes.code, spec.code)
      )
    )
    .limit(1)

  if (existing) {
    if (
      existing.type !== spec.type ||
      existing.agarBox !== spec.agarBox ||
      !existing.isActive
    ) {
      throw new Error(
        `${spec.code} ${spec.name} exists but is not active with the required AGAR mapping.`
      )
    }

    return { id: existing.id }
  }

  const [created] = await db
    .insert(nominalCodes)
    .values({
      parishCouncilId,
      financialYearId,
      code: spec.code,
      name: spec.name,
      type: spec.type,
      category: spec.category,
      agarBox: spec.agarBox,
      isActive: true
    })
    .returning({ id: nominalCodes.id })

  return created
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
      refNo: nullableText(formData.get('refNo')),
      category,
      insuranceCategory: nullableText(formData.get('insuranceCategory')),
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
        refNo: nullableText(formData.get('refNo')),
        category,
        insuranceCategory: nullableText(formData.get('insuranceCategory')),
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
  assetId: string,
  input: DisposalInput
): Promise<ActionResult> {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user?.parishCouncilId) {
      redirect('/auth/login')
    }

    const parishCouncilId = session.user.parishCouncilId
    const userId = session.user.id

    const disposalDate = input.disposalDate
    const proceedsPence = amountToPence(input.proceeds)

    if (!disposalDate) {
      return { success: false, error: 'Disposal date is required.' }
    }

    if (proceedsPence < 0) {
      return {
        success: false,
        error: 'Disposal proceeds cannot be negative.'
      }
    }

    const [asset] = await db
      .select({
        id: fixedAssets.id,
        financialYearId: fixedAssets.financialYearId,
        nominalCodeId: fixedAssets.nominalCodeId,
        refNo: fixedAssets.refNo,
        category: fixedAssets.category,
        insuranceCategory: fixedAssets.insuranceCategory,
        description: fixedAssets.description,
        assetRegisterValue: fixedAssets.assetRegisterValue,
        purchaseCost: fixedAssets.purchaseCost,
        isDisposed: fixedAssets.isDisposed
      })
      .from(fixedAssets)
      .where(
        and(
          eq(fixedAssets.id, assetId),
          eq(fixedAssets.parishCouncilId, parishCouncilId)
        )
      )
      .limit(1)

    if (!asset) {
      return { success: false, error: 'Fixed asset not found.' }
    }

    if (asset.isDisposed) {
      return { success: false, error: 'This asset has already been disposed.' }
    }

    const [financialYear] = await db
      .select({
        id: financialYears.id,
        label: financialYears.label,
        startDate: financialYears.startDate,
        endDate: financialYears.endDate,
        isClosed: financialYears.isClosed
      })
      .from(financialYears)
      .where(
        and(
          eq(financialYears.id, asset.financialYearId),
          eq(financialYears.parishCouncilId, parishCouncilId)
        )
      )
      .limit(1)

    if (!financialYear || financialYear.isClosed) {
      return {
        success: false,
        error: 'Disposal cannot be posted into a closed financial year.'
      }
    }

    const dateWarning = getFinancialYearDateWarning(disposalDate, financialYear)

    if (dateWarning) {
      return { success: false, error: dateWarning }
    }

    const [council] = await db
      .select({ accountingBasis: parishCouncils.accountingBasis })
      .from(parishCouncils)
      .where(eq(parishCouncils.id, parishCouncilId))
      .limit(1)

    const accountingBasis = getEffectiveAccountingBasis(council?.accountingBasis)
    const assetValuePence = amountToPence(asset.assetRegisterValue)
    const description = `Fixed asset disposal (${
      accountingBasis === 'INCOME_AND_EXPENDITURE' ? 'I&E' : 'R&P'
    } basis): ${assetLabel(asset)}`

    if (assetValuePence <= 0) {
      return {
        success: false,
        error: 'Disposed asset value must be greater than zero.'
      }
    }

    const [defaultReserve] = await db
      .select({ id: reserves.id })
      .from(reserves)
      .where(
        and(
          eq(reserves.parishCouncilId, parishCouncilId),
          eq(reserves.isDefault, true),
          eq(reserves.isActive, true)
        )
      )
      .limit(1)

    if (!defaultReserve) {
      return {
        success: false,
        error: 'No active default reserve has been configured.'
      }
    }

    const fixedAssetCodes = await db
      .select({
        id: nominalCodes.id,
        code: nominalCodes.code,
        name: nominalCodes.name
      })
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.parishCouncilId, parishCouncilId),
          eq(nominalCodes.financialYearId, financialYear.id),
          eq(nominalCodes.agarBox, 'BOX_9_FIXED_ASSETS'),
          eq(nominalCodes.isActive, true)
        )
      )

    const assetClassification =
      asset.insuranceCategory || asset.category || asset.description
    const normalisedAssetClassification = normaliseCategory(assetClassification)
    const fixedAssetNominal =
      fixedAssetCodes.find(code => code.id === asset.nominalCodeId) ??
      fixedAssetCodes.find(
        code => normaliseCategory(code.name) === normalisedAssetClassification
      ) ??
      (fixedAssetCodes.length === 1 ? fixedAssetCodes[0] : null)

    if (!fixedAssetNominal) {
      return {
        success: false,
        error:
          'No matching fixed asset nominal code was found for this asset classification.'
      }
    }

    const profitOrLossPence = proceedsPence - assetValuePence
    let profitOrLossCode: { id: string } | null = null
    let memoCode: { id: string } | null = null
    let proceedsClearingCode: { id: string } | null = null

    if (accountingBasis === 'RECEIPTS_AND_PAYMENTS') {
      const [code] = await db
        .select({ id: nominalCodes.id })
        .from(nominalCodes)
        .where(
          and(
            eq(nominalCodes.parishCouncilId, parishCouncilId),
            eq(nominalCodes.financialYearId, financialYear.id),
            eq(nominalCodes.code, '3090'),
            eq(nominalCodes.isActive, true)
          )
        )
        .limit(1)

      memoCode = code ?? null

      if (!memoCode) {
        return {
          success: false,
          error: 'Fixed Asset Opening Reserve (3090) nominal code is missing.'
        }
      }
    }

    if (accountingBasis === 'INCOME_AND_EXPENDITURE' && proceedsPence > 0) {
      const [code] = await db
        .select({ id: nominalCodes.id })
        .from(nominalCodes)
        .where(
          and(
            eq(nominalCodes.parishCouncilId, parishCouncilId),
            eq(nominalCodes.financialYearId, financialYear.id),
            eq(nominalCodes.code, '2150'),
            eq(nominalCodes.isActive, true)
          )
        )
        .limit(1)

      proceedsClearingCode = code ?? null

      if (!proceedsClearingCode) {
        return {
          success: false,
          error:
            'Debtors / Receivables (2150) nominal code is missing for disposal proceeds.'
        }
      }
    }

    if (accountingBasis === 'INCOME_AND_EXPENDITURE' && profitOrLossPence > 0) {
      try {
        profitOrLossCode = await ensureDisposalNominalCode({
          parishCouncilId,
          financialYearId: financialYear.id,
          spec: {
            code: '4090',
            name: 'Profit on asset disposals',
            type: 'INCOME',
            category: 'Disposals',
            agarBox: 'BOX_3_OTHER_RECEIPTS'
          }
        })
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to prepare disposal profit nominal code.'
        }
      }
    }

    if (accountingBasis === 'INCOME_AND_EXPENDITURE' && profitOrLossPence < 0) {
      try {
        profitOrLossCode = await ensureDisposalNominalCode({
          parishCouncilId,
          financialYearId: financialYear.id,
          spec: {
            code: '5990',
            name: 'Loss on asset disposals',
            type: 'EXPENDITURE',
            category: 'Disposals',
            agarBox: 'BOX_6_OTHER_PAYMENTS'
          }
        })
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to prepare disposal loss nominal code.'
        }
      }
    }

    await db.transaction(async trx => {
      const [entry] = await trx
        .insert(journalEntries)
        .values({
          parishCouncilId,
          financialYearId: financialYear.id,
          reference: `FAD-${Date.now()}`,
          date: disposalDate,
          description,
          source: 'MANUAL',
          postedById: userId
        })
        .returning({ id: journalEntries.id })

      const lines: (typeof journalLines.$inferInsert)[] = []

      if (accountingBasis === 'RECEIPTS_AND_PAYMENTS') {
        if (!memoCode) {
          throw new Error('Fixed Asset Opening Reserve (3090) nominal code is missing.')
        }

        lines.push(
          {
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: memoCode.id,
            reserveId: defaultReserve.id,
            debit: formatPence(assetValuePence),
            credit: '0.00',
            description: 'Fixed asset disposal memo reserve'
          },
          {
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: fixedAssetNominal.id,
            reserveId: defaultReserve.id,
            debit: '0.00',
            credit: formatPence(assetValuePence),
            description: 'Fixed asset value removed from register'
          }
        )
      } else {
        if (proceedsPence > 0) {
          if (!proceedsClearingCode) {
            throw new Error(
              'Debtors / Receivables (2150) nominal code is missing for disposal proceeds.'
            )
          }

          lines.push({
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: proceedsClearingCode.id,
            reserveId: defaultReserve.id,
            debit: formatPence(proceedsPence),
            credit: '0.00',
            description: 'Fixed asset disposal proceeds'
          })
        }

        if (profitOrLossPence < 0 && profitOrLossCode) {
          lines.push({
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: profitOrLossCode.id,
            reserveId: defaultReserve.id,
            debit: formatPence(Math.abs(profitOrLossPence)),
            credit: '0.00',
            description: 'Loss on fixed asset disposal'
          })
        }

        lines.push({
          parishCouncilId,
          journalEntryId: entry.id,
          nominalCodeId: fixedAssetNominal.id,
          reserveId: defaultReserve.id,
          debit: '0.00',
          credit: formatPence(assetValuePence),
          description: 'Fixed asset value removed from register'
        })

        if (profitOrLossPence > 0 && profitOrLossCode) {
          lines.push({
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: profitOrLossCode.id,
            reserveId: defaultReserve.id,
            debit: '0.00',
            credit: formatPence(profitOrLossPence),
            description: 'Profit on fixed asset disposal'
          })
        }
      }

      await trx.insert(journalLines).values(lines)

      await trx
        .update(fixedAssets)
        .set({
          isDisposed: true,
          disposalDate,
          disposalNotes: `Journal ${entry.id}`,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(fixedAssets.id, assetId),
            eq(fixedAssets.parishCouncilId, parishCouncilId)
          )
        )
    })

    revalidatePath('/reports/asset-register')
    revalidatePath('/reports/agar-summary')
    revalidatePath('/ledger')

    return { success: true }
  } catch (error) {
    console.error(error)

    return {
      success: false,
      error: 'Failed to dispose fixed asset.'
    }
  }
}
