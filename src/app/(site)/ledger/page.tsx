import Link from 'next/link'
import { headers } from 'next/headers'
import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'

function formatAmount(value: string | number | null) {
  const amount = Number(value ?? 0)

  if (amount === 0) return '—'

  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

function formatCurrency(value: string | number | null) {
  const amount = Number(value ?? 0)

  if (amount === 0) return '—'

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export default async function LedgerPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return <div className='p-6'>Unauthorised</div>
  }

  const parishCouncilId = session.user.parishCouncilId

  const [currentYear] = await db
    .select()
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1)

  if (!currentYear) {
    return (
      <main className='p-6'>
        <h1 className='text-2xl font-semibold'>Ledger</h1>
        <p className='mt-4 text-sm text-slate-600'>
          No open financial year found.
        </p>
      </main>
    )
  }

  const rows = await db
    .select({
      entryId: journalEntries.id,
      date: journalEntries.date,
      reference: journalEntries.reference,
      description: journalEntries.description,
      source: journalEntries.source,

      lineId: journalLines.id,
      lineDescription: journalLines.description,
      debit: journalLines.debit,
      credit: journalLines.credit,

      nominalCode: nominalCodes.code,
      nominalCodeId: nominalCodes.id,
      nominalName: nominalCodes.name,
      nominalType: nominalCodes.type
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .innerJoin(nominalCodes, eq(journalLines.nominalCodeId, nominalCodes.id))
    .where(
      and(
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, currentYear.id)
      )
    )
    .orderBy(desc(journalEntries.date), desc(journalEntries.createdAt))

  const totalDebit = rows.reduce((sum, row) => sum + Number(row.debit), 0)
  const totalCredit = rows.reduce((sum, row) => sum + Number(row.credit), 0)

  return (
    <main className='min-h-screen bg-slate-50 p-6'>
      <div className='mx-auto max-w-7xl space-y-6'>
        <div>
          <h1 className='text-2xl font-semibold text-slate-900'>Ledger</h1>
          <p className='mt-1 text-sm text-slate-600'>
            Posted journal lines for financial year {currentYear.label}
          </p>
        </div>

        <div className='grid gap-4 sm:grid-cols-3'>
          <div className='rounded-lg border bg-white p-4'>
            <p className='text-sm text-slate-500'>Journal lines</p>
            <p className='mt-1 text-2xl font-semibold'>{rows.length}</p>
          </div>

          <div className='rounded-lg border bg-white p-4'>
            <p className='text-sm text-slate-500'>Total debits</p>
            <p className='mt-1 text-2xl font-semibold'>
              {formatCurrency(totalDebit)}
            </p>
          </div>

          <div className='rounded-lg border bg-white p-4'>
            <p className='text-sm text-slate-500'>Total credits</p>
            <p className='mt-1 text-2xl font-semibold'>
              {formatCurrency(totalCredit)}
            </p>
          </div>
        </div>

        <div className='py-4'>
          <Link
            href='/ledger/journals/new'
            className='rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white'
          >
            New manual journal
          </Link>
        </div>

        <div className='overflow-hidden rounded-xl border bg-white shadow-sm'>
          {rows.length === 0 ? (
            <div className='p-10 text-center text-sm text-slate-500'>
              No ledger entries yet. Code and post transactions from the inbox.
            </div>
          ) : (
            <table className='w-full text-sm'>
              <thead className='bg-slate-50 text-left text-slate-500'>
                <tr>
                  <th className='px-4 py-3 font-medium'>Date</th>
                  <th className='px-4 py-3 font-medium'>Reference</th>
                  <th className='px-4 py-3 font-medium'>Description</th>
                  <th className='px-4 py-3 font-medium'>Nominal code</th>
                  <th className='px-4 py-3 text-right font-medium'>Debit</th>
                  <th className='px-4 py-3 text-right font-medium'>Credit</th>
                  <th className='px-4 py-3 font-medium'>Source</th>
                </tr>
              </thead>

              <tbody>
                {rows.map(row => (
                  <tr
                    key={row.lineId}
                    className='border-t border-slate-100 hover:bg-slate-50'
                  >
                    <td className='px-4 py-3 whitespace-nowrap text-slate-600'>
                      {formatDate(row.date)}
                    </td>

                    <td className='px-4 py-3 font-mono text-xs whitespace-nowrap'>
                      <Link
                        href={`/ledger/journals/${row.entryId}`}
                        className='text-slate-500 hover:text-slate-900 hover:underline'
                      >
                        {row.reference}
                      </Link>
                    </td>

                    <td className='px-4 py-3 text-slate-900'>
                      <Link
                        href={`/ledger/journals/${row.entryId}`}
                        className='block hover:underline'
                      >
                        {row.lineDescription ?? row.description}
                      </Link>
                    </td>

                    <td className='px-4 py-3 whitespace-nowrap text-slate-700'>
                      <Link
                        href={`/ledger/${row.nominalCodeId}`}
                        className='text-slate-700 hover:underline'
                      >
                        {row.nominalCode} — {row.nominalName}
                      </Link>
                    </td>

                    <td className='px-4 py-3 text-right font-mono whitespace-nowrap'>
                      {formatAmount(row.debit)}
                    </td>

                    <td className='px-4 py-3 text-right font-mono whitespace-nowrap'>
                      {formatAmount(row.credit)}
                    </td>

                    <td className='px-4 py-3 text-xs whitespace-nowrap text-slate-500'>
                      {row.source}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className='border-t bg-slate-50 font-medium'>
                <tr>
                  <td colSpan={4} className='px-4 py-3 text-right'>
                    Totals
                  </td>
                  <td className='px-4 py-3 text-right font-mono'>
                    {formatCurrency(totalDebit)}
                  </td>
                  <td className='px-4 py-3 text-right font-mono'>
                    {formatCurrency(totalCredit)}
                  </td>
                  <td className='px-4 py-3' />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </main>
  )
}
