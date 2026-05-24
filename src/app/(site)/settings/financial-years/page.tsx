import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { CalendarDays } from 'lucide-react'
import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { financialYears, yearEndRuns } from '@/db/schema/nominalLedger'
import { auth } from '@/lib/auth'
import { seedDefaultChart } from '@/lib/nominal-codes/seedDefaultChart'
import { getSelectedFinancialYearCookieName } from '@/lib/financial-years/selected-year'
import { getParishFinancialYearFromStartYear } from '@/lib/financial-years/parish-year'

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
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

function formatDate(value: string | Date | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

async function addFinancialYearAction(formData: FormData) {
  'use server'

  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login')
  }

  const rawStartYear = String(formData.get('startYear') ?? '').trim()
  const startYear = Number(rawStartYear)

  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) {
    redirect(
      '/settings/financial-years?financialYearError=Enter+a+valid+start+year.'
    )
  }

  const financialYear = await seedDefaultChart({
    parishCouncilId: session.user.parishCouncilId,
    financialYearStartYear: startYear
  })

  const cookieStore = await cookies()
  cookieStore.set(
    getSelectedFinancialYearCookieName(session.user.parishCouncilId),
    financialYear.id,
    {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365
    }
  )

  revalidatePath('/', 'layout')
  revalidatePath('/settings/financial-years')
  redirect('/settings/financial-years?financialYearCreated=1')
}

type FinancialYearsPageProps = {
  searchParams?: Promise<{
    financialYearCreated?: string
    financialYearError?: string
  }>
}

export default async function FinancialYearsPage({
  searchParams
}: FinancialYearsPageProps) {
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

  const years = await db
    .select({
      id: financialYears.id,
      label: financialYears.label,
      startDate: financialYears.startDate,
      endDate: financialYears.endDate,
      isClosed: financialYears.isClosed,
      closedAt: financialYears.closedAt
    })
    .from(financialYears)
    .where(eq(financialYears.parishCouncilId, parishCouncilId))
    .orderBy(desc(financialYears.startDate))

  const runs = await db
    .select({
      fromFinancialYearId: yearEndRuns.fromFinancialYearId,
      toFinancialYearId: yearEndRuns.toFinancialYearId,
      status: yearEndRuns.status,
      completedAt: yearEndRuns.completedAt
    })
    .from(yearEndRuns)
    .where(eq(yearEndRuns.parishCouncilId, parishCouncilId))

  const yearEndRunByFromYearId = new Map(
    runs.map(run => [run.fromFinancialYearId, run])
  )
  const earliestStartYear =
    years.length > 0
      ? Math.min(...years.map(year => Number(year.startDate.slice(0, 4))))
      : new Date().getFullYear()
  const suggestedStartYear = earliestStartYear - 1
  const suggestedYear = getParishFinancialYearFromStartYear(suggestedStartYear)

  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6'>
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-2'>
          <CalendarDays className='text-muted-foreground h-5 w-5' />
          <h1 className='text-2xl font-semibold tracking-tight'>
            Financial years
          </h1>
        </div>

        <p className='text-muted-foreground max-w-3xl text-sm'>
          View accounting periods, access prior-year reports in read-only mode
          and run the year-end routine for open years.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add financial year</CardTitle>
          <CardDescription>
            Create an earlier or additional open year and seed the default chart
            of accounts for that period.
          </CardDescription>
        </CardHeader>

        <CardContent className='space-y-4'>
          {params?.financialYearCreated === '1' ? (
            <div className='rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700'>
              Financial year created and selected.
            </div>
          ) : null}

          {params?.financialYearError ? (
            <div className='rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
              {params.financialYearError}
            </div>
          ) : null}

          <form
            action={addFinancialYearAction}
            className='flex flex-col gap-3 sm:flex-row sm:items-end'
          >
            <div className='grid gap-2'>
              <label
                htmlFor='startYear'
                className='text-sm font-medium text-slate-700'
              >
                Start year
              </label>
              <input
                id='startYear'
                name='startYear'
                type='number'
                min={2000}
                max={2100}
                required
                defaultValue={suggestedStartYear}
                className='h-9 w-36 rounded-md border px-3 text-sm shadow-sm'
              />
              <p className='text-muted-foreground text-xs'>
                For example, {suggestedStartYear} creates{' '}
                {suggestedYear.label}.
              </p>
            </div>

            <button
              type='submit'
              className={cn(buttonVariants({ size: 'sm' }), 'h-9')}
            >
              Add financial year
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounting periods</CardTitle>
          <CardDescription>
            Closed years remain available for review, reporting and audit trail
            purposes.
          </CardDescription>
        </CardHeader>

        <CardContent className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Financial year</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Year end</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {years.map(year => {
                const run = yearEndRunByFromYearId.get(year.id)

                return (
                  <TableRow key={year.id}>
                    <TableCell className='font-medium'>{year.label}</TableCell>

                    <TableCell>
                      {formatDate(year.startDate)} to {formatDate(year.endDate)}
                    </TableCell>

                    <TableCell>
                      <Badge variant={year.isClosed ? 'secondary' : 'default'}>
                        {year.isClosed ? 'Closed' : 'Open'}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {run ? (
                        <div className='flex flex-col gap-1'>
                          <Badge variant='secondary'>{run.status}</Badge>
                          {run.completedAt ? (
                            <span className='text-muted-foreground text-xs'>
                              Completed {formatDate(run.completedAt)}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className='text-muted-foreground text-sm'>
                          Not run
                        </span>
                      )}
                    </TableCell>

                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Link
                          href={`/settings/financial-years/${year.id}/reports`}
                          className={cn(
                            buttonVariants({ variant: 'outline', size: 'sm' })
                          )}
                        >
                          View reports
                        </Link>

                        {!year.isClosed ? (
                          <Link
                            href={`/settings/financial-years/${year.id}/year-end`}
                            className={cn(
                              buttonVariants({ variant: 'outline', size: 'sm' })
                            )}
                          >
                            Year end
                          </Link>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}

              {years.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-muted-foreground py-8 text-center text-sm'
                  >
                    No financial years have been created yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className='border-emerald-100 bg-emerald-50/30'>
        <CardHeader>
          <CardTitle className='text-base'>Read-only prior years</CardTitle>
          <CardDescription>
            Prior financial years should remain visible for review and
            reporting. Editing and posting should be blocked by server actions
            once a year has been closed.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
