import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { CalendarDays } from 'lucide-react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { financialYears, yearEndRuns } from '@/db/schema/nominalLedger'
import { auth } from '@/lib/auth'

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

export default async function FinancialYearsPage() {
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

      <Card className='border-slate-200 bg-slate-50'>
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
