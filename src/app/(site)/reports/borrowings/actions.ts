'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { borrowings } from '@/db/schema/borrowings'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function createBorrowing(formData: FormData) {
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

  const financialYearId = String(formData.get('financialYearId'))
  const lender = String(formData.get('lender') || '').trim()

  if (!lender) {
    throw new Error('Lender is required')
  }

  await db.insert(borrowings).values({
    parishCouncilId,
    financialYearId,
    lender,
    reference: String(formData.get('reference') || '').trim() || null,
    purpose: String(formData.get('purpose') || '').trim() || null,
    startDate: String(formData.get('startDate') || '') || null,
    originalAmount: String(formData.get('originalAmount') || '0'),
    openingBalance: '0',
    interestRate: String(formData.get('interestRate') || '') || null,
    repaymentFrequency:
      String(formData.get('repaymentFrequency') || '').trim() || null,
    nominalCodeId: String(formData.get('nominalCodeId') || '') || null,
    notes: String(formData.get('notes') || '').trim() || null,
    isActive: true
  })

  revalidatePath('/reports/borrowings')
}
