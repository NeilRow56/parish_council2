// src/app/bank-connections/page.tsx

import Link from 'next/link'
import { headers } from 'next/headers'
import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankConnections } from '@/db/schema/bankConnection'
import { nominalCodes } from '@/db/schema/nominalLedger'
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'
import { SyncBankButton } from './_components/sync-button'

export default async function BankConnectionsPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return <div className='p-6'>Unauthorised</div>
  }

  const parishCouncilId = session.user.parishCouncilId

  const { financialYear: currentYear } =
    await getSelectedFinancialYear(parishCouncilId)

  const connections = await db
    .select({
      id: bankConnections.id,
      accountName: bankConnections.accountName,
      accountLast4: bankConnections.accountLast4,
      status: bankConnections.status,
      nominalCodeId: bankConnections.nominalCodeId,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name
    })
    .from(bankConnections)
    .leftJoin(nominalCodes, eq(bankConnections.nominalCodeId, nominalCodes.id))
    .where(eq(bankConnections.parishCouncilId, parishCouncilId))
    .orderBy(asc(bankConnections.accountName))

  const bankNominalCodes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, currentYear?.id ?? ''),
        eq(nominalCodes.isBank, true),
        eq(nominalCodes.isActive, true)
      )
    )
    .orderBy(asc(nominalCodes.code))

  return (
    <main className='space-y-6 p-6'>
      <div className='mx-auto max-w-7xl space-y-6'>
        <div className='space-y-1'>
          <h1 className='text-2xl font-semibold'>Bank connections</h1>
          <p className='text-sm text-slate-600'>
            Connect bank accounts, link them to nominal ledger bank codes, and
            sync transactions into the inbox.
          </p>
        </div>

        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Link
            href='/api/bank/connect'
            className='inline-flex rounded bg-black px-4 py-2 text-white'
          >
            Connect bank account
          </Link>

          <Link
            href='/bank-connections/opening-balances'
            className='inline-flex rounded border px-4 py-2 font-medium'
          >
            Opening balances
          </Link>
        </div>

        {currentYear?.isClosed ? (
          <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900'>
            Financial year {currentYear.label} is closed. Bank ledger links are
            read-only for closed years.
          </div>
        ) : null}

        {!currentYear?.isClosed && bankNominalCodes.length === 0 && (
          <div className='rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800'>
            <p className='font-medium'>No active bank nominal codes found</p>
            <p className='mt-1'>
              Create or activate a bank nominal code before syncing bank
              transactions.
            </p>
          </div>
        )}

        {connections.length > 0 && (
          <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900'>
            <p className='font-medium'>Sync shortly after connecting</p>
            <p className='mt-1'>
              Some banks require transaction data to be imported soon after you
              approve the Open Banking connection. After connecting a bank
              account, select and save the ledger code, then click{' '}
              <strong>Sync now</strong> before leaving this page.
            </p>
          </div>
        )}

        <div className='space-y-3'>
          {connections.length === 0 ? (
            <div className='rounded border p-4 text-sm text-slate-600'>
              No bank accounts connected yet.
            </div>
          ) : (
            connections.map(connection => {
              const hasLedgerCode = Boolean(connection.nominalCodeId)

              return (
                <div
                  key={connection.id}
                  className='space-y-3 rounded border p-4'
                >
                  <div>
                    <p className='font-medium'>
                      {connection.accountName}{' '}
                      {connection.accountLast4
                        ? `****${connection.accountLast4}`
                        : ''}
                    </p>

                    <p className='text-sm text-gray-600'>
                      Status: {connection.status}
                    </p>

                    <p className='text-sm text-gray-600'>
                      Ledger code:{' '}
                      {connection.nominalCode
                        ? `${connection.nominalCode} — ${connection.nominalName}`
                        : 'Not linked'}
                    </p>

                    {!hasLedgerCode && !currentYear?.isClosed && (
                      <p className='mt-1 text-sm text-amber-700'>
                        Select and save a bank ledger code before syncing this
                        account.
                      </p>
                    )}
                  </div>

                  {currentYear?.isClosed ? (
                    <p className='text-sm text-slate-600'>
                      Ledger code links cannot be changed while the selected
                      financial year is closed.
                    </p>
                  ) : (
                    <form
                      action='/api/bank-connections/ledger-link-code'
                      method='post'
                      className='flex flex-wrap gap-2'
                    >
                      <input
                        type='hidden'
                        name='connectionId'
                        value={connection.id}
                      />

                      <select
                        name='nominalCodeId'
                        defaultValue={connection.nominalCodeId ?? ''}
                        required
                        className='rounded border px-3 py-2 text-sm'
                      >
                        <option value=''>Select bank ledger code...</option>

                        {bankNominalCodes.map(code => (
                          <option key={code.id} value={code.id}>
                            {code.code} — {code.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type='submit'
                        disabled={bankNominalCodes.length === 0}
                        className='rounded border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        Save ledger code
                      </button>
                    </form>
                  )}

                  {hasLedgerCode ? (
                    <SyncBankButton connectionId={connection.id} />
                  ) : (
                    <button
                      type='button'
                      disabled
                      className='rounded border px-3 py-2 text-sm text-slate-400 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                      Sync now
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}
