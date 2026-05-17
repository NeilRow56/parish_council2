import Link from 'next/link'

const features = [
  {
    title: 'Bookkeeping built around council workflows',
    description:
      'Code receipts and payments, keep nominal ledgers tidy, and preserve a clear audit trail for every posted entry.'
  },
  {
    title: 'Bank feed review before posting',
    description:
      'Import transactions into an inbox, review and code them, then post only once they are ready for the ledger.'
  },
  {
    title: 'Reports for year-end confidence',
    description:
      'Prepare trial balance, income and expenditure, bank reconciliation, VAT, assets, borrowings, and AGAR summaries from the same records.'
  }
]

const reportItems = [
  'AGAR summary from nominal code mappings',
  'Bank reconciliation and cashbook checks',
  'VAT 126 claims or VAT return support',
  'Budget, reserves, projects, suppliers, and audit schedules'
]

const pricingItems = [
  'Bank-fed bookkeeping',
  'Nominal ledger and journals',
  'VAT Return or VAT 126 support',
  'Bank reconciliation',
  'Budget and reports',
  'AGAR-ready year-end reports',
  'PDF exports'
]

const previewRows = [
  {
    label: 'Bank reconciliation',
    detail: 'Cashbook and bank review',
    status: 'Reviewed'
  },
  {
    label: 'VAT',
    detail: 'Return or VAT 126 support',
    status: 'Ready'
  },
  {
    label: 'Fixed assets',
    detail: 'AGAR Box 9 schedule',
    status: 'Ready'
  },
  {
    label: 'Borrowings',
    detail: 'AGAR Box 10 check',
    status: 'Reviewed'
  },
  {
    label: 'PDF exports',
    detail: 'Client-ready report pack',
    status: 'Exportable'
  }
]

