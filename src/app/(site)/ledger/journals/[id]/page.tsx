// src/app/ledger/journals/[id]/page.tsx

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { projects, reserves } from '@/db/schema'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'
import { ReverseJournalButton } from './_components/reverse-journal-button'

function formatAmount(value: string | number | null) {
  const amount = Number(value ?? 0)

  return amount === 0
    ? '—'
    : amount.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

type ReturnSource =
  | 'bank-receipts'
  | 'bank-payments'
  | 'inbox'
  | 'manual-journal'
  | 'fixed-assets'

const returnTargets: Record<ReturnSource, { href: string; label: string }> = {
  'bank-receipts': {
    href: '/ledger/bank-entry/new?entryType=RECEIPT',
    label: 'Back to bank receipts'
  },
  'bank-payments': {
    href: '/ledger/bank-entry/new?entryType=PAYMENT',
    label: 'Back to bank payments'
  },
  inbox: {
    href: '/transactions/inbox',
    label: 'Back to inbox'
  },
  'manual-journal': {
    href: '/ledger',
    label: 'Back to ledger'
  },
  'fixed-assets': {
    href: '/reports/asset-register',
    label: 'Back to fixed assets'
  }
}

function getReturnTarget(source: string | string[] | undefined) {
  const value = Array.isArray(source) ? source[0] : source

  if (value && value in returnTargets) {
    return {
      source: value as ReturnSource,
      ...returnTargets[value as ReturnSource]
    }
  }

  return {
    source: null,
    href: '/ledger',
    label: 'Back to ledger'
  }
}

export default async function JournalDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ source?: string | string[] }>
}) {
  const { id } = await params
  const { source } = (await searchParams) ?? {}
  const returnTarget = getReturnTarget(source)

  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId

  if (!parishCouncilId) {
    redirect('/auth/register')
  }

  const [journal] = await db
    .select({
      id: journalEntries.id,
      reference: journalEntries.reference,
      date: journalEntries.date,
      description: journalEntries.description,
      source: journalEntries.source,
      financialYearId: journalEntries.financialYearId,
      financialYearLabel: financialYears.label,
      financialYearClosed: financialYears.isClosed,
      reversesJournalEntryId: journalEntries.reversesJournalEntryId,
      reversedByJournalEntryId: journalEntries.reversedByJournalEntryId
    })
    .from(journalEntries)
    .leftJoin(
      financialYears,
      eq(financialYears.id, journalEntries.financialYearId)
    )
    .where(
      and(
        eq(journalEntries.id, id),
        eq(journalEntries.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!journal) {
    notFound()
  }

  const lines = await db
    .select({
      id: journalLines.id,
      nominalCodeId: journalLines.nominalCodeId,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name,
      description: journalLines.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
      reserveName: reserves.name,
      projectName: projects.name,
      attachmentUrl: journalLines.attachmentUrl,
      attachmentName: journalLines.attachmentName
    })
    .from(journalLines)
    .innerJoin(nominalCodes, eq(nominalCodes.id, journalLines.nominalCodeId))
    .leftJoin(reserves, eq(reserves.id, journalLines.reserveId))
    .leftJoin(projects, eq(projects.id, journalLines.projectId))
    .where(
      and(
        eq(journalLines.journalEntryId, journal.id),
        eq(journalLines.parishCouncilId, parishCouncilId)
      )
    )
    .orderBy(nominalCodes.code)

  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit), 0)
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit), 0)
  const difference = totalDebit - totalCredit
  const canReverse =
    journal.source === 'MANUAL' &&
    !journal.financialYearClosed &&
    !journal.reversesJournalEntryId &&
    !journal.reversedByJournalEntryId

  return (
    <main className='mx-auto max-w-5xl px-6 py-8'>
      <div className='mb-8 flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Journal {journal.reference}
          </h1>
          <p className='mt-1 text-sm text-zinc-600'>
            View posted journal details and lines.
          </p>
        </div>

        <Link
          href={returnTarget.href}
          className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-emerald-50/40'
        >
          {returnTarget.label}
        </Link>
      </div>

      <section className='mb-6 rounded-lg border bg-white p-4 shadow-sm'>
        <dl className='grid gap-4 text-sm md:grid-cols-2'>
          <div>
            <dt className='text-zinc-500'>Reference</dt>
            <dd className='mt-1 font-medium'>{journal.reference}</dd>
          </div>

          <div>
            <dt className='text-zinc-500'>Date</dt>
            <dd className='mt-1 font-medium'>{formatDate(journal.date)}</dd>
          </div>

          <div>
            <dt className='text-zinc-500'>Financial year</dt>
            <dd className='mt-1 font-medium'>
              {journal.financialYearLabel ?? '—'}
            </dd>
          </div>

          <div>
            <dt className='text-zinc-500'>Source</dt>
            <dd className='mt-1 font-medium'>{journal.source}</dd>
          </div>

          {journal.reversesJournalEntryId ? (
            <div>
              <dt className='text-zinc-500'>Reverses journal</dt>
              <dd className='mt-1 font-medium'>
                <Link
                  href={`/ledger/journals/${journal.reversesJournalEntryId}`}
                  className='text-blue-600 hover:underline'
                >
                  View original journal
                </Link>
              </dd>
            </div>
          ) : null}

          {journal.reversedByJournalEntryId ? (
            <div>
              <dt className='text-zinc-500'>Reversed by</dt>
              <dd className='mt-1 font-medium'>
                <Link
                  href={`/ledger/journals/${journal.reversedByJournalEntryId}`}
                  className='text-blue-600 hover:underline'
                >
                  View reversal journal
                </Link>
              </dd>
            </div>
          ) : null}

          <div className='md:col-span-2'>
            <dt className='text-zinc-500'>Description</dt>
            <dd className='mt-1 font-medium'>{journal.description}</dd>
          </div>
        </dl>
      </section>

      <div className='mb-4 flex items-center justify-between gap-4'>
        <p className='text-sm font-semibold'>
          Posted journals are immutable. To correct a posting, reverse and
          repost the journal.
        </p>

        <div className='flex items-center gap-2'>
          {canReverse ? (
            <ReverseJournalButton
              journalEntryId={journal.id}
              source={returnTarget.source}
            />
          ) : (
            <span className='rounded-md border bg-emerald-50/30 px-3 py-2 text-sm text-zinc-600'>
              {journal.financialYearClosed
                ? 'Closed-year journal'
                : journal.reversedByJournalEntryId
                  ? 'Already reversed'
                  : journal.reversesJournalEntryId
                    ? 'Reversal journal'
                    : 'Not reversible here'}
            </span>
          )}
        </div>
      </div>

      <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
        <table className='w-full border-collapse text-sm'>
          <thead className='bg-emerald-50/30 text-left text-zinc-600'>
            <tr>
              <th className='px-4 py-3 font-medium'>Nominal code</th>
              <th className='px-4 py-3 font-medium'>Line description</th>
              <th className='px-4 py-3 font-medium'>Reserve</th>
              <th className='px-4 py-3 font-medium'>Project</th>
              <th className='px-4 py-3 font-medium'>Document</th>
              <th className='px-4 py-3 text-right font-medium'>Debit</th>
              <th className='px-4 py-3 text-right font-medium'>Credit</th>
            </tr>
          </thead>

          <tbody>
            {lines.map(line => (
              <tr key={line.id} className='border-t'>
                <td className='px-4 py-3 font-medium'>
                  {line.nominalCode} — {line.nominalName}
                </td>

                <td className='px-4 py-3'>{line.description || '—'}</td>

                <td className='px-4 py-3'>{line.reserveName ?? '—'}</td>

                <td className='px-4 py-3'>{line.projectName ?? '—'}</td>

                <td className='px-4 py-3'>
                  {line.attachmentUrl ? (
                    <a
                      href={line.attachmentUrl}
                      target='_blank'
                      rel='noreferrer'
                      className='text-blue-600 hover:underline'
                    >
                      {line.attachmentName || 'View document'}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>

                <td className='px-4 py-3 text-right'>
                  {formatAmount(line.debit)}
                </td>

                <td className='px-4 py-3 text-right'>
                  {formatAmount(line.credit)}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className='border-t bg-emerald-50/30 font-semibold'>
            <tr>
              <td className='px-4 py-3' colSpan={5}>
                Totals
              </td>
              <td className='px-4 py-3 text-right'>
                {formatAmount(totalDebit)}
              </td>
              <td className='px-4 py-3 text-right'>
                {formatAmount(totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {Math.round(difference * 100) !== 0 && (
        <p className='mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
          Warning: this journal does not balance. Difference:{' '}
          {formatAmount(difference)}
        </p>
      )}
    </main>
  )
}
