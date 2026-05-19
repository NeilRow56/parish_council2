import { and, eq, sql } from 'drizzle-orm'
import { AlertTriangle, CheckCircle2, Circle, LockKeyhole } from 'lucide-react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { runYearEndRollforward } from './actions'

import { db } from '@/db'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
  nominalOpeningBalances,
  yearEndRuns
} from '@/db/schema/nominalLedger'
import { auth } from '@/lib/auth'
import { PendingSubmitButton } from '@/components/shared/pending-submit-button'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

// Uncomment when actions.ts exists
// import { runYearEndRollforward } from './actions'

type PageProps = {
  params: Promise<{
    financialYearId: string
  }>
  searchParams?: Promise<{
    yearEndError?: string
  }>
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)
}

function formatDate(value: string | Date | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

function getNumericCode(code: string) {
  const parsed = Number.parseInt(code, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function isReserveCode(code: string) {
  const numericCode = getNumericCode(code)
  return numericCode >= 3000 && numericCode < 4000
}

function isFixedAssetOpeningReserve(code: string) {
  return code === '3090'
}

function isBorrowingsOpeningReserve(code: string) {
  return code === '3095'
}

function isMemoOpeningReserve(code: string) {
  return isFixedAssetOpeningReserve(code) || isBorrowingsOpeningReserve(code)
}

export default async function YearEndPage({ params, searchParams }: PageProps) {
  const { financialYearId } = await params
  const query = await searchParams

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

  const financialYear = await db.query.financialYears.findFirst({
    where: and(
      eq(financialYears.id, financialYearId),
      eq(financialYears.parishCouncilId, parishCouncilId)
    )
  })

  if (!financialYear) {
    redirect('/settings/financial-years')
  }

  const existingYearEndRun = await db.query.yearEndRuns.findFirst({
    where: and(
      eq(yearEndRuns.parishCouncilId, parishCouncilId),
      eq(yearEndRuns.fromFinancialYearId, financialYear.id)
    )
  })

  const codes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      type: nominalCodes.type,
      category: nominalCodes.category,
      agarBox: nominalCodes.agarBox,
      isBank: nominalCodes.isBank,
      isVatRecoverable: nominalCodes.isVatRecoverable,
      isVatPayable: nominalCodes.isVatPayable
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id),
        eq(nominalCodes.isActive, true)
      )
    )
    .orderBy(nominalCodes.code)

  const balanceSheetCodes = codes.filter(code => code.type === 'BALANCE_SHEET')
  const incomeExpenditureCodes = codes.filter(code => {
    const numericCode = getNumericCode(code.code)
    return numericCode >= 4000 && numericCode <= 9999
  })

  const bankCodes = balanceSheetCodes.filter(code => code.isBank)
  const reserveCodes = balanceSheetCodes.filter(code =>
    isReserveCode(code.code)
  )
  const generalReserveCode =
    reserveCodes.find(code => code.code === '3000') ?? reserveCodes[0]

  const openingRows = await db
    .select({
      nominalCodeId: nominalOpeningBalances.nominalCodeId,
      amount: nominalOpeningBalances.amount
    })
    .from(nominalOpeningBalances)
    .where(
      and(
        eq(nominalOpeningBalances.parishCouncilId, parishCouncilId),
        eq(nominalOpeningBalances.financialYearId, financialYear.id)
      )
    )

  const movementRows = await db
    .select({
      nominalCodeId: journalLines.nominalCodeId,
      debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
      credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .where(
      and(
        eq(journalLines.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, financialYear.id)
      )
    )
    .groupBy(journalLines.nominalCodeId)

  const openingByNominalCode = new Map(
    openingRows.map(row => [row.nominalCodeId, toNumber(row.amount)])
  )

  const movementByNominalCode = new Map(
    movementRows.map(row => {
      const debit = toNumber(row.debit)
      const credit = toNumber(row.credit)

      return [row.nominalCodeId, debit - credit]
    })
  )

  const baseRollforwardRows = balanceSheetCodes.map(code => {
    const openingBalance = openingByNominalCode.get(code.id) ?? 0
    const movement = movementByNominalCode.get(code.id) ?? 0
    const closingBalance = openingBalance + movement

    return {
      ...code,
      openingBalance,
      movement,
      closingBalance
    }
  })

  const incomeExpenditureRows = incomeExpenditureCodes.map(code => ({
    ...code,
    movement: movementByNominalCode.get(code.id) ?? 0
  }))

  const nonReserveOpeningTotal = baseRollforwardRows
    .filter(row => !isReserveCode(row.code))
    .reduce((total, row) => total + row.closingBalance, 0)

  const otherReserveOpeningTotal = baseRollforwardRows
    .filter(
      row =>
        isReserveCode(row.code) &&
        row.id !== generalReserveCode?.id &&
        !isMemoOpeningReserve(row.code)
    )
    .reduce((total, row) => total + row.closingBalance, 0)

  const fixedAssetOpeningReserveCode = reserveCodes.find(code =>
    isFixedAssetOpeningReserve(code.code)
  )
  const borrowingsOpeningReserveCode = reserveCodes.find(code =>
    isBorrowingsOpeningReserve(code.code)
  )
  const fixedAssetClosingTotal = baseRollforwardRows
    .filter(row => row.agarBox === 'BOX_9_FIXED_ASSETS')
    .reduce((total, row) => total + row.closingBalance, 0)
  const borrowingsClosingTotal = baseRollforwardRows
    .filter(row => row.agarBox === 'BOX_10_BORROWINGS')
    .reduce((total, row) => total + row.closingBalance, 0)
  const fixedAssetOpeningReserve = fixedAssetOpeningReserveCode
    ? -fixedAssetClosingTotal
    : 0
  const borrowingsOpeningReserve = borrowingsOpeningReserveCode
    ? -borrowingsClosingTotal
    : 0
  const memoOpeningReserveTotal =
    fixedAssetOpeningReserve + borrowingsOpeningReserve

  const expectedGeneralReserveOpening = generalReserveCode
    ? -(
        nonReserveOpeningTotal +
        otherReserveOpeningTotal +
        memoOpeningReserveTotal
      )
    : 0

  const rollforwardRows = baseRollforwardRows.map(row => {
    let nextOpeningBalance = row.closingBalance

    if (row.id === generalReserveCode?.id) {
      nextOpeningBalance = expectedGeneralReserveOpening
    } else if (row.id === fixedAssetOpeningReserveCode?.id) {
      nextOpeningBalance = fixedAssetOpeningReserve
    } else if (row.id === borrowingsOpeningReserveCode?.id) {
      nextOpeningBalance = borrowingsOpeningReserve
    }

    return {
      ...row,
      nextOpeningBalance
    }
  })

  const currentYearSurplusDeficit = incomeExpenditureRows.reduce(
    (total, row) => total - row.movement,
    0
  )

  const nextOpeningBalanceTotal = rollforwardRows.reduce(
    (total, row) => total + row.nextOpeningBalance,
    0
  )

  const yearEndBalances = Math.abs(nextOpeningBalanceTotal) < 0.01
  const hasAnyMovement =
    rollforwardRows.some(row => Math.abs(row.movement) > 0.01) ||
    incomeExpenditureRows.some(row => Math.abs(row.movement) > 0.01)

  const canRunYearEnd =
    !financialYear.isClosed &&
    !existingYearEndRun &&
    codes.length > 0 &&
    balanceSheetCodes.length > 0 &&
    yearEndBalances &&
    hasAnyMovement

  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex flex-col gap-2'>
          <div className='flex items-center gap-2'>
            <LockKeyhole className='text-muted-foreground h-5 w-5' />
            <h1 className='text-2xl font-semibold tracking-tight'>
              Year end routine
            </h1>
          </div>
          {!hasAnyMovement && !financialYear.isClosed && (
            <Card className='border-amber-200 bg-amber-50'>
              <CardHeader className='flex flex-row items-start gap-3 space-y-0'>
                <AlertTriangle className='mt-0.5 h-5 w-5 text-amber-700' />
                <div>
                  <CardTitle className='text-base text-amber-900'>
                    No transactions found for this financial year
                  </CardTitle>
                  <CardDescription className='text-amber-800'>
                    This year has no ledger movement yet. Year end should
                    normally only be run after the financial year has activity
                    and the closing balances have been reviewed.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          )}

          <p className='text-muted-foreground max-w-3xl text-sm'>
            Review the closing balances for {financialYear.label}. Running year
            end will create the next financial year, copy the chart of accounts,
            create opening balances and close this year.
          </p>
        </div>

        <Badge variant={financialYear.isClosed ? 'secondary' : 'default'}>
          {financialYear.isClosed ? 'Closed' : 'Open'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial year</CardTitle>
          <CardDescription>
            {formatDate(financialYear.startDate)} to{' '}
            {formatDate(financialYear.endDate)}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card
        className={
          yearEndBalances
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-amber-200 bg-amber-50'
        }
      >
        <CardHeader>
          <div className='flex items-start gap-3'>
            {yearEndBalances ? (
              <CheckCircle2 className='mt-0.5 h-5 w-5 text-emerald-700' />
            ) : (
              <AlertTriangle className='mt-0.5 h-5 w-5 text-amber-700' />
            )}

            <div>
              <CardTitle
                className={
                  yearEndBalances ? 'text-emerald-900' : 'text-amber-900'
                }
              >
                {yearEndBalances
                  ? 'Ready to roll forward'
                  : 'Year end does not balance yet'}
              </CardTitle>

              <CardDescription
                className={
                  yearEndBalances ? 'text-emerald-800' : 'text-amber-800'
                }
              >
                This reconciliation derives General Reserve as the balancing
                figure required for next year&apos;s opening balance sheet to
                sum to zero.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className='grid gap-3 text-sm md:grid-cols-2'>
            <BalancingLine
              label='Non-reserve opening balance total'
              value={nonReserveOpeningTotal}
            />

            <BalancingLine
              label='Other usable reserve opening balance total'
              value={otherReserveOpeningTotal}
            />

            <BalancingLine
              label='Current-year surplus / deficit'
              value={currentYearSurplusDeficit}
            />

            <BalancingLine
              label='Derived General Reserve opening'
              value={expectedGeneralReserveOpening}
            />

            <BalancingLine
              label='Total next-year opening balances'
              value={nextOpeningBalanceTotal}
              strong
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pre-year-end checks</CardTitle>
          <CardDescription>
            These checks should pass before the year-end routine is run.
          </CardDescription>
        </CardHeader>

        <CardContent className='space-y-3 text-sm'>
          <CheckRow
            passed={!financialYear.isClosed}
            label='Financial year is open'
          />
          <CheckRow passed={codes.length > 0} label='Nominal codes exist' />
          <CheckRow
            passed={balanceSheetCodes.length > 0}
            label='Balance sheet nominal codes exist'
          />
          <CheckRow
            passed={bankCodes.length > 0}
            label='Bank nominal codes exist'
          />
          <CheckRow
            passed={reserveCodes.length > 0}
            label='Reserve nominal codes exist'
          />
          <CheckRow
            passed={yearEndBalances}
            label='Year-end balancing check passes'
          />
          <CheckRow
            passed={!existingYearEndRun}
            label='No previous year-end run exists for this year'
          />
        </CardContent>
      </Card>

      {!canRunYearEnd ? (
        <Card className='border-amber-200 bg-amber-50'>
          <CardHeader className='flex flex-row items-start gap-3 space-y-0'>
            <AlertTriangle className='mt-0.5 h-5 w-5 text-amber-700' />
            <div>
              <CardTitle className='text-base text-amber-900'>
                Year end cannot be run yet
              </CardTitle>
              <CardDescription className='text-amber-800'>
                Resolve the checks above before running the year-end routine.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Opening balances to create next year</CardTitle>
          <CardDescription>
            Balance sheet nominal codes roll forward. Income and expenditure
            codes start the next year at nil. General Reserve is derived as the
            balancing figure.
          </CardDescription>
        </CardHeader>

        <CardContent className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className='text-right'>Opening</TableHead>
                <TableHead className='text-right'>Movement</TableHead>
                <TableHead className='text-right'>Next opening</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rollforwardRows.map(row => (
                <TableRow key={row.id}>
                  <TableCell className='font-medium'>{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.category ?? '—'}</TableCell>
                  <TableCell className='text-right'>
                    {formatCurrency(row.openingBalance)}
                  </TableCell>
                  <TableCell className='text-right'>
                    {formatCurrency(row.movement)}
                  </TableCell>
                  <TableCell className='text-right font-medium'>
                    {formatCurrency(row.nextOpeningBalance)}
                  </TableCell>
                </TableRow>
              ))}

              {rollforwardRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='text-muted-foreground py-8 text-center text-sm'
                  >
                    No balance sheet nominal codes found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run year end</CardTitle>
          <CardDescription>
            This will close {financialYear.label} and create the next financial
            year with opening balances.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {query?.yearEndError ? (
            <p className='mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
              {query.yearEndError}
            </p>
          ) : null}

          <form action={runYearEndRollforward}>
            <input
              type='hidden'
              name='financialYearId'
              value={financialYear.id}
            />

            <PendingSubmitButton
              idleLabel='Run year end'
              pendingLabel='Running year end...'
              disabled={!canRunYearEnd}
              className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium shadow disabled:pointer-events-none disabled:opacity-50'
            />
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function CheckRow({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className='flex items-center gap-2'>
      {passed ? (
        <CheckCircle2 className='h-4 w-4 text-emerald-600' />
      ) : (
        <Circle className='text-muted-foreground h-4 w-4' />
      )}
      <span>{label}</span>
    </div>
  )
}

function BalancingLine({
  label,
  value,
  strong = false
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-md bg-white/60 px-3 py-2 ${
        strong ? 'font-semibold' : ''
      }`}
    >
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  )
}
