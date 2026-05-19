// src/app/reports/income-expenditure/page.tsx

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
  parishCouncils
} from '@/db/schema'
import { ExportPdfButton } from './_components/export-pdf-button'

function formatAmount(value: number) {
  if (value === 0) return '—'

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `(${amount})` : amount
}

function formatCurrency(value: number) {
  if (value === 0) return '£—'

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `£(${amount})` : `£${amount}`
}

type SearchParams = {
  financialYearId?: string
}

type AccountingBasis = 'RECEIPTS_AND_PAYMENTS' | 'INCOME_AND_EXPENDITURE'

type ReportRow = {
  nominalCodeId: string
  ledgerNominalCodeId: string
  code: string
  name: string
  type: 'INCOME' | 'EXPENDITURE'
  amount: number
}

function getEffectiveAccountingBasis(
  value: string | null | undefined
): AccountingBasis {
  if (value === 'RECEIPTS_AND_PAYMENTS') return 'RECEIPTS_AND_PAYMENTS'
  return 'INCOME_AND_EXPENDITURE'
}

function getAccountingBasisLabel(accountingBasis: AccountingBasis) {
  return accountingBasis === 'RECEIPTS_AND_PAYMENTS'
    ? 'Receipts and payments'
    : 'Income and expenditure (accruals basis)'
}

function isIncomeOrExpenditureType(
  type: string
): type is 'INCOME' | 'EXPENDITURE' {
  return type === 'INCOME' || type === 'EXPENDITURE'
}