export default function HomePage() {
  return (
    <main className='min-h-screen bg-white text-slate-950'>
      <header className='border-b border-emerald-100 bg-white/95 backdrop-blur'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-4'>
          <Link href='/' className='text-lg font-semibold tracking-tight'>
            WpAccPac
          </Link>

          <nav className='flex items-center gap-3 text-sm'>
            <Link
              href='#pricing'
              className='hidden text-slate-600 hover:text-emerald-900 sm:inline'
            >
              Pricing
            </Link>

            <Link
              href='/legal/privacy'
              className='hidden text-slate-600 hover:text-emerald-900 sm:inline'
            >
              Privacy
            </Link>

            <Link
              href='/auth/login'
              className='rounded-md border border-emerald-200 px-3 py-2 font-medium hover:bg-emerald-50'
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className='relative overflow-hidden border-b border-emerald-100 bg-[linear-gradient(135deg,#f4fbf6_0%,#ffffff_46%,#eaf6ee_100%)]'>
        <div className='absolute inset-x-6 top-8 mx-auto h-52 max-w-6xl rounded-full bg-emerald-100/55 blur-3xl' />

        <div className='relative mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20'>
          <div className='max-w-3xl'>
            <p className='text-sm font-medium text-emerald-800'>
              Bookkeeping and AGAR preparation for parish and town councils
            </p>

            <h1 className='mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl'>
              Keep parish and town council accounts ready for review,
              reporting, and year end.
            </h1>

            <p className='mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg'>
              WpAccPac helps clerks and responsible financial officers manage
              bank-fed bookkeeping, nominal ledgers, VAT, reconciliations, and
              AGAR working papers in one focused system.
            </p>

            <div className='mt-8 flex flex-col gap-3 sm:flex-row'>
              <Link
                href='/auth/register'
                className='inline-flex items-center justify-center rounded-md bg-emerald-800 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-900'
              >
                Create an account
              </Link>

              <Link
                href='/auth/login'
                className='inline-flex items-center justify-center rounded-md border border-emerald-200 bg-white px-5 py-3 text-sm font-medium text-slate-900 hover:bg-emerald-50'
              >
                Sign in
              </Link>
            </div>

            <p className='mt-4 text-sm text-slate-600'>
              Built for parish and town councils that need clear records,
              controlled posting, and practical year-end evidence.
            </p>
          </div>

          <div className='relative'>
            <div className='absolute -inset-4 rounded-2xl bg-emerald-200/40 blur-2xl' />
            <div className='relative rounded-xl border border-emerald-100 bg-white/95 p-5 shadow-xl shadow-emerald-950/10'>
              <div className='flex items-start justify-between gap-4 border-b border-emerald-100 pb-4'>
                <div>
                  <p className='text-xs font-medium tracking-wide text-emerald-800 uppercase'>
                    Report preview
                  </p>
                  <h2 className='mt-1 text-xl font-semibold'>AGAR summary</h2>
                  <p className='mt-1 text-sm text-slate-600'>
                    Illustrative year-end readiness panel
                  </p>
                </div>

                <span className='rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900'>
                  Exportable
                </span>
              </div>

              <div className='mt-4 grid gap-3'>
                {previewRows.map(row => (
                  <div
                    key={row.label}
                    className='rounded-lg border border-emerald-100 bg-emerald-50/50 p-3'
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <p className='text-sm font-medium text-slate-950'>
                          {row.label}
                        </p>
                        <p className='mt-1 text-xs text-slate-600'>
                          {row.detail}
                        </p>
                      </div>

                      <span className='rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-800'>
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className='mt-4 grid grid-cols-3 gap-3 border-t border-emerald-100 pt-4 text-center'>
                <div className='rounded-md bg-slate-50 px-3 py-2'>
                  <p className='text-xs text-slate-500'>Journals</p>
                  <p className='text-sm font-semibold'>Posted</p>
                </div>
                <div className='rounded-md bg-slate-50 px-3 py-2'>
                  <p className='text-xs text-slate-500'>Closed years</p>
                  <p className='text-sm font-semibold'>Read-only</p>
                </div>
                <div className='rounded-md bg-slate-50 px-3 py-2'>
                  <p className='text-xs text-slate-500'>Outputs</p>
                  <p className='text-sm font-semibold'>PDF pack</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className='mx-auto max-w-7xl px-6 py-14'>
        <div className='grid gap-5 md:grid-cols-3'>
          {features.map(feature => (
            <article
              key={feature.title}
              className='rounded-lg border border-emerald-100 bg-white p-6 shadow-sm'
            >
              <h2 className='text-base font-semibold'>{feature.title}</h2>
              <p className='mt-3 text-sm leading-6 text-slate-600'>
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className='border-y border-emerald-100 bg-emerald-50/70'>
        <div className='mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start'>
          <div>
            <p className='text-sm font-medium text-emerald-800'>
              Reporting and compliance
            </p>
            <h2 className='mt-2 text-2xl font-semibold tracking-tight'>
              Designed around the reports councils actually need.
            </h2>
          </div>

          <ul className='grid gap-3 sm:grid-cols-2'>
            {reportItems.map(item => (
              <li
                key={item}
                className='rounded-md border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-700'
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id='pricing' className='mx-auto max-w-7xl scroll-mt-20 px-6 py-14'>
        <div className='grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center'>
          <div>
            <p className='text-sm font-medium text-emerald-800'>Pricing</p>
            <h2 className='mt-2 text-2xl font-semibold tracking-tight'>
              Simple pricing for parish and town councils.
            </h2>
            <p className='mt-4 max-w-xl text-sm leading-6 text-slate-600'>
              One straightforward plan for councils that need bookkeeping,
              reporting, and year-end preparation without enterprise complexity.
            </p>
          </div>

          <div className='rounded-lg border border-emerald-100 bg-white p-6 shadow-sm'>
            <div className='flex flex-col gap-2 border-b border-emerald-100 pb-5 sm:flex-row sm:items-end sm:justify-between'>
              <div>
                <h3 className='text-lg font-semibold'>
                  Parish and town council plan
                </h3>
                <p className='mt-1 text-sm text-slate-600'>
                  Launch-ready accounts and reports.
                </p>
              </div>

              <p className='text-3xl font-semibold tracking-tight'>
                £14.99
                <span className='text-sm font-medium text-slate-500'>
                  {' '}
                  / month
                </span>
              </p>
            </div>

            <ul className='mt-5 grid gap-3 sm:grid-cols-2'>
              {pricingItems.map(item => (
                <li key={item} className='flex gap-2 text-sm text-slate-700'>
                  <span className='mt-1 h-2 w-2 rounded-full bg-emerald-700' />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href='/auth/register'
              className='mt-6 inline-flex items-center justify-center rounded-md bg-emerald-800 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-900'
            >
              Create an account
            </Link>
          </div>
        </div>
      </section>

      <footer className='border-t border-emerald-100 bg-emerald-50/40'>
        <div className='mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between'>
          <p>WpAccPac for UK parish and town council finance teams.</p>

          <div className='flex flex-wrap gap-4'>
            <Link href='/legal/privacy' className='hover:text-emerald-900'>
              Privacy
            </Link>
            <Link href='/legal/gdpr' className='hover:text-emerald-900'>
              GDPR
            </Link>
            <Link href='/legal/security' className='hover:text-emerald-900'>
              Security
            </Link>
            <Link href='/auth/login' className='hover:text-emerald-900'>
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
