import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import AppNav from '@/components/shared/app-nav'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { parishCouncils } from '@/db/schema'
import { eq } from 'drizzle-orm'

export default async function SiteLayout({
  children
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId

  const [council] = await db
    .select({
      canRecoverVat: parishCouncils.canRecoverVat,
      vatStatus: parishCouncils.vatStatus
    })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  return (
    <div className='h-screen flex-1'>
      <AppNav
        canRecoverVat={council?.canRecoverVat ?? false}
        vatStatus={
          (council?.vatStatus ?? 'NOT_REGISTERED') as
            | 'NOT_REGISTERED'
            | 'REGISTERED'
        }
      />
      {children}
    </div>
  )
}
