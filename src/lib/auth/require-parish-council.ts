// src/lib/auth/require-parish-council.ts
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth'

export async function requireParishCouncil() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login?next=/vat/returns')
  }

  return {
    userId: session.user.id,
    parishCouncilId: session.user.parishCouncilId
  }
}
