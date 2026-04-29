'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { signOut } from '@/lib/auth-client'

function NavLink({
  href,
  label,
  active
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {label}
    </Link>
  )
}

export default function AppNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push('/')
  }

  return (
    <header className='border-b bg-white'>
      <div className='mx-auto flex h-14 max-w-7xl items-center justify-between px-6'>
        {/* Left: Logo */}
        <div className='flex items-center gap-6'>
          <Link href='/' className='font-semibold text-slate-900'>
            WpAccPac
          </Link>

          {/* Main nav */}
          <nav className='flex items-center gap-1'>
            <NavLink href='/' label='Home' active={pathname === '/'} />

            <NavLink
              href='/bank-connections'
              label='Banking'
              active={pathname.startsWith('/bank')}
            />

            <NavLink
              href='/transactions/inbox'
              label='Inbox'
              active={pathname.startsWith('/transactions')}
            />

            <NavLink
              href='/ledger'
              label='Ledger'
              active={pathname.startsWith('/ledger')}
            />
          </nav>
        </div>

        {/* Right: Actions */}
        <div className='flex items-center gap-3'>
          <button
            onClick={handleSignOut}
            className='text-sm text-slate-600 hover:text-slate-900'
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
