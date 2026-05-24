// src/app/ledger/bank-entry/new/page.tsx

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, asc, eq, isNotNull } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankConnections } from '@/db/schema/bankConnection'
import { nominalCodes } from '@/db/schema/nominalLedger'
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'

import { BankEntryForm } from './_components/bank-entry-form'
import { projects, reserves, suppliers, vatRates } from '@/db/schema'

type SearchParams = {
  entryType?: string | string[]
}

function getInitialEntryType(value: string | string[] | undefined) {
  const entryType = Array.isArray(value) ? value[0] : value

  return entryType === 'RECEIPT' ? 'RECEIPT' : 'PAYMENT'
}

export default async function NewBankEntryPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>
}) {
  const params = await searchParams

  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login?next=/ledger/bank-entry/new')
  }

  const parishCouncilId = session.user.parishCouncilId

  const { financialYear } = await getSelectedFinancialYear(parishCouncilId)

  if (!financialYear) {
    redirect('/ledger')
  }

  if (financialYear.isClosed) {
    return (
      <main className='mx-auto max-w-420 px-6 py-8'>
        <div className='rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900'>
          <p className='font-medium'>
            Financial year {financialYear.label} is closed.
          </p>
          <p className='mt-1'>
            Cash and bank entries cannot be posted to a closed financial year.
            Select an open year from the header before entering new
            transactions.
          </p>
        </div>
      </main>
    )
  }

  const [
    bankAccounts,
    analysisCodes,
    supplierOptions,
    reserveOptions,
    projectOptions
  ] = await Promise.all([
    db
      .select({
        connectionId: bankConnections.id,
        accountName: bankConnections.accountName,
        accountLast4: bankConnections.accountLast4,
        nominalCodeId: bankConnections.nominalCodeId,
        nominalCode: nominalCodes.code,
        nominalName: nominalCodes.name
      })
      .from(bankConnections)
      .innerJoin(
        nominalCodes,
        eq(bankConnections.nominalCodeId, nominalCodes.id)
      )
      .where(
        and(
          eq(bankConnections.parishCouncilId, parishCouncilId),
          isNotNull(bankConnections.nominalCodeId),
          eq(nominalCodes.financialYearId, financialYear.id),
          eq(nominalCodes.isBank, true),
          eq(nominalCodes.isActive, true)
        )
      )
      .orderBy(asc(nominalCodes.code), asc(bankConnections.accountName)),

    db
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
      .orderBy(asc(nominalCodes.code)),

    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        vatNumber: suppliers.vatNumber,
        defaultGoodsSupplied: suppliers.defaultGoodsSupplied,
        defaultNominalCodeId: suppliers.defaultNominalCodeId,
        defaultReserveId: suppliers.defaultReserveId,
        defaultProjectId: suppliers.defaultProjectId
      })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.parishCouncilId, parishCouncilId),
          eq(suppliers.isActive, true)
        )
      )
      .orderBy(asc(suppliers.name)),

    db
      .select({
        id: reserves.id,
        code: reserves.code,
        name: reserves.name,
        isDefault: reserves.isDefault
      })
      .from(reserves)
      .where(
        and(
          eq(reserves.parishCouncilId, parishCouncilId),
          eq(reserves.isActive, true)
        )
      )
      .orderBy(asc(reserves.code), asc(reserves.name)),

    db
      .select({
        id: projects.id,
        reserveId: projects.reserveId,
        code: projects.code,
        name: projects.name
      })
      .from(projects)
      .where(
        and(
          eq(projects.parishCouncilId, parishCouncilId),
          eq(projects.isActive, true)
        )
      )
      .orderBy(asc(projects.code), asc(projects.name))
  ])

  const defaultReserveId =
    reserveOptions.find(reserve => reserve.isDefault)?.id ??
    reserveOptions[0]?.id ??
    ''

  const vatRateOptions = await db
    .select({
      id: vatRates.id,
      code: vatRates.code,
      name: vatRates.name,
      ratePercent: vatRates.ratePercent
    })
    .from(vatRates)
    .where(
      and(
        eq(vatRates.parishCouncilId, parishCouncilId),
        eq(vatRates.isActive, true)
      )
    )
    .orderBy(asc(vatRates.sortOrder), asc(vatRates.name))

  return (
    <main className='mx-auto max-w-420 px-6 py-8'>
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
        financialYear={{
          label: financialYear.label,
          startDate: financialYear.startDate,
          endDate: financialYear.endDate
        }}
        bankAccounts={bankAccounts.map(account => ({
          ...account,
          nominalCodeId: account.nominalCodeId ?? ''
        }))}
        nominalCodes={analysisCodes}
        suppliers={supplierOptions}
        reserves={reserveOptions}
        projects={projectOptions}
        defaultReserveId={defaultReserveId}
        vatRates={vatRateOptions}
        initialEntryType={getInitialEntryType(params?.entryType)}
      />
    </main>
  )
}
