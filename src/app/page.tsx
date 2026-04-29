import Link from 'next/link'
import { headers } from 'next/headers'

import { auth } from '@/lib/auth'
import { SignOutButton } from '@/components/shared/sign-out-button'

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  const isSignedIn = Boolean(session?.user)

  return (
    <main className='min-h-screen bg-slate-50 p-8'>
      <div className='mx-auto max-w-3xl space-y-6 rounded-xl border bg-white p-8 shadow-sm'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-900'>
            WpAccPac Parish Banking
          </h1>
          <p className='mt-2 text-sm text-slate-600'>
            Bank feeds, transaction coding and parish council ledger tools.
          </p>
        </div>

        <div className='rounded-lg border p-4'>
          <p className='text-sm text-slate-500'>Status</p>

          {isSignedIn ? (
            <p className='mt-1 font-medium text-green-700'>
              Signed in as {session?.user.email}
            </p>
          ) : (
            <p className='mt-1 font-medium text-amber-700'>Not signed in</p>
          )}
        </div>

        <div className='flex flex-wrap gap-3'>
          {isSignedIn ? (
            <>
              <Link
                href='/bank-connections'
                className='rounded border px-4 py-2 text-sm hover:bg-slate-50'
              >
                Bank connections
              </Link>

              <Link
                href='/transactions/inbox'
                className='rounded border px-4 py-2 text-sm hover:bg-slate-50'
              >
                Transaction inbox
              </Link>

              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href='/auth/login'
                className='rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700'
              >
                Sign in
              </Link>

              <Link
                href='/auth/register'
                className='rounded border px-4 py-2 text-sm hover:bg-slate-50'
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
