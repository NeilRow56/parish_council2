import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { parishCouncils } from '@/db/schema'
import { auth } from '@/lib/auth'

export default async function SiteTemplate({
  children
}: {
  children: React.ReactNode
}) {
  const requestHeaders = await headers()
  const pathname = requestHeaders.get('x-pathname')

  if (pathname?.startsWith('/onboarding/council-details')) {
    return children
  }

  const session = await auth.api.getSession({
    headers: requestHeaders
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login')
  }

  const [council] = await db
    .select({
      addressLine1: parishCouncils.addressLine1
    })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, session.user.parishCouncilId))
    .limit(1)

  if (!council) {
    redirect('/auth/register')
  }

  if (!council.addressLine1?.trim()) {
    redirect('/onboarding/council-details?notice=complete-settings')
  }

  return children
}
