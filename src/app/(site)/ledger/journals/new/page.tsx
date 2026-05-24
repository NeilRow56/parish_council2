import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/db'
import { nominalCodes } from '@/db/schema/nominalLedger'
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'
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

  const { financialYear } = await getSelectedFinancialYear(parishCouncilId)

  if (!financialYear) {
    redirect('/ledger')
  }

  if (financialYear.isClosed) {
    return (
      <main className='mx-auto max-w-5xl px-6 py-8'>
        <div className='rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900'>
          <p className='font-medium'>
            Financial year {financialYear.label} is closed.
          </p>
          <p className='mt-1'>
            Manual journals cannot be posted to a closed financial year. Select
            an open year from the header before creating a journal.
          </p>
        </div>
      </main>
    )
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
        financialYear={{
          label: financialYear.label,
          startDate: financialYear.startDate,
          endDate: financialYear.endDate
        }}
      />
    </main>
  )
}
