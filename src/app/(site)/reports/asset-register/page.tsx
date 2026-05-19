// src/app/(site)/reports/asset-register/page.tsx

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, asc, desc, eq, gte, isNull, lte, or } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { fixedAssets } from '@/db/schema'
import { financialYears, nominalCodes } from '@/db/schema/nominalLedger'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { FixedAssetRegisterClient } from './_components/fixed-asset-register-client'
import { ExportPdfButton } from './_components/export-pdf-button'

type SearchParams = {
  financialYearId?: string
}

export default async function AssetRegisterPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>
}) {
  const params = await searchParams

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

  const [financialYear] = params?.financialYearId
    ? await db
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
            eq(financialYears.parishCouncilId, parishCouncilId),
            eq(financialYears.id, params.financialYearId)
          )
        )
        .limit(1)
    : await db
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
            eq(financialYears.parishCouncilId, parishCouncilId),
            eq(financialYears.isClosed, false)
          )
        )
        .orderBy(desc(financialYears.startDate))
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
        or(
          isNull(fixedAssets.dateAcquired),
          lte(fixedAssets.dateAcquired, financialYear.endDate)
        ),
        or(
          eq(fixedAssets.isDisposed, false),
          isNull(fixedAssets.disposalDate),
          gte(fixedAssets.disposalDate, financialYear.startDate)
        )
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

  const exportHref = `/reports/asset-register/export?financialYearId=${financialYear.id}`

  return (
    <main className='mx-auto max-w-400 px-6 py-8'>
      <div className='mb-8 flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Fixed Asset Register
          </h1>
          <p className='mt-1 text-sm text-zinc-600'>
            Register of parish council fixed assets and community assets for
            AGAR reporting.
          </p>
          <p className='mt-2 text-sm text-zinc-500'>
            Financial year:{' '}
            <span className='font-medium text-zinc-700'>
              {financialYear.label}
            </span>
          </p>
          {financialYear.isClosed ? (
            <p className='mt-1 text-sm text-zinc-500'>
              Closed year: this register is read-only.
            </p>
          ) : null}
        </div>

        <ExportPdfButton href={exportHref} />
      </div>

      <Card className='mb-6 border-blue-200 bg-blue-50/70'>
        <CardHeader>
          <CardTitle className='text-base text-blue-950'>
            Fixed asset valuation guidance
          </CardTitle>
          <CardDescription className='text-blue-900'>
            Practical notes for keeping the register consistent with AGAR fixed
            asset reporting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 text-sm text-blue-950 md:grid-cols-2'>
            <section>
              <h2 className='font-medium'>Historic cost</h2>
              <p className='mt-1 text-blue-900'>
                Assets should normally be recorded at the original purchase cost
                paid by the council. Once recorded, values do not change each
                year unless assets are acquired or disposed of.
              </p>
            </section>

            <section>
              <h2 className='font-medium'>Insurance value exception</h2>
              <p className='mt-1 text-blue-900'>
                Where the original purchase cost is unknown, the insurance value
                at first recognition may be used as a reasonable proxy. Later
                insurance revaluations should not normally replace the original
                recorded figure.
              </p>
            </section>

            <section>
              <h2 className='font-medium'>Nominal values</h2>
              <p className='mt-1 text-blue-900'>
                Community or donated assets with no meaningful resale value,
                such as war memorials, may be recorded at a nominal value of £1.
              </p>
            </section>

            <section>
              <h2 className='font-medium'>Alternative valuation approaches</h2>
              <p className='mt-1 text-blue-900'>
                Historic cost is the standard and simplest approach. Another
                reasonable basis can be used if formally approved, applied
                consistently, and documented.
              </p>
            </section>
          </div>

          <p className='mt-4 rounded-md border border-blue-200 bg-white/70 px-3 py-2 text-sm text-blue-950'>
            The AGAR fixed asset figure, Box 9, already uses the correct
            carried-forward basis from the fixed asset register.
          </p>
        </CardContent>
      </Card>

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
        readOnly={financialYear.isClosed}
      />
    </main>
  )
}
