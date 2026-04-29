import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

import { eq, and, lte, gte, asc } from 'drizzle-orm'
import { db } from '@/db'
import { financialYears, nominalCodes } from '@/db/schema/nominalLedger'

// GET /api/nominal-codes
// Returns all active nominal codes for the current parish council's open year.

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const parishCouncilId = session.user.parishCouncilId

  if (!parishCouncilId) {
    return NextResponse.json(
      { error: 'User is not linked to a parish council' },
      { status: 403 }
    )
  }

  const today = new Date().toISOString().split('T')[0]

  const [currentYear] = await db
    .select()
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        lte(financialYears.startDate, today),
        gte(financialYears.endDate, today),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1)

  if (!currentYear) {
    return NextResponse.json(
      { error: 'No open financial year found' },
      { status: 404 }
    )
  }

  const codes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      type: nominalCodes.type,
      category: nominalCodes.category,
      isBank: nominalCodes.isBank
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, currentYear.id),
        eq(nominalCodes.isActive, true),
        eq(nominalCodes.isBank, false)
      )
    )
    .orderBy(asc(nominalCodes.code))

  const grouped = codes.reduce<Record<string, Record<string, typeof codes>>>(
    (acc, code) => {
      const type = code.type
      const category = code.category ?? 'General'

      if (!acc[type]) acc[type] = {}
      if (!acc[type][category]) acc[type][category] = []

      acc[type][category].push(code)

      return acc
    },
    {}
  )

  return NextResponse.json({
    financialYear: {
      id: currentYear.id,
      label: currentYear.label
    },
    codes,
    grouped
  })
}
