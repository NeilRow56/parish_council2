import { and, eq, inArray, sql } from 'drizzle-orm'
import { AlertTriangle, Landmark } from 'lucide-react'

import { db } from '@/db'
import {
  journalEntries,
  journalLines,
  nominalCodes,
  nominalOpeningBalances
} from '@/db/schema/nominalLedger'
import { borrowings } from '@/db/schema/borrowings'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

import { auth } from '@/lib/auth'
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AddBorrowingDialogLoader } from './_components/add-borrowing-dialog-loader'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

type SearchParams = {
  financialYearId?: string
}

export default async function BorrowingsReportPage({
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

  const { financialYear } = await getSelectedFinancialYear(
    parishCouncilId,
    params?.financialYearId
  )

  if (!financialYear) {
    redirect('/onboarding/council-details')
  }

  const borrowingNominalCodes = await db
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
        eq(nominalCodes.agarBox, 'BOX_10_BORROWINGS')
      )
    )
    .orderBy(nominalCodes.code)

  const borrowingNominalCodeIds = borrowingNominalCodes.map(code => code.id)

  const loanRegister = await db
    .select({
      id: borrowings.id,
      lender: borrowings.lender,
      reference: borrowings.reference,
      purpose: borrowings.purpose,
      startDate: borrowings.startDate,
      originalAmount: borrowings.originalAmount,
      interestRate: borrowings.interestRate,
      repaymentFrequency: borrowings.repaymentFrequency,
      nominalCodeId: borrowings.nominalCodeId,
      notes: borrowings.notes,
      isActive: borrowings.isActive,
      closedDate: borrowings.closedDate,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name
    })
    .from(borrowings)
    .leftJoin(nominalCodes, eq(borrowings.nominalCodeId, nominalCodes.id))
    .where(
      and(
        eq(borrowings.parishCouncilId, parishCouncilId),
        eq(borrowings.financialYearId, financialYear.id)
      )
    )
    .orderBy(borrowings.lender)

  const openingRows =
    borrowingNominalCodeIds.length === 0
      ? []
      : await db
          .select({
            nominalCodeId: nominalOpeningBalances.nominalCodeId,
            amount: nominalOpeningBalances.amount
          })
          .from(nominalOpeningBalances)
          .where(
            and(
              eq(nominalOpeningBalances.parishCouncilId, parishCouncilId),
              eq(nominalOpeningBalances.financialYearId, financialYear.id),
              inArray(
                nominalOpeningBalances.nominalCodeId,
                borrowingNominalCodeIds
              )
            )
          )

  const movementRows =
    borrowingNominalCodeIds.length === 0
      ? []
      : await db
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
              eq(journalEntries.financialYearId, financialYear.id),
              inArray(journalLines.nominalCodeId, borrowingNominalCodeIds)
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

      return [row.nominalCodeId, credit - debit]
    })
  )

  const borrowingSummaryRows = borrowingNominalCodes.map(code => {
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

  const openingBorrowings = borrowingSummaryRows.reduce(
    (total, row) => total + row.openingBalance,
    0
  )

  const borrowingMovements = borrowingSummaryRows.reduce(
    (total, row) => total + row.movement,
    0
  )

  const closingBorrowings = openingBorrowings + borrowingMovements

  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex flex-col gap-2'>
          <div className='flex items-center gap-2'>
            <Landmark className='text-muted-foreground h-5 w-5' />
            <h1 className='text-2xl font-semibold tracking-tight'>
              Borrowings
            </h1>
          </div>

          <p className='text-muted-foreground max-w-3xl text-sm'>
            Loan balances are driven from nominal opening balances and
            current-year postings to nominal codes mapped to AGAR Box 10.
          </p>
          <p className='text-muted-foreground text-sm'>
            Financial year: {financialYear.label}
            {financialYear.isClosed ? ' (closed / read-only)' : ''}
          </p>
        </div>

        {!financialYear.isClosed ? (
          <div className='shrink-0'>
            <AddBorrowingDialogLoader
              financialYearId={financialYear.id}
              nominalCodes={borrowingNominalCodes}
            />
          </div>
        ) : null}
      </div>

      {borrowingNominalCodes.length === 0 ? (
        <Card className='border-amber-200 bg-amber-50'>
          <CardHeader className='flex flex-row items-start gap-3 space-y-0'>
            <AlertTriangle className='mt-0.5 h-5 w-5 text-amber-700' />
            <div>
              <CardTitle className='text-base text-amber-900'>
                No borrowings nominal code found
              </CardTitle>
              <CardDescription className='text-amber-800'>
                Add a balance sheet nominal code mapped to BOX_10_BORROWINGS,
                for example 2300 Borrowings / Loans Outstanding.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      <div className='grid gap-4 md:grid-cols-3'>
        {loanRegister.length > 0 && closingBorrowings === 0 ? (
          <Card className='border-amber-200 bg-amber-50'>
            <CardHeader className='flex flex-row items-start gap-3 space-y-0'>
              <AlertTriangle className='mt-0.5 h-5 w-5 text-amber-700' />
              <div>
                <CardTitle className='text-base text-amber-900'>
                  Loan register does not affect AGAR until posted
                </CardTitle>
                <CardDescription className='text-amber-800'>
                  The loan details have been added to the register, but no
                  borrowing movement has been posted to the ledger yet. To
                  include a new loan in AGAR Box 10, post the loan receipt to
                  the bank and credit nominal code 2300 Borrowings / Loans
                  Outstanding.
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle className='text-sm font-medium'>
              Opening borrowings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-semibold'>
              {formatCurrency(openingBorrowings)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-sm font-medium'>
              Current-year movement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-semibold'>
              {formatCurrency(borrowingMovements)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-sm font-medium'>
              Closing borrowings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-semibold'>
              {formatCurrency(closingBorrowings)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AGAR Box 10 reconciliation</CardTitle>
          <CardDescription>
            This table reconciles opening loan balances to the current closing
            balance using nominal codes mapped to Box 10.
          </CardDescription>
        </CardHeader>

        <CardContent className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className='text-right'>Opening</TableHead>
                <TableHead className='text-right'>Movement</TableHead>
                <TableHead className='text-right'>Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {borrowingSummaryRows.map(row => (
                <TableRow key={row.id}>
                  <TableCell className='font-medium'>{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className='text-right'>
                    {formatCurrency(row.openingBalance)}
                  </TableCell>
                  <TableCell className='text-right'>
                    {formatCurrency(row.movement)}
                  </TableCell>
                  <TableCell className='text-right font-medium'>
                    {formatCurrency(row.closingBalance)}
                  </TableCell>
                </TableRow>
              ))}

              {borrowingSummaryRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-muted-foreground py-8 text-center text-sm'
                  >
                    No Box 10 nominal codes found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loan register</CardTitle>
          <CardDescription>
            Descriptive register of active and historic borrowings.
          </CardDescription>
        </CardHeader>

        <CardContent className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lender</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Nominal code</TableHead>
                <TableHead className='text-right'>Original amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loanRegister.map(loan => (
                <TableRow key={loan.id}>
                  <TableCell className='font-medium'>{loan.lender}</TableCell>
                  <TableCell>{loan.reference || '—'}</TableCell>
                  <TableCell>{loan.purpose || '—'}</TableCell>
                  <TableCell>
                    {loan.nominalCode
                      ? `${loan.nominalCode} ${loan.nominalName ?? ''}`
                      : '—'}
                  </TableCell>
                  <TableCell className='text-right'>
                    {formatCurrency(toNumber(loan.originalAmount))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={loan.isActive ? 'default' : 'secondary'}>
                      {loan.isActive ? 'Active' : 'Closed'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}

              {loanRegister.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='text-muted-foreground py-8 text-center text-sm'
                  >
                    No borrowings have been added yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
