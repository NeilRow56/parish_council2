'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

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

function NavDropdown({
  label,
  active,
  items
}: {
  label: string
  active: boolean
  items: Array<{
    href: string
    label: string
  }>
}) {
  const pathname = usePathname()

  return (
    <div className='group relative'>
      <button
        type='button'
        className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? 'bg-slate-900 text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        {label}
        <ChevronDown className='h-4 w-4' />
      </button>

      <div className='invisible absolute top-full left-0 z-50 mt-1 min-w-56 rounded-md border bg-white p-1 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100'>
        {items.map(item => {
          const itemActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                itemActive
                  ? 'bg-slate-100 font-medium text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
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
        <div className='flex items-center gap-6'>
          <Link href='/' className='font-semibold text-slate-900'>
            WpAccPac
          </Link>

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

            <NavDropdown
              label='Ledger'
              active={pathname.startsWith('/ledger')}
              items={[
                {
                  href: '/ledger',
                  label: 'Ledger'
                },
                {
                  href: '/ledger/bank-entry/new',
                  label: 'New payment or receipt'
                },
                {
                  href: '/ledger/journals/new',
                  label: 'New manual journal'
                }
              ]}
            />

            <NavDropdown
              label='Reports'
              active={pathname.startsWith('/reports')}
              items={[
                {
                  href: '/reports/trial-balance',
                  label: 'Trial Balance'
                },
                {
                  href: '/reports/income-expenditure',
                  label: 'Income & Expenditure'
                },
                {
                  href: '/reports/bank-reconciliation',
                  label: 'Bank Reconciliation'
                }
              ]}
            />
            <NavDropdown
              label='Settings'
              active={pathname.startsWith('/settings')}
              items={[
                {
                  href: '/settings/nominal-codes',
                  label: 'Nominal codes'
                },
                {
                  href: '/onboarding/council-details',
                  label: 'Parish council details'
                }
                // {
                //   href: '/settings/bank-reconciliation',
                //   label: 'Bank Reconciliation'
                // }
              ]}
            />
          </nav>
        </div>

        <div className='flex items-center gap-3'>
          <button
            type='button'
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
