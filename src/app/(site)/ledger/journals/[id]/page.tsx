// src/app/ledger/journals/[id]/page.tsx

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'
import { JournalDetailClient } from './_components/journal-detail-client'
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

export default async function JournalDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

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
      financialYearLabel: financialYears.label
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
      credit: journalLines.credit
    })
    .from(journalLines)
    .innerJoin(nominalCodes, eq(nominalCodes.id, journalLines.nominalCodeId))
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
          href='/ledger'
          className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
        >
          Back to ledger
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

          <div className='md:col-span-2'>
            <dt className='text-zinc-500'>Description</dt>
            <dd className='mt-1 font-medium'>{journal.description}</dd>
          </div>
        </dl>
      </section>

      <div className='mb-4 flex items-center justify-between gap-4'>
        <p className='text-sm font-semibold'>
          NB: Only descriptions can be edited. To correct amounts, reverse and
          repost the journal.
        </p>

        <div className='flex items-center gap-2'>
          <ReverseJournalButton journalEntryId={journal.id} />
          <JournalDetailClient journal={journal} lines={lines} />
        </div>
      </div>

      <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
        <table className='w-full border-collapse text-sm'>
          <thead className='bg-zinc-50 text-left text-zinc-600'>
            <tr>
              <th className='px-4 py-3 font-medium'>Nominal code</th>
              <th className='px-4 py-3 font-medium'>Line description</th>
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
                <td className='px-4 py-3 text-right'>
                  {formatAmount(line.debit)}
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(line.credit)}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className='border-t bg-zinc-50 font-semibold'>
            <tr>
              <td className='px-4 py-3' colSpan={2}>
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
