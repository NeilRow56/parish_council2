import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, asc, eq, isNotNull } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankConnections } from '@/db/schema/bankConnection'
import {
  financialYears,
  nominalCodes,
  nominalOpeningBalances
} from '@/db/schema/nominalLedger'
import { OpeningBalancesForm } from './_components/opening-balances-form'

export default async function OpeningBalancesPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId

  const [financialYear] = await db
    .select({
      id: financialYears.id,
      label: financialYears.label
    })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1)

  if (!financialYear) {
    redirect('/bank-connections')
  }

  const rows = await db
    .select({
      connectionId: bankConnections.id,
      accountName: bankConnections.accountName,
      accountLast4: bankConnections.accountLast4,
      sortCode: bankConnections.sortCode,
      nominalCodeId: bankConnections.nominalCodeId,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name,
      openingBalance: nominalOpeningBalances.amount
    })
    .from(bankConnections)
    .innerJoin(nominalCodes, eq(bankConnections.nominalCodeId, nominalCodes.id))
    .leftJoin(
      nominalOpeningBalances,
      and(
        eq(nominalOpeningBalances.nominalCodeId, bankConnections.nominalCodeId),
        eq(nominalOpeningBalances.financialYearId, financialYear.id),
        eq(nominalOpeningBalances.parishCouncilId, parishCouncilId)
      )
    )
    .where(
      and(
        eq(bankConnections.parishCouncilId, parishCouncilId),
        isNotNull(bankConnections.nominalCodeId)
      )
    )
    .orderBy(asc(bankConnections.accountName))

  return (
    <main className='mx-auto max-w-5xl px-6 py-8'>
      <div className='mb-8 flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Bank opening balances
          </h1>
          <p className='mt-1 text-sm text-zinc-600'>
            Enter opening balances for linked bank accounts.
          </p>
          <p className='mt-1 text-sm text-zinc-600'>
            These balances are shared with Settings → Opening balances.
          </p>
          <p className='mt-1 text-xs text-zinc-500'>
            Enter negative values for overdrafts.
          </p>
          <p className='mt-2 text-sm text-zinc-500'>
            Financial year:{' '}
            <span className='font-medium text-zinc-700'>
              {financialYear.label}
            </span>
          </p>
        </div>

        <Link
          href='/bank-connections'
          className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-emerald-50/40'
        >
          Back to bank connections
        </Link>
      </div>

      <OpeningBalancesForm
        financialYearId={financialYear.id}
        rows={rows.map(row => ({
          ...row,
          nominalCodeId: row.nominalCodeId ?? '',
          openingBalance: row.openingBalance ?? '0.00'
        }))}
      />
    </main>
  )
}
