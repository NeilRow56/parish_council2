import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { nominalCodes } from '@/db/schema/nominalLedger'
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'
import { defaultChart } from '@/lib/nominal-codes/default-chart'
import { NominalCodesSettings } from './_components/nominal-codes-settings'

const suggestedCategories = [
  'Bank',
  'Fixed Assets',
  'Current Assets',
  'Current Liabilities',
  'Reserves',
  'Income',
  'Admin',
  'Staff',
  'Maintenance',
  'Finance',
  'VAT',
  'Other'
]

export default async function NominalCodesSettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId

  const { financialYear } = await getSelectedFinancialYear(parishCouncilId)

  if (!financialYear) {
    redirect('/')
  }

  const codes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      type: nominalCodes.type,
      category: nominalCodes.category,
      agarBox: nominalCodes.agarBox,
      isBank: nominalCodes.isBank,
      isActive: nominalCodes.isActive
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id)
      )
    )
    .orderBy(asc(nominalCodes.code))

  const categoryOptions = [
    ...new Set(
      [
        ...suggestedCategories,
        ...defaultChart.map(code => code.category),
        ...codes.map(code => code.category)
      ]
        .filter((category): category is string => Boolean(category))
        .sort((a, b) => a.localeCompare(b))
    )
  ]

  if (financialYear.isClosed) {
    return (
      <main className='mx-auto max-w-5xl p-6'>
        <h1 className='text-2xl font-semibold'>Nominal codes</h1>
        <div className='mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900'>
          Financial year {financialYear.label} is closed. Nominal code editing
          is only available for open financial years.
        </div>
      </main>
    )
  }

  return (
    <main className='mx-auto max-w-7xl px-6 py-8'>
      <div className='mb-8'>
        <h1 className='text-2xl font-semibold tracking-tight'>Nominal codes</h1>
        <p className='mt-1 text-sm text-zinc-600'>
          Add new nominal codes and maintain the chart of accounts.
        </p>
        <p className='mt-2 text-sm text-zinc-500'>
          Financial year:{' '}
          <span className='font-medium text-zinc-700'>
            {financialYear.label}
          </span>
        </p>
      </div>

      <NominalCodesSettings
        financialYearId={financialYear.id}
        codes={codes}
        categoryOptions={categoryOptions}
      />
    </main>
  )
}
