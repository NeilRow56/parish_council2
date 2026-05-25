// src/app/(site)/onboarding/opening-balances/page.tsx

import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/db'
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'

import {
  financialYears,
  nominalCodes,
  nominalOpeningBalances,
  yearEndRuns
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
import {
  isBorrowingCode,
  isFixedAssetCode,
  isMemoReserveCode,
  isNormalReserveCode,
  openingBalanceCentsTotal,
  openingBalanceSignForCode,
  toStoredOpeningBalanceAmount
} from '@/lib/opening-balances/validation'

function parsePositiveMoney(value: FormDataEntryValue | null) {
  const cleaned = String(value ?? '').replace(/,/g, '').trim()

  if (cleaned === '') return 0

  const parsed = Number(cleaned)

  if (!Number.isFinite(parsed)) {
    throw new Error('Opening balances must be valid numbers.')
  }

  if (parsed < 0) {
    throw new Error('Enter opening balances as positive amounts.')
  }

  return parsed
}

function formatMoney(amount: number) {
  return amount.toFixed(2)
}

async function getRollforwardLockForYear({
  parishCouncilId,
  financialYearId
}: {
  parishCouncilId: string
  financialYearId: string
}) {
  const [rollforwardRun] = await db
    .select({ id: yearEndRuns.id })
    .from(yearEndRuns)
    .where(
      and(
        eq(yearEndRuns.parishCouncilId, parishCouncilId),
        eq(yearEndRuns.toFinancialYearId, financialYearId),
        eq(yearEndRuns.status, 'COMPLETED')
      )
    )
    .limit(1)

  return Boolean(rollforwardRun)
}

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

  function redirectWithStatus(params: { error?: string; saved?: boolean }): never {
    const searchParams = new URLSearchParams()

    if (params.error) searchParams.set('openingError', params.error)
    if (params.saved) searchParams.set('openingSaved', '1')

    redirect(`/onboarding/opening-balances?${searchParams.toString()}`)
  }

  if (!financialYearId) {
    redirectWithStatus({ error: 'Missing financial year.' })
  }

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
    redirectWithStatus({
      error: 'Opening balances can only be edited for the open financial year.'
    })
  }

  const isLockedByRollforward = await getRollforwardLockForYear({
    parishCouncilId,
    financialYearId
  })

  if (isLockedByRollforward) {
    redirectWithStatus({
      error:
        'Opening balances for this financial year were created by year-end rollforward and are locked. To correct them, post an adjustment journal or reverse/re-run the year-end process where appropriate.'
    })
  }

  const codes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      category: nominalCodes.category,
      name: nominalCodes.name,
      agarBox: nominalCodes.agarBox
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYearId)
      )
    )

  const codesById = new Map(codes.map(code => [code.id, code]))
  const fixedAssetMemoReserve = codes.find(code => code.code === '3090')
  const borrowingMemoReserve = codes.find(code => code.code === '3095')
  const entries = Array.from(formData.entries()).filter(([key]) =>
    key.startsWith('openingBalance:')
  )
  const signedBalances = new Map<string, number>()
  let fixedAssetOpeningTotal = 0
  let borrowingOpeningTotal = 0

  try {
    for (const [key, value] of entries) {
      const nominalCodeId = key.replace('openingBalance:', '')
      const code = codesById.get(nominalCodeId)

      if (!code || isMemoReserveCode(code)) {
        continue
      }

      const amount = parsePositiveMoney(value)

      const signedAmount = toStoredOpeningBalanceAmount(code, amount)

      if (isFixedAssetCode(code)) {
        signedBalances.set(nominalCodeId, signedAmount)
        fixedAssetOpeningTotal += amount
        continue
      }

      if (isBorrowingCode(code)) {
        signedBalances.set(nominalCodeId, signedAmount)
        borrowingOpeningTotal += amount
        continue
      }

      if (isNormalReserveCode(code)) {
        signedBalances.set(nominalCodeId, signedAmount)
        continue
      }

      signedBalances.set(nominalCodeId, signedAmount)
    }
  } catch (error) {
    redirectWithStatus({
      error:
        error instanceof Error ? error.message : 'Opening balances are invalid.'
    })
  }

  if (fixedAssetOpeningTotal > 0) {
    if (!fixedAssetMemoReserve) {
      redirectWithStatus({
        error:
          'Fixed Asset Opening Reserve (3090) is missing. Restore the default nominal codes before saving fixed asset opening balances.'
      })
    }

    signedBalances.set(fixedAssetMemoReserve.id, -fixedAssetOpeningTotal)
  }

  if (borrowingOpeningTotal > 0) {
    if (!borrowingMemoReserve) {
      redirectWithStatus({
        error:
          'Borrowings Opening Reserve (3095) is missing. Restore the default nominal codes before saving borrowing opening balances.'
      })
    }

    signedBalances.set(borrowingMemoReserve.id, borrowingOpeningTotal)
  }

  const total = openingBalanceCentsTotal(signedBalances.values())

  if (total !== 0) {
    redirectWithStatus({
      error:
        'Opening balances do not balance. Bank and fixed asset debits must be matched by reserve, borrowing, or memo-reserve credits.'
    })
  }

  const values = Array.from(signedBalances.entries())
    .filter(([, amount]) => Math.round(amount * 100) !== 0)
    .map(([nominalCodeId, amount]) => ({
      parishCouncilId,
      financialYearId,
      nominalCodeId,
      amount: formatMoney(amount)
    }))

  await db.transaction(async tx => {
    await tx
      .delete(nominalOpeningBalances)
      .where(
        and(
          eq(nominalOpeningBalances.parishCouncilId, parishCouncilId),
          eq(nominalOpeningBalances.financialYearId, financialYearId)
        )
      )

    if (values.length > 0) {
      await tx.insert(nominalOpeningBalances).values(values)
    }
  })

  revalidatePath('/onboarding/opening-balances')
  revalidatePath('/reports/agar-summary')
  revalidatePath('/reports/trial-balance')
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

  const { financialYear } = await getSelectedFinancialYear(parishCouncilId)

  if (!financialYear) {
    redirect('/onboarding/council-details')
  }

  if (financialYear.isClosed) {
    return (
      <main className='mx-auto max-w-5xl px-6 py-8'>
        <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900'>
          Financial year {financialYear.label} is closed. Opening balances are
          read-only for closed years.
        </div>
      </main>
    )
  }

  const codes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      category: nominalCodes.category,
      type: nominalCodes.type,
      agarBox: nominalCodes.agarBox,
      isBank: nominalCodes.isBank
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

  const isLockedByRollforward = await getRollforwardLockForYear({
    parishCouncilId,
    financialYearId: financialYear.id
  })

  const groupedCodes = {
    banks: codes.filter(c => c.category === 'Bank' || c.isBank),
    reserves: codes.filter(c => isNormalReserveCode(c)),
    fixedAssets: codes.filter(c => c.category === 'Fixed Assets'),
    borrowings: codes.filter(c => c.agarBox === 'BOX_10_BORROWINGS'),
    otherBalanceSheet: codes.filter(
      c =>
        c.type === 'BALANCE_SHEET' &&
        c.category !== 'Bank' &&
        !c.isBank &&
        !isNormalReserveCode(c) &&
        !isMemoReserveCode(c) &&
        !isFixedAssetCode(c) &&
        !isBorrowingCode(c)
    )
  }

  return (
    <form action={saveOpeningBalances}>
      <input type='hidden' name='financialYearId' value={financialYear.id} />

      <div className='mx-auto max-w-5xl space-y-6 p-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold'>Opening balances</h1>
            <p className='text-muted-foreground mt-1'>
              Enter positive brought-forward balances. The system posts reserves
              and borrowings to the correct credit/debit side automatically.
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
            {isLockedByRollforward ? (
              <p className='mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800'>
                Opening balances for this financial year were created by
                year-end rollforward and are locked. To correct them, post an
                adjustment journal or reverse/re-run the year-end process where
                appropriate.
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
          description='Enter positive cash balances. These post as debit balances.'
          codes={groupedCodes.banks}
          balancesMap={balancesMap}
          isLocked={isLockedByRollforward}
        />

        <OpeningBalanceCard
          title='Reserves'
          description='Enter positive reserve balances. These post as credit balances.'
          codes={groupedCodes.reserves}
          balancesMap={balancesMap}
          isLocked={isLockedByRollforward}
        />

        <OpeningBalanceCard
          title='Fixed assets'
          description='Enter positive asset values. The matching memo reserve is posted automatically.'
          codes={groupedCodes.fixedAssets}
          balancesMap={balancesMap}
          isLocked={isLockedByRollforward}
        />

        {groupedCodes.borrowings.length > 0 ? (
          <OpeningBalanceCard
            title='Borrowings'
            description='Enter positive outstanding loan balances. The matching memo reserve is posted automatically.'
            codes={groupedCodes.borrowings}
            balancesMap={balancesMap}
            isLocked={isLockedByRollforward}
          />
        ) : null}

        {groupedCodes.otherBalanceSheet.length > 0 ? (
          <OpeningBalanceCard
            title='Other balance sheet balances'
            description='Optional: enter VAT control, debtors, creditors, accruals, prepayments, or receipts in advance where needed.'
            codes={groupedCodes.otherBalanceSheet}
            balancesMap={balancesMap}
            isLocked={isLockedByRollforward}
          />
        ) : null}

        <div className='flex justify-end'>
          <SaveOpeningBalancesButton disabled={isLockedByRollforward} />
        </div>
      </div>
    </form>
  )
}

type OpeningBalanceCode = {
  id: string
  code: string
  name: string
  category: string | null
  agarBox: string | null
}

function formatOpeningBalanceInput(
  code: OpeningBalanceCode,
  balancesMap: Map<string, string>
) {
  const amount = Number(balancesMap.get(code.id) ?? 0)

  if (amount === 0) return ''

  if (openingBalanceSignForCode(code) === -1) {
    return String(Math.abs(amount))
  }

  return String(amount)
}

function OpeningBalanceCard({
  title,
  description,
  codes,
  balancesMap,
  isLocked
}: {
  title: string
  description: string
  codes: OpeningBalanceCode[]
  balancesMap: Map<string, string>
  isLocked: boolean
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
                min='0'
                defaultValue={formatOpeningBalanceInput(code, balancesMap)}
                placeholder='0.00'
                readOnly={isLocked}
                disabled={isLocked}
                className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
