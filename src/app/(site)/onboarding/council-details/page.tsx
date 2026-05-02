// src/app/onboarding/council-details/page.tsx

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { parishCouncils } from '@/db/schema/authSchema'
import { getCurrentUser } from '@/lib/get-current-user'
import { completeCouncilOnboardingAction } from '@/app/auth/actions'
import { CouncilOnboardingForm } from './_components/council-onboarding-form'
import { redirect } from 'next/navigation'

type CouncilDetailsPageProps = {
  searchParams?: Promise<{
    saved?: string
  }>
}

export default async function CouncilDetailsPage({
  searchParams
}: CouncilDetailsPageProps) {
  const params = await searchParams
  const saved = params?.saved === '1'

  const currentUser = await getCurrentUser()

  if (!currentUser) {
    redirect('/auth/login?next=/onboarding/council-details')
  }

  if (!currentUser.parishCouncilId) {
    redirect('/auth/login?error=missing-council')
  }

  const [council] = await db
    .select()
    .from(parishCouncils)
    .where(eq(parishCouncils.id, currentUser.parishCouncilId))
    .limit(1)

  if (!council) {
    throw new Error('Parish council not found.')
  }

  const isOnboarding = !council.onboardingCompletedAt

  return (
    <main className='min-h-screen bg-zinc-50 px-6 py-10'>
      <div className='mx-auto max-w-3xl'>
        <CouncilOnboardingForm
          action={completeCouncilOnboardingAction}
          initialValues={council}
          submitLabel={isOnboarding ? 'Complete setup' : 'Save changes'}
          isOnboarding={isOnboarding}
          saved={saved}
        />
      </div>
    </main>
  )
}
