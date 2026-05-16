// src/app/(site)/reports/large-payments/export/route.ts

import { NextRequest } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import {
  buildLargePaymentsCsv,
  dateToInputDate,
  getCurrentFinancialYearForLargePaymentsReport,
  getLargePaymentsReport
} from '../lib'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return new Response('Unauthorised', { status: 401 })
  }

  const parishCouncilId = session.user.parishCouncilId

  const financialYearId = request.nextUrl.searchParams.get('financialYearId')

  const currentYear = await getCurrentFinancialYearForLargePaymentsReport({
    parishCouncilId,
    financialYearId: financialYearId ?? undefined
  })

  if (!currentYear) {
    return new Response('No financial year found', { status: 400 })
  }

  const fromParam = request.nextUrl.searchParams.get('from')
  const toParam = request.nextUrl.searchParams.get('to')

  const from = fromParam ?? dateToInputDate(currentYear.startDate)

  const to = toParam ?? dateToInputDate(currentYear.endDate)

  const rows = await getLargePaymentsReport({
    parishCouncilId,
    financialYearId: currentYear.id,
    from,
    to
  })

  const csv = buildLargePaymentsCsv(rows)

  const filename = `payments-over-100-${from}-to-${to}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
