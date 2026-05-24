// src/app/(site)/layout.tsx

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import AppNav from '@/components/shared/app-nav'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { parishCouncils } from '@/db/schema'
import { FinancialYearSelector } from '@/components/shared/financial-year-selector'
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'

export default async function SiteLayout({
  children
}: {
  children: React.ReactNode
}) {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId

  const [council] = await db
    .select({
      name: parishCouncils.name,
      canRecoverVat: parishCouncils.canRecoverVat,
      vatStatus: parishCouncils.vatStatus
    })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  if (!council) {
    redirect('/auth/register')
  }

  const financialYearSelection =
    await getSelectedFinancialYear(parishCouncilId)

  return (
    <div className='min-h-screen bg-background'>
      <AppNav
        canRecoverVat={council.canRecoverVat ?? false}
        vatStatus={
          (council.vatStatus ?? 'NOT_REGISTERED') as
            | 'NOT_REGISTERED'
            | 'REGISTERED'
        }
      />

      <div className='border-b border-emerald-100 bg-emerald-50/30'>
        <div className='mx-auto flex max-w-400 flex-wrap items-center justify-between gap-3 px-6 py-3'>
          <p className='text-lg font-medium text-slate-950'>{council.name}</p>
          <FinancialYearSelector
            years={financialYearSelection.years.map(year => ({
              id: year.id,
              label: year.label,
              isClosed: year.isClosed
            }))}
            selectedFinancialYearId={
              financialYearSelection.financialYear?.id ?? null
            }
          />
        </div>
      </div>

      {children}
    </div>
  )
}
