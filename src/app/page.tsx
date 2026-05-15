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

export default function HomePage() {
  return (
    <main className='min-h-screen bg-white text-slate-950'>
      <header className='border-b bg-white'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-4'>
          <Link href='/' className='text-lg font-semibold tracking-tight'>
            WpAccPac
          </Link>

          <nav className='flex items-center gap-3 text-sm'>
            <Link
              href='/legal/privacy'
              className='hidden text-slate-600 hover:text-slate-950 sm:inline'
            >
              Privacy
            </Link>

            <Link
              href='/auth/login'
              className='rounded-md border px-3 py-2 font-medium hover:bg-slate-50'
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className='border-b bg-slate-50'>
        <div className='mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20'>
          <div className='max-w-3xl'>
            <p className='text-sm font-medium text-slate-600'>
              Parish council bookkeeping and AGAR preparation
            </p>

            <h1 className='mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl'>
              Keep parish council accounts ready for review, reporting, and
              year end.
            </h1>

            <p className='mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg'>
              WpAccPac helps clerks and responsible financial officers manage
              bank-fed bookkeeping, nominal ledgers, VAT, reconciliations, and
              AGAR working papers in one focused system.
            </p>

            <div className='mt-8 flex flex-col gap-3 sm:flex-row'>
              <Link
                href='/auth/register'
                className='inline-flex items-center justify-center rounded-md bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800'
              >
                Create an account
              </Link>

              <Link
                href='/auth/login'
                className='inline-flex items-center justify-center rounded-md border bg-white px-5 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50'
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className='rounded-lg border bg-white p-6 shadow-sm'>
            <div className='border-b pb-4'>
              <p className='text-sm font-medium text-slate-500'>
                Release focus
              </p>
              <h2 className='mt-1 text-xl font-semibold'>
                Built for the accounting year
              </h2>
            </div>

            <dl className='mt-5 space-y-4 text-sm'>
              <div className='flex items-start justify-between gap-4'>
                <dt className='text-slate-600'>Records</dt>
                <dd className='font-medium text-slate-950'>
                  Immutable posted journals
                </dd>
              </div>

              <div className='flex items-start justify-between gap-4'>
                <dt className='text-slate-600'>Corrections</dt>
                <dd className='font-medium text-slate-950'>
                  Reverse and repost
                </dd>
              </div>

              <div className='flex items-start justify-between gap-4'>
                <dt className='text-slate-600'>Closed years</dt>
                <dd className='font-medium text-slate-950'>Read-only</dd>
              </div>

              <div className='flex items-start justify-between gap-4'>
                <dt className='text-slate-600'>Bank feeds</dt>
                <dd className='font-medium text-slate-950'>
                  Review before posting
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className='mx-auto max-w-7xl px-6 py-14'>
        <div className='grid gap-5 md:grid-cols-3'>
          {features.map(feature => (
            <article
              key={feature.title}
              className='rounded-lg border bg-white p-6 shadow-sm'
            >
              <h2 className='text-base font-semibold'>{feature.title}</h2>
              <p className='mt-3 text-sm leading-6 text-slate-600'>
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className='border-y bg-slate-50'>
        <div className='mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start'>
          <div>
            <p className='text-sm font-medium text-slate-600'>
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
                className='rounded-md border bg-white px-4 py-3 text-sm text-slate-700'
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className='mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between'>
        <p>WpAccPac for UK parish and town council finance teams.</p>

        <div className='flex gap-4'>
          <Link href='/legal/privacy' className='hover:text-slate-950'>
            Privacy
          </Link>
          <Link href='/legal/gdpr' className='hover:text-slate-950'>
            GDPR
          </Link>
          <Link href='/legal/security' className='hover:text-slate-950'>
            Security
          </Link>
        </div>
      </footer>
    </main>
  )
}
