// src/app/(site)/reports/budget/page.tsx

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'

import {
  budgets,
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'
import { ExportPdfButton } from './_components/export-pdf-button'

type BudgetRow = {
  id: string
  code: string
  name: string
  type: 'INCOME' | 'EXPENDITURE' | 'BALANCE_SHEET'
  category: string | null
  actualAmount: number
  budget: number
  variance: number
  notes: string
}

function formatAmount(value: number) {
  if (value === 0) return '—'

  return value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatWholePounds(value: number) {
  if (value === 0) return '—'

  return Math.round(value).toLocaleString('en-GB')
}

function formatCurrency(value: number) {
  if (Math.round(value * 100) === 0) {
    return '—'
  }

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `£(${amount})` : `£${amount}`
}

async function saveBudget(formData: FormData) {
  'use server'

  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId
  const financialYearId = String(formData.get('financialYearId') ?? '')

  if (!financialYearId) {
    throw new Error('Missing financial year')
  }

  const [financialYear] = await db
    .select({ id: financialYears.id })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.id, financialYearId),
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1)

  if (!financialYear) {
    throw new Error('Budgets cannot be changed for a closed financial year.')
  }

  const entries = Array.from(formData.entries()).filter(([key]) =>
    key.startsWith('budget:')
  )

  for (const [key, value] of entries) {
    const nominalCodeId = key.replace('budget:', '')
    const rawValue = String(value ?? '').trim()
    const amount = rawValue === '' ? '0' : rawValue

    await db
      .insert(budgets)
      .values({
        parishCouncilId,
        financialYearId,
        nominalCodeId,
        amount
      })
      .onConflictDoUpdate({
        target: [
          budgets.parishCouncilId,
          budgets.financialYearId,
          budgets.nominalCodeId
        ],
        set: {
          amount
        }
      })
  }

  revalidatePath('/reports/budget')
}

type SearchParams = {
  financialYearId?: string
}

