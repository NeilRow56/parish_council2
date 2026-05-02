// src/app/auth/actions.ts

'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { parishCouncils, user } from '@/db/schema/authSchema'
import { getCurrentUser } from '@/lib/get-current-user'
import { councilOnboardingSchema } from '@/lib/validation/council-onboarding'

type VatStatus = 'NOT_REGISTERED' | 'REGISTERED'

function normaliseVatClaimMethod(vatStatus: VatStatus) {
  return vatStatus === 'REGISTERED' ? 'VAT_RETURN' : 'VAT126'
}

function requireCouncilUser(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) throw new Error('Not authenticated.')

  if (!user.parishCouncilId) {
    throw new Error('User is not linked to a parish council.')
  }

  return user as typeof user & { parishCouncilId: string }
}

export async function registerAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()

  const password = String(formData.get('password') ?? '')

  const parishCouncilName = String(
    formData.get('parishCouncilName') ?? ''
  ).trim()

  if (!name || !email || !password || !parishCouncilName) {
    throw new Error('All fields are required.')
  }

  if (password.length < 10) {
    throw new Error('Password must be at least 10 characters.')
  }

  await auth.api.signUpEmail({
    body: {
      name,
      email,
      password
    }
  })

  const [createdUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  if (!createdUser) {
    throw new Error('User was created but could not be found.')
  }

  const parishCouncilId = createId()

  await db.insert(parishCouncils).values({
    id: parishCouncilId,
    name: parishCouncilName,
    canRecoverVat: true,
    vatStatus: 'NOT_REGISTERED',
    vatRegistrationNumber: null,
    vatClaimFrequency: 'ANNUAL',
    vatClaimMethod: 'VAT126'
  })

  await db
    .update(user)
    .set({
      parishCouncilId,
      role: 'CLERK',
      updatedAt: new Date()
    })
    .where(eq(user.id, createdUser.id))

  redirect('/auth/login?registered=1')
}

export async function completeCouncilOnboardingAction(formData: FormData) {
  const currentUser = requireCouncilUser(await getCurrentUser())

  const [existingCouncil] = await db
    .select({
      onboardingCompletedAt: parishCouncils.onboardingCompletedAt
    })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, currentUser.parishCouncilId))
    .limit(1)

  if (!existingCouncil) {
    throw new Error('Parish council not found.')
  }

  const isFirstSetup = !existingCouncil.onboardingCompletedAt

  const parsed = councilOnboardingSchema.safeParse({
    name: formData.get('name'),
    addressLine1: formData.get('addressLine1'),
    addressLine2: formData.get('addressLine2'),
    town: formData.get('town'),
    county: formData.get('county'),
    postcode: formData.get('postcode'),
    telephone: formData.get('telephone'),
    email: formData.get('email'),
    website: formData.get('website'),
    canRecoverVat: formData.get('canRecoverVat') ?? 'off',
    vatStatus: formData.get('vatStatus') ?? 'NOT_REGISTERED',
    vatRegistrationNumber: formData.get('vatRegistrationNumber'),
    vatClaimFrequency: formData.get('vatClaimFrequency') ?? 'ANNUAL'
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid form data.')
  }

  const data = parsed.data

  const canRecoverVat = data.canRecoverVat === 'on'

  const finalVatStatus: VatStatus = canRecoverVat
    ? data.vatStatus
    : 'NOT_REGISTERED'

  await db
    .update(parishCouncils)
    .set({
      name: data.name,

      addressLine1: data.addressLine1 ?? null,
      addressLine2: data.addressLine2 ?? null,
      town: data.town ?? null,
      county: data.county ?? null,
      postcode: data.postcode ?? null,
      telephone: data.telephone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,

      canRecoverVat,
      vatStatus: finalVatStatus,
      vatRegistrationNumber:
        canRecoverVat && finalVatStatus === 'REGISTERED'
          ? (data.vatRegistrationNumber ?? null)
          : null,
      vatClaimFrequency: data.vatClaimFrequency,
      vatClaimMethod: normaliseVatClaimMethod(finalVatStatus),

      onboardingCompletedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(parishCouncils.id, currentUser.parishCouncilId))
  if (isFirstSetup) {
    redirect('/transactions/inbox')
  }

  redirect('/onboarding/council-details?saved=1')
}
