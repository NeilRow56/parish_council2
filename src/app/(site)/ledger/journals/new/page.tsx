import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, desc, eq } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/db'
import { financialYears, nominalCodes } from '@/db/schema/nominalLedger'
import { ManualJournalForm } from './_components/manual-journal-form'

export default async function NewManualJournalPage() {
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
    .select()
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.isClosed, false)
      )
    )
    .orderBy(desc(financialYears.startDate))
    .limit(1)

  if (!financialYear) {
    redirect('/ledger')
  }

  const codes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      category: nominalCodes.category,
      type: nominalCodes.type
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

  return (
    <main className='mx-auto max-w-5xl px-6 py-8'>
      <div className='mb-8'>
        <h1 className='text-2xl font-semibold tracking-tight'>
          New manual journal
        </h1>
        <p className='mt-1 text-sm text-zinc-600'>
          Enter a balanced journal for corrections, adjustments, or transfers.
        </p>
        <p className='mt-2 text-sm text-zinc-500'>
          Financial year:{' '}
          <span className='font-medium text-zinc-700'>
            {financialYear.label}
          </span>
        </p>
      </div>

      <ManualJournalForm
        nominalCodes={codes}
        financialYearId={financialYear.id}
      />
    </main>
  )
}