export default async function BudgetPage({
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
          label: financialYears.label,
          startDate: financialYears.startDate,
          endDate: financialYears.endDate,
          isClosed: financialYears.isClosed
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
          label: financialYears.label,
          startDate: financialYears.startDate,
          endDate: financialYears.endDate,
          isClosed: financialYears.isClosed
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

  const codes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
      type: nominalCodes.type,
      category: nominalCodes.category
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id),
        inArray(nominalCodes.type, ['INCOME', 'EXPENDITURE'])
      )
    )
    .orderBy(nominalCodes.type, nominalCodes.code)

  const actualRows = await db
    .select({
      nominalCodeId: journalLines.nominalCodeId,
      debit: sql<number>`coalesce(sum(${journalLines.debit}), 0)`,
      credit: sql<number>`coalesce(sum(${journalLines.credit}), 0)`
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalEntries.id, journalLines.journalEntryId)
    )
    .where(
      and(
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, financialYear.id)
      )
    )
    .groupBy(journalLines.nominalCodeId)

  const budgetRows = await db
    .select({
      nominalCodeId: budgets.nominalCodeId,
      amount: budgets.amount,
      notes: budgets.notes
    })
    .from(budgets)
    .where(
      and(
        eq(budgets.parishCouncilId, parishCouncilId),
        eq(budgets.financialYearId, financialYear.id)
      )
    )

  const actualsByCode = new Map(
    actualRows.map(row => [
      row.nominalCodeId,
      {
        debit: Number(row.debit ?? 0),
        credit: Number(row.credit ?? 0)
      }
    ])
  )

  const budgetsByCode = new Map(
    budgetRows.map(row => [
      row.nominalCodeId,
      {
        amount: Number(row.amount ?? 0),
        notes: row.notes ?? ''
      }
    ])
  )

  const rows = codes.map(code => {
    const actual = actualsByCode.get(code.id)
    const budget = budgetsByCode.get(code.id)

    const budgetAmount = budget?.amount ?? 0
    const notes = budget?.notes ?? ''

    const actualAmount =
      code.type === 'INCOME'
        ? (actual?.credit ?? 0) - (actual?.debit ?? 0)
        : (actual?.debit ?? 0) - (actual?.credit ?? 0)

    const variance = actualAmount - budgetAmount

    return {
      ...code,
      actualAmount,
      budget: budgetAmount,
      variance,
      notes
    }
  })

  const receiptRows = rows.filter(row => row.type === 'INCOME')
  const paymentRows = rows.filter(row => row.type === 'EXPENDITURE')

  const totalReceiptsActual = receiptRows.reduce(
    (sum, row) => sum + row.actualAmount,
    0
  )
  const totalReceiptsBudget = receiptRows.reduce(
    (sum, row) => sum + row.budget,
    0
  )

  const totalPaymentsActual = paymentRows.reduce(
    (sum, row) => sum + row.actualAmount,
    0
  )
  const totalPaymentsBudget = paymentRows.reduce(
    (sum, row) => sum + row.budget,
    0
  )

  const actualSurplus = totalReceiptsActual - totalPaymentsActual
  const budgetSurplus = totalReceiptsBudget - totalPaymentsBudget
  const exportHref = `/reports/budget/export?financialYearId=${financialYear.id}`

  return (
    <main className='mx-auto max-w-7xl px-6 py-8'>
      <div className='mb-8 flex items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>Budget</h1>
          <p className='mt-1 text-sm text-zinc-600'>
            Enter budget figures by nominal code and compare them with actual
            posted ledger movements.
          </p>
          <p className='mt-2 text-sm text-zinc-500'>
            Financial year:{' '}
            <span className='font-medium text-zinc-700'>
              {financialYear.label}
            </span>
          </p>
          {financialYear.isClosed ? (
            <p className='mt-1 text-sm text-zinc-500'>
              Closed year: budgets are read-only.
            </p>
          ) : null}
        </div>

        <ExportPdfButton href={exportHref} />
      </div>

      <form action={saveBudget}>
        <input type='hidden' name='financialYearId' value={financialYear.id} />

        {!financialYear.isClosed ? (
          <div className='mb-6 flex justify-end'>
            <button
              type='submit'
              className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
            >
              Save budget
            </button>
          </div>
        ) : null}

        <BudgetSection
          title='Receipts'
          rows={receiptRows}
          readOnly={financialYear.isClosed}
        />

        <div className='my-8' />

        <BudgetSection
          title='Payments'
          rows={paymentRows}
          readOnly={financialYear.isClosed}
        />

        <section className='mt-8 overflow-hidden rounded-lg border bg-white shadow-sm'>
          <table className='w-full table-fixed border-collapse text-sm'>
            <colgroup>
              <col className='w-28' />
              <col />
              <col className='w-56' />
              <col className='w-56' />
              <col className='w-56' />
            </colgroup>

            <tbody>
              <tr className='border-b bg-zinc-50 font-semibold'>
                <td className='px-4 py-3' colSpan={2}>
                  Total receipts
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(totalReceiptsActual)}
                </td>
                <td className='px-6.5 py-3 text-right'>
                  {formatWholePounds(totalReceiptsBudget)}
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatCurrency(totalReceiptsActual - totalReceiptsBudget)}
                </td>
              </tr>

              <tr className='border-b bg-zinc-50 font-semibold'>
                <td className='px-4 py-3' colSpan={2}>
                  Total payments
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatAmount(totalPaymentsActual)}
                </td>
                <td className='px-6.5 py-3 text-right'>
                  {formatWholePounds(totalPaymentsBudget)}
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatCurrency(totalPaymentsActual - totalPaymentsBudget)}
                </td>
              </tr>

              <tr className='bg-zinc-100 font-semibold'>
                <td className='px-4 py-3' colSpan={2}>
                  Excess income over expenditure
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatCurrency(actualSurplus)}
                </td>
                <td className='px-6.5 py-3 text-right'>
                  {formatWholePounds(budgetSurplus)}
                </td>
                <td className='px-4 py-3 text-right'>
                  {formatCurrency(actualSurplus - budgetSurplus)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
        <section className='mt-8 rounded-lg border bg-white shadow-sm'>
          <div className='border-b px-4 py-3'>
            <h2 className='text-sm font-semibold tracking-wide text-zinc-700 uppercase'>
              Budget notes
            </h2>
          </div>

          <div className='divide-y'>
            {rows.map(row => (
              <div
                key={row.id}
                className='grid grid-cols-[120px_220px_1fr] gap-4 px-4 py-4'
              >
                <div className='font-medium text-zinc-700'>{row.code}</div>

                <div>
                  <div className='font-medium'>{row.name}</div>
                  <div className='text-xs text-zinc-500'>{row.category}</div>
                </div>

                <textarea
                  name={`notes:${row.id}`}
                  defaultValue={row.notes ?? ''}
                  rows={2}
                  disabled={financialYear.isClosed}
                  className='w-full rounded-md border px-3 py-2 text-sm'
                  placeholder='Budget assumptions or commentary...'
                />
              </div>
            ))}
          </div>
        </section>
      </form>
    </main>
  )
}

