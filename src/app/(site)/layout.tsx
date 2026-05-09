// src/app/(site)/layout.tsx

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import AppNav from '@/components/shared/app-nav'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { parishCouncils } from '@/db/schema'

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
      name: parishCouncils.name,
      canRecoverVat: parishCouncils.canRecoverVat,
      vatStatus: parishCouncils.vatStatus
    })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  if (!council) {
    redirect('/auth/register')
  }

  return (
    <div className='min-h-screen bg-white'>
      <AppNav
        canRecoverVat={council.canRecoverVat ?? false}
        vatStatus={
          (council.vatStatus ?? 'NOT_REGISTERED') as
            | 'NOT_REGISTERED'
            | 'REGISTERED'
        }
      />

      <div className='border-b bg-zinc-50'>
        <div className='mx-auto max-w-7xl px-6 py-3'>
          <p className='text-lg font-medium text-zinc-900'>{council.name}</p>
        </div>
      </div>

      {children}
    </div>
  )
}
