// src/app/(site)/reports/asset-register/page.tsx

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { fixedAssets } from '@/db/schema'
import { financialYears, nominalCodes } from '@/db/schema/nominalLedger'
import { FixedAssetRegisterClient } from './_components/fixed-asset-register-client'

export default async function AssetRegisterPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId

  if (!parishCouncilId) {
    redirect('/auth/register')
  }

  const [financialYear] = await db
    .select({
      id: financialYears.id,
      label: financialYears.label,
      endDate: financialYears.endDate
    })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1)

  if (!financialYear) {
    redirect('/')
  }

  const assets = await db
    .select({
      id: fixedAssets.id,
      refNo: fixedAssets.refNo,
      category: fixedAssets.category,
      insuranceCategory: fixedAssets.insuranceCategory,
      description: fixedAssets.description,
      location: fixedAssets.location,
      dateAcquired: fixedAssets.dateAcquired,
      purchaseCost: fixedAssets.purchaseCost,
      assetRegisterValue: fixedAssets.assetRegisterValue,
      nominalCodeId: fixedAssets.nominalCodeId,
      notes: fixedAssets.notes
    })
    .from(fixedAssets)
    .where(
      and(
        eq(fixedAssets.parishCouncilId, parishCouncilId),
        eq(fixedAssets.isDisposed, false)
      )
    )
    .orderBy(
      asc(fixedAssets.category),
      asc(fixedAssets.insuranceCategory),
      asc(fixedAssets.refNo)
    )

  const nominalCodeOptions = await db
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
        eq(nominalCodes.agarBox, 'BOX_9_FIXED_ASSETS')
      )
    )
    .orderBy(nominalCodes.code)

  return (
    <main className='mx-auto max-w-400 px-6 py-8'>
      <div className='mb-8'>
        <h1 className='text-2xl font-semibold tracking-tight'>
          Fixed Asset Register
        </h1>
        <p className='mt-1 text-sm text-zinc-600'>
          Register of parish council fixed assets and community assets for AGAR
          reporting.
        </p>
        <p className='mt-2 text-sm text-zinc-500'>
          Financial year:{' '}
          <span className='font-medium text-zinc-700'>
            {financialYear.label}
          </span>
        </p>
      </div>

      <FixedAssetRegisterClient
        financialYearId={financialYear.id}
        assets={assets.map(asset => ({
          id: asset.id,
          refNo: asset.refNo,
          category: asset.category,
          insuranceCategory: asset.insuranceCategory,
          description: asset.description,
          location: asset.location,
          dateAcquired: asset.dateAcquired,
          purchaseCost: asset.purchaseCost,
          assetRegisterValue: asset.assetRegisterValue,
          notes: asset.notes,
          nominalCodeId: asset.nominalCodeId
        }))}
        nominalCodes={nominalCodeOptions}
      />
    </main>
  )
}
