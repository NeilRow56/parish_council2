// src/app/ledger/bank-entry/new/page.tsx

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, asc, eq, gte, isNotNull, lte } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankConnections } from '@/db/schema/bankConnection'
import { financialYears, nominalCodes } from '@/db/schema/nominalLedger'
import { BankEntryForm } from './_components/bank-entry-form'

export default async function NewBankEntryPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login?next=/ledger/bank-entry/new')
  }

  const parishCouncilId = session.user.parishCouncilId
  const today = new Date().toISOString().split('T')[0]

  const [financialYear] = await db
    .select({
      id: financialYears.id,
      label: financialYears.label
    })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        lte(financialYears.startDate, today),
        gte(financialYears.endDate, today),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1)

  if (!financialYear) {
    redirect('/ledger')
  }

  const bankAccounts = await db
    .select({
      connectionId: bankConnections.id,
      accountName: bankConnections.accountName,
      accountLast4: bankConnections.accountLast4,
      nominalCodeId: bankConnections.nominalCodeId,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name
    })
    .from(bankConnections)
    .innerJoin(nominalCodes, eq(bankConnections.nominalCodeId, nominalCodes.id))
    .where(
      and(
        eq(bankConnections.parishCouncilId, parishCouncilId),
        isNotNull(bankConnections.nominalCodeId),
        eq(nominalCodes.financialYearId, financialYear.id),
        eq(nominalCodes.isBank, true),
        eq(nominalCodes.isActive, true)
      )
    )
    .orderBy(asc(nominalCodes.code), asc(bankConnections.accountName))

  const analysisCodes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      category: nominalCodes.category,
      type: nominalCodes.type,
      isVatRecoverable: nominalCodes.isVatRecoverable,
      isVatPayable: nominalCodes.isVatPayable
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id),
        eq(nominalCodes.isActive, true),
        eq(nominalCodes.isBank, false),
        eq(nominalCodes.isVatRecoverable, false),
        eq(nominalCodes.isVatPayable, false)
      )
    )
    .orderBy(asc(nominalCodes.code))

  return (
    <main className='mx-auto max-w-7xl px-6 py-8'>
      <div className='mb-8'>
        <h1 className='text-2xl font-semibold tracking-tight'>
          New cash/bank entry
        </h1>
        <p className='mt-1 text-sm text-zinc-600'>
          Enter cash or bank receipts and payments. VAT will be split to the
          relevant VAT control accounts where applicable.
        </p>
        <p className='mt-2 text-sm text-zinc-500'>
          Financial year:{' '}
          <span className='font-medium text-zinc-700'>
            {financialYear.label}
          </span>
        </p>
      </div>

      <BankEntryForm
        financialYearId={financialYear.id}
        bankAccounts={bankAccounts.map(account => ({
          ...account,
          nominalCodeId: account.nominalCodeId ?? ''
        }))}
        nominalCodes={analysisCodes}
      />
    </main>
  )
}
