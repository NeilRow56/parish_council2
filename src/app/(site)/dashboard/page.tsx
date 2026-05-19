import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankConnections, bankTransactions, parishCouncils } from '@/db/schema'
import {
  financialYears,
  journalEntries,
  nominalCodes
} from '@/db/schema/nominalLedger'

export const dynamic = 'force-dynamic'

function formatDate(value: string | Date | null) {
  if (!value) return 'Not set'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

function StatusCard({
  title,
  value,
  description,
  href,
  linkLabel
}: {
  title: string
  value: string
  description: string
  href: string
  linkLabel: string
}) {
  return (
    <section className='rounded-lg border bg-white p-5 shadow-sm'>
      <p className='text-sm font-medium text-slate-500'>{title}</p>
      <p className='mt-2 text-2xl font-semibold text-slate-950'>{value}</p>
      <p className='mt-2 min-h-10 text-sm leading-5 text-slate-600'>
        {description}
      </p>
      <Link
        href={href}
        className='mt-4 inline-flex text-sm font-medium text-slate-900 hover:underline'
      >
        {linkLabel}
      </Link>
    </section>
  )
}

function getVatLabel({
  canRecoverVat,
  vatStatus,
  vatClaimMethod,
  vatClaimFrequency
}: {
  canRecoverVat: boolean
  vatStatus: string
  vatClaimMethod: string
  vatClaimFrequency: string
}) {
  if (!canRecoverVat) return 'Not reclaiming VAT'
  if (vatStatus === 'REGISTERED') return `Registered - ${vatClaimFrequency}`
  return `${vatClaimMethod} - ${vatClaimFrequency}`
}

const agarRelevantNominalCodeFilter = sql`
  ${nominalCodes.isActive} = true
  and ${nominalCodes.isBank} = false
  and ${nominalCodes.isVatRecoverable} = false
  and ${nominalCodes.isVatPayable} = false
  and ${nominalCodes.code} not in ('3090', '3095')
  and coalesce(${nominalCodes.category}, '') not in ('Bank', 'Control', 'Liabilities', 'Reserves')
  and (
    ${nominalCodes.type} in ('INCOME', 'EXPENDITURE')
    or ${nominalCodes.category} = 'Fixed Assets'
  )
`

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login?next=/dashboard')
  }

  const parishCouncilId = session.user.parishCouncilId

  const [council] = await db
    .select({
      name: parishCouncils.name,
      canRecoverVat: parishCouncils.canRecoverVat,
      vatStatus: parishCouncils.vatStatus,
      vatClaimMethod: parishCouncils.vatClaimMethod,
      vatClaimFrequency: parishCouncils.vatClaimFrequency
    })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  if (!council) {
    redirect('/auth/register')
  }

  const [currentYear] = await db
    .select({
      id: financialYears.id,
      label: financialYears.label,
      startDate: financialYears.startDate,
      endDate: financialYears.endDate
    })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.isClosed, false)
      )
    )
    .orderBy(desc(financialYears.startDate))
    .limit(1)

  const [
    stagedSummary,
    [bankingSummary],
    [agarMappingSummary],
    recentPostings
  ] = await Promise.all([
    db
      .select({
        status: bankTransactions.status,
        count: sql<number>`count(*)::int`
      })
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.parishCouncilId, parishCouncilId),
          inArray(bankTransactions.status, ['PENDING', 'CODED'])
        )
      )
      .groupBy(bankTransactions.status),

    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${bankConnections.status} = 'ACTIVE')::int`,
        notLinked: sql<number>`count(*) filter (where ${bankConnections.nominalCodeId} is null)::int`,
        needsAttention: sql<number>`count(*) filter (where ${bankConnections.status} in ('EXPIRED', 'REVOKED', 'ERROR'))::int`
      })
      .from(bankConnections)
      .where(eq(bankConnections.parishCouncilId, parishCouncilId)),

    currentYear
      ? db
          .select({
            relevantCodes: sql<number>`count(*) filter (where ${agarRelevantNominalCodeFilter})::int`,
            mappedRelevantCodes: sql<number>`count(*) filter (where ${agarRelevantNominalCodeFilter} and ${nominalCodes.agarBox} is not null)::int`
          })
          .from(nominalCodes)
          .where(
            and(
              eq(nominalCodes.parishCouncilId, parishCouncilId),
              eq(nominalCodes.financialYearId, currentYear.id)
            )
          )
      : Promise.resolve([
          {
            relevantCodes: 0,
            mappedRelevantCodes: 0
          }
        ]),

    db
      .select({
        id: journalEntries.id,
        date: journalEntries.date,
        reference: journalEntries.reference,
        description: journalEntries.description,
        source: journalEntries.source,
        createdAt: journalEntries.createdAt
      })
      .from(journalEntries)
      .where(
        currentYear
          ? and(
              eq(journalEntries.parishCouncilId, parishCouncilId),
              eq(journalEntries.financialYearId, currentYear.id)
            )
          : eq(journalEntries.parishCouncilId, parishCouncilId)
      )
      .orderBy(desc(journalEntries.createdAt))
      .limit(5)
  ])

  const pendingCount =
    stagedSummary.find(row => row.status === 'PENDING')?.count ?? 0
  const codedCount = stagedSummary.find(row => row.status === 'CODED')?.count ?? 0
  const stagedCount = pendingCount + codedCount
  const activeBankConnections = Number(bankingSummary?.active ?? 0)
  const missingLedgerLinks = Number(bankingSummary?.notLinked ?? 0)

  // TODO: Replace this operational signal with a formal statement reconciliation
  // status when a statement/period reconciliation data source exists.
  const bankingNeedsAttention =
    stagedCount > 0 ||
    missingLedgerLinks > 0 ||
    Number(bankingSummary?.needsAttention ?? 0) > 0

  // TODO: Expand AGAR readiness beyond actionable nominal-code mapping coverage
  // when year-end checks are formalised, for example reconciliation and approvals.
  const agarRelevantCodes = Number(agarMappingSummary?.relevantCodes ?? 0)
  const mappedAgarRelevantCodes = Number(
    agarMappingSummary?.mappedRelevantCodes ?? 0
  )
  const unmappedAgarRelevantCodes =
    agarRelevantCodes - mappedAgarRelevantCodes
  const agarReady =
    currentYear && agarRelevantCodes > 0 && unmappedAgarRelevantCodes === 0

  const nextActions = [
    !currentYear
      ? {
          label: 'Create or open a financial year',
          href: '/settings/financial-years'
        }
      : null,
    stagedCount > 0
      ? {
          label: `Review ${stagedCount} staged bank transaction${
            stagedCount === 1 ? '' : 's'
          }`,
          href: '/transactions/inbox'
        }
      : null,
    Number(bankingSummary?.notLinked ?? 0) > 0
      ? {
          label: 'Link bank connections to ledger codes',
          href: '/bank-connections'
        }
      : null,
    currentYear && unmappedAgarRelevantCodes > 0
      ? {
          label: 'Map AGAR-relevant nominal codes',
          href: '/settings/nominal-codes'
        }
      : null,
    currentYear
      ? {
          label: 'Review AGAR summary',
          href: '/reports/agar-summary'
        }
      : null
  ].filter((action): action is { label: string; href: string } =>
    Boolean(action)
  )

  return (
    <main className='min-h-screen bg-slate-50 px-6 py-8'>
      <div className='mx-auto max-w-7xl space-y-8'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight text-slate-950'>
              Dashboard
            </h1>
            <p className='mt-1 text-sm text-slate-600'>
              Operational overview for {council.name}.
            </p>
          </div>

          <Link
            href='/ledger/bank-entry/new'
            className='inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
          >
            New payment or receipt
          </Link>
        </div>

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          <StatusCard
            title='Current financial year'
            value={currentYear?.label ?? 'Not configured'}
            description={
              currentYear
                ? `${formatDate(currentYear.startDate)} to ${formatDate(
                    currentYear.endDate
                  )}`
                : 'Set up a financial year before posting transactions.'
            }
            href='/settings/financial-years'
            linkLabel='Manage financial years'
          />

          <StatusCard
            title='Staged bank transactions'
            value={String(stagedCount)}
            description={`${pendingCount} pending and ${codedCount} coded transaction${
              stagedCount === 1 ? '' : 's'
            } waiting in the inbox.`}
            href='/transactions/inbox'
            linkLabel='Open transaction inbox'
          />

          <StatusCard
            title='Banking status'
            value={bankingNeedsAttention ? 'Needs review' : 'Up to date'}
            description={`${activeBankConnections} active bank connection${
              activeBankConnections === 1 ? '' : 's'
            }; ${missingLedgerLinks} missing ledger link${
              missingLedgerLinks === 1 ? '' : 's'
            }; ${stagedCount} staged transaction${
              stagedCount === 1 ? '' : 's'
            } pending review.`}
            href='/reports/bank-reconciliation'
            linkLabel='Review reconciliation'
          />

          <StatusCard
            title='AGAR readiness'
            value={
              agarReady
                ? 'All AGAR-relevant nominal codes mapped'
                : 'Check AGAR mappings'
            }
            description={
              currentYear
                ? `${mappedAgarRelevantCodes} of ${agarRelevantCodes} AGAR-relevant nominal code${
                    agarRelevantCodes === 1 ? '' : 's'
                  } mapped.`
                : 'No open financial year found for AGAR reporting.'
            }
            href='/reports/agar-summary'
            linkLabel='Open AGAR summary'
          />

          <StatusCard
            title='VAT status'
            value={getVatLabel(council)}
            description={
              council.canRecoverVat
                ? 'VAT reporting is available from the VAT section.'
                : 'VAT recovery is currently disabled for this council.'
            }
            href={
              council.vatStatus === 'REGISTERED'
                ? '/vat/returns'
                : '/vat/vat-claim-126'
            }
            linkLabel='Review VAT'
          />

          <StatusCard
            title='Recent postings'
            value={String(recentPostings.length)}
            description='Latest posted journal entries for the current financial year.'
            href='/ledger'
            linkLabel='Open ledger'
          />
        </div>

        <div className='grid gap-6 lg:grid-cols-[1fr_0.8fr]'>
          <section className='rounded-lg border bg-white shadow-sm'>
            <div className='border-b px-5 py-4'>
              <h2 className='text-base font-semibold text-slate-950'>
                Recent postings
              </h2>
              <p className='mt-1 text-sm text-slate-600'>
                Latest journals posted to the ledger.
              </p>
            </div>

            <div className='divide-y'>
              {recentPostings.length > 0 ? (
                recentPostings.map(posting => (
                  <Link
                    key={posting.id}
                    href={`/ledger/journals/${posting.id}`}
                    className='grid gap-2 px-5 py-4 text-sm hover:bg-slate-50 sm:grid-cols-[120px_120px_1fr_120px]'
                  >
                    <span className='text-slate-500'>
                      {formatDate(posting.date)}
                    </span>
                    <span className='font-mono text-xs text-slate-500'>
                      {posting.reference}
                    </span>
                    <span className='font-medium text-slate-950'>
                      {posting.description}
                    </span>
                    <span className='text-slate-500'>{posting.source}</span>
                  </Link>
                ))
              ) : (
                <p className='px-5 py-8 text-sm text-slate-500'>
                  No recent postings found.
                </p>
              )}
            </div>
          </section>

          <section className='rounded-lg border bg-white shadow-sm'>
            <div className='border-b px-5 py-4'>
              <h2 className='text-base font-semibold text-slate-950'>
                Next actions
              </h2>
              <p className='mt-1 text-sm text-slate-600'>
                A short clerk-focused checklist for release workflows.
              </p>
            </div>

            <div className='divide-y'>
              {nextActions.map(action => (
                <Link
                  key={action.href}
                  href={action.href}
                  className='block px-5 py-4 text-sm font-medium text-slate-900 hover:bg-slate-50'
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
