'use server'

import { refresh, revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { financialYears } from '@/db/schema/nominalLedger'
import { auth } from '@/lib/auth'
import { getSelectedFinancialYearCookieName } from '@/lib/financial-years/selected-year'

export async function setSelectedFinancialYearAction(financialYearId: string) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return { success: false, error: 'Unauthorised' }
  }

  const parishCouncilId = session.user.parishCouncilId

  const [financialYear] = await db
    .select({ id: financialYears.id })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.id, financialYearId),
        eq(financialYears.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!financialYear) {
    return { success: false, error: 'Financial year not found.' }
  }

  const cookieStore = await cookies()

  cookieStore.set(
    getSelectedFinancialYearCookieName(parishCouncilId),
    financialYear.id,
    {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365
    }
  )

  revalidatePath('/', 'layout')
  refresh()

  return { success: true }
}
