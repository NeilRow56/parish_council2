import Link from 'next/link'
import { headers } from 'next/headers'
import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
  nominalOpeningBalances
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

function balanceClass(value: number) {
  return value < 0 ? 'text-red-600' : 'text-slate-900'
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export default async function NominalLedgerPage({
  params
}: {
  params: Promise<{ nominalCodeId: string }>
}) {
  const { nominalCodeId } = await params

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
    return <main className='p-6'>No open financial year found.</main>
  }

  const [nominalCode] = await db
    .select()
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.id, nominalCodeId),
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, currentYear.id)
      )
    )
    .limit(1)

  if (!nominalCode) {
    return <main className='p-6'>Nominal code not found.</main>
  }

  const lines = await db
    .select({
      lineId: journalLines.id,
      date: journalEntries.date,
      reference: journalEntries.reference,
      description: journalLines.description,
      entryDescription: journalEntries.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
      source: journalEntries.source
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .where(
      and(
        eq(journalLines.nominalCodeId, nominalCode.id),
        eq(journalLines.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, currentYear.id)
      )
    )
    .orderBy(asc(journalEntries.date), asc(journalEntries.createdAt))

  const [openingBalanceRow] = await db
    .select({
      amount: nominalOpeningBalances.amount
    })
    .from(nominalOpeningBalances)
    .where(
      and(
        eq(nominalOpeningBalances.parishCouncilId, parishCouncilId),
        eq(nominalOpeningBalances.financialYearId, currentYear.id),
        eq(nominalOpeningBalances.nominalCodeId, nominalCode.id)
      )
    )
    .limit(1)

  type LedgerRow = {
    lineId: string
    date: string
    reference: string
    description: string | null
    entryDescription: string
    debit: string | number
    credit: string | number
    source: string
    debitAmount: number
    creditAmount: number
    runningBalance: number
  }

  const openingBalance = Number(openingBalanceRow?.amount ?? 0)
  const openingDebit = openingBalance > 0 ? openingBalance : 0
  const openingCredit = openingBalance < 0 ? Math.abs(openingBalance) : 0
  const openingRows: LedgerRow[] =
    openingBalance === 0
      ? []
      : [
          {
            lineId: `opening-balance-${nominalCode.id}`,
            date: currentYear.startDate,
            reference: 'OPENING-BALANCE',
            description: 'Opening balance brought forward',
            entryDescription: 'Opening balance brought forward',
            debit: openingDebit,
            credit: openingCredit,
            source: 'OPENING_BALANCE',
            debitAmount: openingDebit,
            creditAmount: openingCredit,
            runningBalance: openingBalance
          }
        ]

  const rows = lines.reduce<LedgerRow[]>((acc, line) => {
    const previousBalance = acc.at(-1)?.runningBalance ?? 0

    const debitAmount = Number(line.debit)
    const creditAmount = Number(line.credit)

    const movement =
      nominalCode.type === 'INCOME'
        ? creditAmount - debitAmount
        : debitAmount - creditAmount

    acc.push({
      ...line,
      debitAmount,
      creditAmount,
      runningBalance: previousBalance + movement
    })

    return acc
  }, openingRows)

  const totalDebit = rows.reduce((sum, row) => sum + row.debitAmount, 0)
  const totalCredit = rows.reduce((sum, row) => sum + row.creditAmount, 0)

  const closingBalance =
    nominalCode.type === 'INCOME'
      ? totalCredit - totalDebit
      : totalDebit - totalCredit

  return (
    <main className='min-h-screen bg-background p-6'>
      <div className='mx-auto max-w-7xl space-y-6'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <Link
              href='/ledger'
              className='text-sm text-slate-500 hover:text-slate-900'
            >
              ← Back to ledger
            </Link>

            <h1 className='mt-3 text-2xl font-semibold text-slate-900'>
              {nominalCode.code} — {nominalCode.name}
            </h1>

            <p className='mt-1 text-sm text-slate-600'>
              {currentYear.label} · {nominalCode.type}
            </p>
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-3'>
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

          <div className='rounded-lg border bg-white p-4'>
            <p className='text-sm text-slate-500'>Closing balance</p>
            <p
              className={`mt-1 text-2xl font-semibold ${balanceClass(closingBalance)}`}
            >
              {formatCurrency(closingBalance)}
            </p>
          </div>
        </div>

        <div className='overflow-hidden rounded-xl border bg-white shadow-sm'>
          {rows.length === 0 ? (
            <div className='p-10 text-center text-sm text-slate-500'>
              No journal lines for this nominal code yet.
            </div>
          ) : (
            <table className='w-full text-sm'>
              <thead className='bg-emerald-50/30 text-left text-slate-500'>
                <tr>
                  <th className='px-4 py-3 font-medium'>Date</th>
                  <th className='px-4 py-3 font-medium'>Reference</th>
                  <th className='px-4 py-3 font-medium'>Description</th>
                  <th className='px-4 py-3 text-right font-medium'>Debit</th>
                  <th className='px-4 py-3 text-right font-medium'>Credit</th>
                  <th className='px-4 py-3 text-right font-medium'>
                    Running balance
                  </th>
                  <th className='px-4 py-3 font-medium'>Source</th>
                </tr>
              </thead>

              <tbody>
                {rows.map(row => (
                  <tr
                    key={row.lineId}
                    className='border-t border-emerald-100 hover:bg-emerald-50/40'
                  >
                    <td className='px-4 py-3 whitespace-nowrap text-slate-600'>
                      {formatDate(row.date)}
                    </td>

                    <td className='px-4 py-3 font-mono text-xs whitespace-nowrap text-slate-500'>
                      {row.reference}
                    </td>

                    <td className='px-4 py-3 text-slate-900'>
                      {row.description ?? row.entryDescription}
                    </td>

                    <td className='px-4 py-3 text-right font-mono whitespace-nowrap'>
                      {formatAmount(row.debitAmount)}
                    </td>

                    <td className='px-4 py-3 text-right font-mono whitespace-nowrap'>
                      {formatAmount(row.creditAmount)}
                    </td>

                    <td
                      className={`px-4 py-3 text-right font-mono font-medium whitespace-nowrap ${balanceClass(
                        row.runningBalance
                      )}`}
                    >
                      {formatCurrency(row.runningBalance)}
                    </td>

                    <td className='px-4 py-3 text-xs whitespace-nowrap text-slate-500'>
                      {row.source}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className='border-t bg-emerald-50/30 font-medium'>
                <tr>
                  <td colSpan={3} className='px-4 py-3 text-right'>
                    Totals
                  </td>

                  <td className='px-4 py-3 text-right font-mono'>
                    {formatAmount(totalDebit)}
                  </td>

                  <td className='px-4 py-3 text-right font-mono'>
                    {formatAmount(totalCredit)}
                  </td>

                  <td
                    className={`px-4 py-3 text-right font-mono ${balanceClass(closingBalance)}`}
                  >
                    {formatCurrency(closingBalance)}
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