function BudgetSection({
  title,
  rows,
  readOnly
}: {
  title: string
  rows: BudgetRow[]
  readOnly: boolean
}) {
  const totalActual = rows.reduce((sum, row) => sum + row.actualAmount, 0)
  const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0)
  const totalVariance = totalActual - totalBudget

  return (
    <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
      <div className='border-b bg-zinc-50 px-4 py-3'>
        <h2 className='text-sm font-semibold tracking-wide text-zinc-700 uppercase'>
          {title}
        </h2>
      </div>

      {rows.length === 0 ? (
        <div className='p-8 text-center text-sm text-zinc-500'>
          No nominal codes found.
        </div>
      ) : (
        <table className='w-full table-fixed border-collapse text-sm'>
          <colgroup>
            <col className='w-28' />
            <col />
            <col className='w-56' />
            <col className='w-56' />
            <col className='w-56' />
          </colgroup>

          <thead className='bg-white text-left text-zinc-600'>
            <tr>
              <th className='px-4 py-3 font-medium'>Code</th>
              <th className='px-4 py-3 font-medium'>Nominal code</th>
              <th className='px-4 py-3 text-right font-medium'>Actual (£)</th>
              <th className='px-4 py-3 text-right font-medium'>Budget (£)</th>
              <th className='px-4 py-3 text-right font-medium'>Variance (£)</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(row => (
              <tr key={row.id} className='border-t'>
                <td className='px-4 py-3 font-medium text-zinc-700'>
                  {row.code}
                </td>

                <td className='px-4 py-3'>
                  <div className='font-medium'>{row.name}</div>
                  {row.category ? (
                    <div className='text-xs text-zinc-500'>{row.category}</div>
                  ) : null}
                </td>

                <td className='px-4 py-3 text-right'>
                  {formatAmount(row.actualAmount)}
                </td>

                <td className='py-3 text-right'>
                  <input
                    name={`budget:${row.id}`}
                    type='number'
                    step='0.01'
                    min='0'
                    defaultValue={row.budget === 0 ? '' : row.budget}
                    disabled={readOnly}
                    className='w-40 rounded-md border px-3 py-2 text-right text-sm'
                    placeholder='0.00'
                  />
                </td>

                <td
                  className={
                    Math.round(row.variance * 100) === 0
                      ? 'px-4 py-3 text-right'
                      : 'px-4 py-3 text-right text-red-600'
                  }
                >
                  {formatCurrency(row.variance)}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className='border-t bg-zinc-50 font-semibold'>
            <tr>
              <td className='px-4 py-3' colSpan={2}>
                Total {title.toLowerCase()}
              </td>
              <td className='px-4 py-3 text-right'>
                {formatAmount(totalActual)}
              </td>
              <td className='px-6.5 py-3 text-right'>
                {formatWholePounds(totalBudget)}
              </td>

              <td
                className={
                  Math.round(totalVariance * 100) === 0
                    ? 'px-4 py-3 text-right'
                    : 'px-4 py-3 text-right text-red-600'
                }
              >
                {formatCurrency(totalVariance)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  )
}
