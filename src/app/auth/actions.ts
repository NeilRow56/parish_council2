// src/app/auth/actions.ts

'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { parishCouncils, user } from '@/db/schema/authSchema'

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
    name: parishCouncilName
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