export default async function IncomeExpenditurePage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>
}) {
  const params = await searchParams

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

  const [financialYear] = params?.financialYearId
    ? await db
        .select({
          id: financialYears.id,
          label: financialYears.label
        })
        .from(financialYears)
        .where(
          and(
            eq(financialYears.parishCouncilId, parishCouncilId),
            eq(financialYears.id, params.financialYearId)
          )
        )
        .limit(1)
    : await db
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
        .orderBy(desc(financialYears.startDate))
        .limit(1)

  if (!financialYear) {
    redirect('/')
  }

  const [council] = await db
    .select({
      accountingBasis: parishCouncils.accountingBasis
    })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  const accountingBasis = getEffectiveAccountingBasis(council?.accountingBasis)

  const rows = await db
    .select({
      nominalCodeId: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      type: nominalCodes.type,
      isVatRecoverable: nominalCodes.isVatRecoverable,
      isVatPayable: nominalCodes.isVatPayable,
      debit: sql<number>`
        coalesce(sum(
          case
            when ${journalEntries.id} is not null
            then ${journalLines.debit}
            else 0
          end
        ), 0)
      `,
      credit: sql<number>`
        coalesce(sum(
          case
            when ${journalEntries.id} is not null
            then ${journalLines.credit}
            else 0
          end
        ), 0)
      `
    })
    .from(nominalCodes)
    .leftJoin(journalLines, eq(journalLines.nominalCodeId, nominalCodes.id))
    .leftJoin(
      journalEntries,
      and(
        eq(journalEntries.id, journalLines.journalEntryId),
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, financialYear.id)
      )
    )
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id),
        accountingBasis === 'RECEIPTS_AND_PAYMENTS'
          ? sql`(${nominalCodes.type} in ('INCOME', 'EXPENDITURE') or ${nominalCodes.isVatRecoverable} = true or ${nominalCodes.isVatPayable} = true)`
          : inArray(nominalCodes.type, ['INCOME', 'EXPENDITURE'])
      )
    )
    .groupBy(
      nominalCodes.id,
      nominalCodes.code,
      nominalCodes.name,
      nominalCodes.type,
      nominalCodes.isVatRecoverable,
      nominalCodes.isVatPayable
    )
    .orderBy(nominalCodes.code)

  const reportRows = rows
    .filter(row => isIncomeOrExpenditureType(row.type))
    .map(row => {
      const debit = Number(row.debit ?? 0)
      const credit = Number(row.credit ?? 0)

      const amount = row.type === 'INCOME' ? credit - debit : debit - credit

      return {
        nominalCodeId: row.nominalCodeId,
        ledgerNominalCodeId: row.nominalCodeId,
        code: row.code,
        name: row.name,
        type: row.type as 'INCOME' | 'EXPENDITURE',
        amount
      }
    })

  const vatPresentationRows: ReportRow[] =
    accountingBasis === 'RECEIPTS_AND_PAYMENTS'
      ? rows.flatMap(row => {
          const debit = Number(row.debit ?? 0)
          const credit = Number(row.credit ?? 0)
          const presentationRows: ReportRow[] = []

          if (row.isVatRecoverable && debit > 0) {
            presentationRows.push({
              nominalCodeId: `${row.nominalCodeId}-vat-expenditure`,
              ledgerNominalCodeId: row.nominalCodeId,
              code: row.code,
              name: 'VAT recoverable included as expenditure',
              type: 'EXPENDITURE',
              amount: debit
            })
          }

          if ((row.isVatRecoverable || row.isVatPayable) && credit > 0) {
            presentationRows.push({
              nominalCodeId: `${row.nominalCodeId}-vat-income`,
              ledgerNominalCodeId: row.nominalCodeId,
              code: row.code,
              name: row.isVatRecoverable
                ? 'VAT reclaimed included as income'
                : 'Output VAT included as income',
              type: 'INCOME',
              amount: credit
            })
          }

          return presentationRows
        })
      : []

  const presentationRows = [...reportRows, ...vatPresentationRows]

  const incomeRows = presentationRows.filter(
    row => row.type === 'INCOME' && row.amount !== 0
  )

  const expenditureRows = presentationRows.filter(
    row => row.type === 'EXPENDITURE' && row.amount !== 0
  )

  const totalIncome = incomeRows.reduce((sum, row) => sum + row.amount, 0)
  const totalExpenditure = expenditureRows.reduce(
    (sum, row) => sum + row.amount,
    0
  )
  const surplusOrDeficit = totalIncome - totalExpenditure
  const exportHref = `/reports/income-expenditure/export?financialYearId=${financialYear.id}`

  return (
    <main className='mx-auto max-w-7xl px-6 py-8'>
      <div className='mb-8 flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            Income &amp; Expenditure
          </h1>
          <p className='mt-1 text-sm text-zinc-600'>
            Summary of income and expenditure for the selected financial year.
          </p>
          <p className='mt-2 text-sm text-zinc-500'>
            Financial year:{' '}
            <span className='font-medium text-zinc-700'>
              {financialYear.label}
            </span>
          </p>
          <p className='mt-1 text-sm text-zinc-500'>
            Accounting basis:{' '}
            <span className='font-medium text-zinc-700'>
              {getAccountingBasisLabel(accountingBasis)}
            </span>
          </p>
        </div>

        <div className='flex gap-2'>
          <ExportPdfButton href={exportHref} />

          <Link
            href='/ledger'
            className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
          >
            Back to ledger
          </Link>
        </div>
      </div>

      <div className='mb-6 grid gap-4 md:grid-cols-3'>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Total income</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatCurrency(totalIncome)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>Total expenditure</p>
          <p className='mt-1 text-2xl font-semibold'>
            {formatCurrency(totalExpenditure)}
          </p>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <p className='text-sm text-zinc-500'>
            {surplusOrDeficit >= 0 ? 'Surplus' : 'Deficit'}
          </p>
          <p
            className={
              surplusOrDeficit < 0
                ? 'mt-1 text-2xl font-semibold text-red-600'
                : 'mt-1 text-2xl font-semibold'
            }
          >
            {formatCurrency(surplusOrDeficit)}
          </p>
        </div>
      </div>

      <div className='space-y-6'>
        <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
          <div className='border-b bg-zinc-50 px-4 py-3'>
            <h2 className='font-semibold'>Income</h2>
          </div>

          <table className='w-full table-fixed border-collapse text-sm'>
            <colgroup>
              <col className='w-32' />
              <col />
              <col className='w-40' />
            </colgroup>
            <thead className='text-left text-zinc-600'>
              <tr>
                <th className='px-4 py-3 font-medium'>Code</th>
                <th className='px-4 py-3 font-medium'>Name</th>
                <th className='px-4 py-3 text-right font-medium'>Amount</th>
              </tr>
            </thead>

            <tbody>
              {incomeRows.map(row => (
                <tr key={row.nominalCodeId} className='border-t'>
                  <td className='px-4 py-3 font-medium'>
                    <Link
                      href={`/ledger/${row.ledgerNominalCodeId}`}
                      className='text-slate-900 hover:text-blue-600 hover:underline'
                    >
                      {row.code}
                    </Link>
                  </td>

                  <td className='px-4 py-3'>
                    <Link
                      href={`/ledger/${row.ledgerNominalCodeId}`}
                      className='text-slate-700 hover:text-blue-600 hover:underline'
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td
                    className={
                      row.amount < 0
                        ? 'px-4 py-3 text-right text-red-600'
                        : 'px-4 py-3 text-right'
                    }
                  >
                    {formatAmount(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot className='border-t bg-zinc-50 font-semibold'>
              <tr>
                <td className='px-4 py-3' colSpan={2}>
                  Total income
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(totalIncome)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
          <div className='border-b bg-zinc-50 px-4 py-3'>
            <h2 className='font-semibold'>Expenditure</h2>
          </div>

          <table className='w-full table-fixed border-collapse text-sm'>
            <colgroup>
              <col className='w-32' />
              <col />
              <col className='w-40' />
            </colgroup>
            <thead className='text-left text-zinc-600'>
              <tr>
                <th className='px-4 py-3 font-medium'>Code</th>
                <th className='px-4 py-3 font-medium'>Name</th>
                <th className='px-4 py-3 text-right font-medium'>Amount</th>
              </tr>
            </thead>

            <tbody>
              {expenditureRows.map(row => (
                <tr
                  key={row.nominalCodeId}
                  className='border-t transition-colors hover:bg-slate-50'
                >
                  <td className='px-4 py-3 font-medium'>
                    <Link
                      href={`/ledger/${row.ledgerNominalCodeId}`}
                      className='text-slate-900 hover:text-blue-600 hover:underline'
                    >
                      {row.code}
                    </Link>
                  </td>

                  <td className='px-4 py-3'>
                    <Link
                      href={`/ledger/${row.ledgerNominalCodeId}`}
                      className='text-slate-700 hover:text-blue-600 hover:underline'
                    >
                      {row.name}
                    </Link>
                  </td>

                  <td className='px-4 py-3 text-right'>
                    {formatAmount(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot className='border-t bg-zinc-50 font-semibold'>
              <tr>
                <td className='px-4 py-3' colSpan={2}>
                  Total expenditure
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(totalExpenditure)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className='rounded-lg border bg-white p-4 shadow-sm'>
          <div className='flex items-center justify-between text-sm'>
            <span className='font-semibold'>
              {surplusOrDeficit >= 0
                ? 'Surplus for the year'
                : 'Deficit for the year'}
            </span>
            <span
              className={
                surplusOrDeficit < 0
                  ? 'text-lg font-semibold text-red-600'
                  : 'text-lg font-semibold'
              }
            >
              {formatAmount(surplusOrDeficit)}
            </span>
          </div>
        </section>
      </div>
    </main>
  )
}
