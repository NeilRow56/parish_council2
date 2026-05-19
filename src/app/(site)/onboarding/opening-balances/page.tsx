// src/app/(site)/onboarding/opening-balances/page.tsx

import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/db'

import {
  financialYears,
  nominalCodes,
  nominalOpeningBalances
} from '@/db/schema'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

import { Button } from '@/components/ui/button'
import { SaveOpeningBalancesButton } from '../council-details/_components/save-opening-balance-button'

async function saveOpeningBalances(formData: FormData) {
  'use server'

  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId
  const financialYearId = String(formData.get('financialYearId') ?? '')

  function redirectWithStatus(params: { error?: string; saved?: boolean }) {
    const searchParams = new URLSearchParams()

    if (params.error) searchParams.set('openingError', params.error)
    if (params.saved) searchParams.set('openingSaved', '1')

    redirect(`/onboarding/opening-balances?${searchParams.toString()}`)
  }

  if (!financialYearId) {
    redirectWithStatus({ error: 'Missing financial year.' })
  }

  const entries = Array.from(formData.entries()).filter(([key]) =>
    key.startsWith('openingBalance:')
  )

  for (const [key, value] of entries) {
    const nominalCodeId = key.replace('openingBalance:', '')
    const amount = String(value ?? '').trim()

    if (amount === '') {
      continue
    }

    if (!Number.isFinite(Number(amount))) {
      redirectWithStatus({
        error: 'Opening balances must be valid numbers.'
      })
    }

    await db
      .insert(nominalOpeningBalances)
      .values({
        parishCouncilId,
        financialYearId,
        nominalCodeId,
        amount
      })
      .onConflictDoUpdate({
        target: [
          nominalOpeningBalances.financialYearId,
          nominalOpeningBalances.nominalCodeId
        ],
        set: {
          amount
        }
      })
  }

  revalidatePath('/onboarding/opening-balances')
  revalidatePath('/reports/agar-summary')
  redirectWithStatus({ saved: true })
}

export default async function OpeningBalancesPage({
  searchParams
}: {
  searchParams?: Promise<{
    openingError?: string
    openingSaved?: string
  }>
}) {
  const params = await searchParams
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId

  const [financialYear] = await db
    .select()
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1)

  if (!financialYear) {
    redirect('/onboarding/council-details')
  }

  const codes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      category: nominalCodes.category,
      type: nominalCodes.type,
      agarBox: nominalCodes.agarBox
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id)
      )
    )

  const openingBalances = await db
    .select()
    .from(nominalOpeningBalances)
    .where(
      and(
        eq(nominalOpeningBalances.parishCouncilId, parishCouncilId),
        eq(nominalOpeningBalances.financialYearId, financialYear.id)
      )
    )

  const balancesMap = new Map(
    openingBalances.map(b => [b.nominalCodeId, b.amount])
  )

  const groupedCodes = {
    banks: codes.filter(c => c.category === 'Bank'),
    reserves: codes.filter(c => c.category === 'Reserves'),
    fixedAssets: codes.filter(c => c.category === 'Fixed Assets'),
    borrowings: codes.filter(c => c.agarBox === 'BOX_10_BORROWINGS')
  }

  return (
    <form action={saveOpeningBalances}>
      <input type='hidden' name='financialYearId' value={financialYear.id} />

      <div className='mx-auto max-w-5xl space-y-6 p-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold'>Opening balances</h1>
            <p className='text-muted-foreground mt-1'>
              Enter brought-forward balances at the start of the financial year.
            </p>
            {params?.openingError ? (
              <p className='mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
                {params.openingError}
              </p>
            ) : null}
            {params?.openingSaved === '1' ? (
              <p className='mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700'>
                Opening balances saved.
              </p>
            ) : null}
          </div>

          <Link href='/onboarding/council-details'>
            <Button type='button' variant='outline'>
              Back to council details
            </Button>
          </Link>
        </div>

        <OpeningBalanceCard
          title='Bank balances'
          description='Opening balances for current and savings accounts.'
          codes={groupedCodes.banks}
          balancesMap={balancesMap}
        />

        <OpeningBalanceCard
          title='Reserves'
          description='General and earmarked reserve balances.'
          codes={groupedCodes.reserves}
          balancesMap={balancesMap}
        />

        <OpeningBalanceCard
          title='Fixed assets'
          description='Opening fixed asset balances brought forward.'
          codes={groupedCodes.fixedAssets}
          balancesMap={balancesMap}
        />

        {groupedCodes.borrowings.length > 0 ? (
          <OpeningBalanceCard
            title='Borrowings'
            description='Opening loan and borrowing balances.'
            codes={groupedCodes.borrowings}
            balancesMap={balancesMap}
          />
        ) : null}

        <div className='flex justify-end'>
          <SaveOpeningBalancesButton />
        </div>
      </div>
    </form>
  )
}

type OpeningBalanceCode = {
  id: string
  code: string
  name: string
}

function OpeningBalanceCard({
  title,
  description,
  codes,
  balancesMap
}: {
  title: string
  description: string
  codes: OpeningBalanceCode[]
  balancesMap: Map<string, string>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className='space-y-4'>
        {codes.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            No nominal codes found.
          </p>
        ) : (
          codes.map(code => (
            <div
              key={code.id}
              className='grid grid-cols-[120px_1fr_200px] items-center gap-4'
            >
              <div className='font-medium'>{code.code}</div>
              <div>{code.name}</div>

              <input
                name={`openingBalance:${code.id}`}
                type='number'
                step='0.01'
                defaultValue={String(balancesMap.get(code.id) ?? '')}
                placeholder='0.00'
                className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
