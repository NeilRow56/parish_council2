import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { BarChart3, FileText, Scale } from 'lucide-react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { db } from '@/db'
import { financialYears } from '@/db/schema/nominalLedger'
import { auth } from '@/lib/auth'
import { cn } from '@/lib/utils'

type PageProps = {
  params: Promise<{
    financialYearId: string
  }>
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

export default async function FinancialYearReportsPage({ params }: PageProps) {
  const { financialYearId } = await params

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
      startDate: financialYears.startDate,
      endDate: financialYears.endDate,
      isClosed: financialYears.isClosed
    })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.id, financialYearId),
        eq(financialYears.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!financialYear) {
    redirect('/settings/financial-years')
  }

  const reports = [
    {
      title: 'AGAR Summary',
      description:
        'Annual Governance and Accountability Return figures for this year.',
      href: `/reports/agar-summary?financialYearId=${financialYear.id}`,
      icon: FileText
    },
    {
      title: 'Trial Balance',
      description:
        'Opening balances and current-year movements split by debit and credit.',
      href: `/reports/trial-balance?financialYearId=${financialYear.id}`,
      icon: Scale
    },
    {
      title: 'Income & Expenditure',
      description:
        'Income, expenditure and surplus or deficit for this financial year.',
      href: `/reports/income-expenditure?financialYearId=${financialYear.id}`,
      icon: BarChart3
    }
  ]

  return (
    <main className='mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Reports for {financialYear.label}
          </h1>
          <p className='text-muted-foreground mt-1 text-sm'>
            {formatDate(financialYear.startDate)} to{' '}
            {formatDate(financialYear.endDate)}
          </p>
        </div>

        <Badge variant={financialYear.isClosed ? 'secondary' : 'default'}>
          {financialYear.isClosed ? 'Closed / read-only' : 'Open'}
        </Badge>
      </div>

      <div className='grid gap-4 md:grid-cols-3'>
        {reports.map(report => {
          const Icon = report.icon

          return (
            <Card key={report.href}>
              <CardHeader className='space-y-3'>
                <Icon className='text-muted-foreground h-5 w-5' />
                <div>
                  <CardTitle className='text-base'>{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Link
                  href={report.href}
                  className={cn(buttonVariants({ variant: 'outline' }))}
                >
                  Open report
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div>
        <Link
          href='/settings/financial-years'
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Back to financial years
        </Link>
      </div>
    </main>
  )
}
