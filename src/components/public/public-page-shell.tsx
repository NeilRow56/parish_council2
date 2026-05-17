import Link from 'next/link'
import type { ReactNode } from 'react'

const footerLinks = [
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/gdpr', label: 'GDPR' },
  { href: '/legal/security', label: 'Security' },
  { href: '/auth/login', label: 'Sign in' }
]

export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <main className='min-h-screen bg-[linear-gradient(180deg,#f5fbf7_0%,#ffffff_42%,#f8fbf9_100%)] text-slate-950'>
      <header className='border-b border-emerald-100 bg-white/90 backdrop-blur'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-4'>
          <Link href='/' className='text-lg font-semibold tracking-tight'>
            WpAccPac
          </Link>

          <nav className='flex items-center gap-3 text-sm'>
            <Link
              href='/legal/privacy'
              className='hidden text-slate-600 hover:text-emerald-900 sm:inline'
            >
              Privacy
            </Link>

            <Link
              href='/auth/login'
              className='rounded-md border border-emerald-200 px-3 py-2 font-medium text-slate-900 hover:bg-emerald-50'
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className='border-t border-emerald-100 bg-white/80'>
        <div className='mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between'>
          <p>WpAccPac for UK parish and town council finance teams.</p>

          <div className='flex flex-wrap gap-4'>
            {footerLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className='hover:text-emerald-900'
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </main>
  )
}

export function LegalArticle({ children }: { children: ReactNode }) {
  return (
    <PublicPageShell>
      <section className='border-b border-emerald-100 bg-emerald-50/70'>
        <div className='mx-auto max-w-4xl px-6 py-12'>
          <p className='text-sm font-medium text-emerald-800'>
            WpAccPac legal information
          </p>
          <p className='mt-3 max-w-2xl text-sm leading-6 text-slate-700'>
            Practical information about privacy, data protection, security, and
            council data ownership.
          </p>
        </div>
      </section>

      <section className='mx-auto max-w-4xl px-6 py-10'>
        <article className='legal-content rounded-lg border border-emerald-100 bg-white p-6 shadow-sm sm:p-8'>
          {children}
        </article>
      </section>
    </PublicPageShell>
  )
}
