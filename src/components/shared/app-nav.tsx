'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

// import { signOut } from '@/lib/auth-client'
import { SignOutButton } from './sign-out-button'
import { BrandLogo } from './brand-logo'

type NavItem = {
  href: string
  label: string
}

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
          ? 'bg-emerald-900 text-white'
          : 'text-slate-600 hover:bg-emerald-50/60 hover:text-emerald-950'
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
  items: NavItem[]
}) {
  const pathname = usePathname()

  return (
    <div className='group relative'>
      <button
        type='button'
        className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? 'bg-emerald-900 text-white'
            : 'text-slate-600 hover:bg-emerald-50/60 hover:text-emerald-950'
        }`}
      >
        {label}
        <ChevronDown className='h-4 w-4' />
      </button>

      <div className='invisible absolute top-full left-0 z-50 mt-1 min-w-56 rounded-md border border-emerald-100 bg-white p-1 opacity-0 shadow-lg shadow-emerald-950/10 transition-all group-hover:visible group-hover:opacity-100'>
        {items.map(item => {
          const itemActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                itemActive
                  ? 'bg-emerald-50 font-medium text-emerald-950'
                  : 'text-slate-600 hover:bg-emerald-50/40 hover:text-emerald-950'
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

// function getSettingsItems(financialYearId?: string | null): NavItem[] {
function getSettingsItems() {
  return [
    {
      href: '/settings/nominal-codes',
      label: 'Nominal codes'
    },
    {
      href: '/onboarding/council-details',
      label: 'Parish council details'
    },
    {
      href: '/settings/projects',
      label: 'Projects'
    },
    {
      href: '/settings/reserves',
      label: 'Reserves'
    },
    {
      href: '/settings/suppliers',
      label: 'Suppliers'
    },
    {
      href: '/settings/vat-rates',
      label: 'VAT rates'
    },
    {
      href: '/settings/financial-years',
      label: 'Financial years'
    }
  ]
}

export default function AppNav({
  canRecoverVat,
  vatStatus
}: {
  canRecoverVat: boolean
  vatStatus: 'NOT_REGISTERED' | 'REGISTERED'
}) {
  const pathname = usePathname()
  // const router = useRouter()

  // async function handleSignOut() {
  //   await signOut()
  //   router.push('/')
  // }

  const showVatNav = canRecoverVat

  const vatItems: NavItem[] =
    vatStatus === 'NOT_REGISTERED'
      ? [
          {
            href: '/vat/vat-claim-126',
            label: 'VAT 126 claim'
          }
        ]
      : [
          {
            href: '/vat/returns',
            label: 'VAT returns'
          }
        ]

  const ledgerItems: NavItem[] = [
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
  ]

  const reportItems: NavItem[] = [
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
    },
    {
      href: '/reports/large-payments',
      label: 'Payments > £100'
    },
    {
      href: '/reports/agar-summary',
      label: 'AGAR Summary'
    },
    {
      href: '/reports/budget',
      label: 'Budget'
    },
    {
      href: '/reports/asset-register',
      label: 'Fixed Asset Register'
    },
    {
      href: '/reports/borrowings',
      label: 'Borrowings'
    }
  ]

  const settingsItems = getSettingsItems()

  return (
    <header className='border-b border-emerald-100 bg-white'>
      <div className='mx-auto flex h-14 max-w-400 items-center justify-between px-6'>
        <div className='flex items-center gap-6'>
          <Link href='/dashboard' className='flex shrink-0 items-center'>
            <BrandLogo variant='icon' className='h-9 w-auto' />
          </Link>

          <nav className='flex items-center gap-1'>
            <NavLink
              href='/dashboard'
              label='Dashboard'
              active={pathname === '/dashboard'}
            />

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
              items={ledgerItems}
            />

            <NavDropdown
              label='Reports'
              active={pathname.startsWith('/reports')}
              items={reportItems}
            />

            <NavDropdown
              label='Settings'
              active={
                pathname.startsWith('/settings') ||
                pathname.startsWith('/onboarding')
              }
              items={settingsItems}
            />

            {showVatNav ? (
              <NavDropdown
                label='VAT'
                active={pathname.startsWith('/vat')}
                items={vatItems}
              />
            ) : null}
          </nav>
        </div>

        <div className='flex items-center gap-3'>
          {/* <button
            type='button'
            onClick={handleSignOut}
            className='text-sm text-slate-600 hover:text-slate-900'
          >
            Sign out
          </button> */}
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
