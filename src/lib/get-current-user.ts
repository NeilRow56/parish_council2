import { headers } from 'next/headers'
import { auth } from './auth'

export async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  const sessionUserId = session?.user?.id

  if (!sessionUserId) return null

  const currentUser = session.user

  return currentUser
}
