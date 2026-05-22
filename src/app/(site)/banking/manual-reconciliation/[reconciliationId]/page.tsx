import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { user } from '@/db/schema/authSchema'
import {
  bankReconciliations,
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'
import {
  ReconciliationLinesPanel,
  type ReconciledBankLine
} from './_components/reconciliation-lines-panel'

function formatCurrency(value: string | number | null) {
  if (value === null) return 'Not entered'

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(Number(value))
}

function formatTimestamp(value: Date | null) {
  if (!value) return 'Not reconciled yet'

  return value.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export default async function ManualReconciliationDetailPage({
  params
}: {
  params: Promise<{ reconciliationId: string }>
}) {
  const { reconciliationId } = await params
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId

  const [reconciliation] = await db
    .select({
      id: bankReconciliations.id,
      statementDate: bankReconciliations.statementDate,
      statementBalance: bankReconciliations.statementBalance,
      statementAttachmentUrl: bankReconciliations.statementAttachmentUrl,
      statementAttachmentName: bankReconciliations.statementAttachmentName,
      reconciledAt: bankReconciliations.reconciledAt,
      reconciledByName: user.name,
      createdAt: bankReconciliations.createdAt,
      updatedAt: bankReconciliations.updatedAt,
      financialYearLabel: financialYears.label,
      financialYearClosed: financialYears.isClosed,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name
    })
    .from(bankReconciliations)
    .innerJoin(
      financialYears,
      eq(financialYears.id, bankReconciliations.financialYearId)
    )
    .innerJoin(
      nominalCodes,
      eq(nominalCodes.id, bankReconciliations.bankNominalCodeId)
    )
    .leftJoin(user, eq(user.id, bankReconciliations.reconciledByUserId))
    .where(
      and(
        eq(bankReconciliations.id, reconciliationId),
        eq(bankReconciliations.parishCouncilId, parishCouncilId),
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(nominalCodes.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!reconciliation) {
    notFound()
  }

  const lines: ReconciledBankLine[] = await db
    .select({
      id: journalLines.id,
      journalEntryId: journalEntries.id,
      date: journalEntries.date,
      reference: journalEntries.reference,
      description: journalEntries.description,
      debit: journalLines.debit,
      credit: journalLines.credit,
      reconciliationReference: journalLines.reconciliationReference
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
    .where(
      and(
        eq(journalLines.parishCouncilId, parishCouncilId),
        eq(journalLines.reconciliationId, reconciliation.id),
        eq(journalEntries.parishCouncilId, parishCouncilId)
      )
    )
    .orderBy(journalEntries.date, journalEntries.createdAt)

  const clearedReceipts = lines.reduce(
    (sum, line) => sum + Number(line.debit ?? 0),
    0
  )
  const clearedPayments = lines.reduce(
    (sum, line) => sum + Number(line.credit ?? 0),
    0
  )

  return (
    <main className='mx-auto max-w-7xl px-6 py-8'>
      <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight text-slate-950'>
            Manual reconciliation detail
          </h1>
          <p className='mt-1 text-sm text-slate-600'>
            {reconciliation.nominalCode} — {reconciliation.nominalName} ·{' '}
            {reconciliation.financialYearLabel}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Link
            href='/reports/bank-reconciliation'
            className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-emerald-50/40'
          >
            Bank Reconciliation
          </Link>
          {!reconciliation.financialYearClosed ? (
            <Link
              href='/banking/manual-reconciliation'
              className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-emerald-50/40'
            >
              Manual reconciliation
            </Link>
          ) : null}
        </div>
      </div>

      <section className='mb-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]'>
        <div className='rounded-lg border bg-white p-5 shadow-sm'>
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
            <div>
              <p className='text-sm text-slate-500'>Statement date</p>
              <p className='mt-1 font-semibold text-slate-950'>
                {reconciliation.statementDate}
              </p>
            </div>
            <div>
              <p className='text-sm text-slate-500'>Statement balance</p>
              <p className='mt-1 font-semibold text-slate-950'>
                {formatCurrency(reconciliation.statementBalance)}
              </p>
            </div>
            <div>
              <p className='text-sm text-slate-500'>Cleared receipts</p>
              <p className='mt-1 font-semibold text-slate-950'>
                {formatCurrency(clearedReceipts)}
              </p>
            </div>
            <div>
              <p className='text-sm text-slate-500'>Cleared payments</p>
              <p className='mt-1 font-semibold text-slate-950'>
                {formatCurrency(clearedPayments)}
              </p>
            </div>
          </div>
          <p className='mt-4 border-t pt-3 text-sm text-slate-600'>
            Reconciled {formatTimestamp(reconciliation.reconciledAt)}
            {reconciliation.reconciledByName
              ? ` by ${reconciliation.reconciledByName}`
              : ''}
            . The statement difference at the time of reconciliation is not
            stored separately.
          </p>
        </div>

        <div className='rounded-lg border bg-white p-5 shadow-sm'>
          <p className='text-sm font-medium text-slate-950'>Statement PDF</p>
          {reconciliation.statementAttachmentUrl ? (
            <a
              href={reconciliation.statementAttachmentUrl}
              target='_blank'
              rel='noreferrer'
              title={reconciliation.statementAttachmentName ?? undefined}
              className='mt-2 inline-block font-medium text-blue-700 hover:underline'
            >
              Open statement
            </a>
          ) : (
            <p className='mt-2 text-sm text-slate-600'>No PDF attached.</p>
          )}
          <p className='mt-4 text-xs text-slate-500'>
            Created {formatTimestamp(reconciliation.createdAt)} · Updated{' '}
            {formatTimestamp(reconciliation.updatedAt)}
          </p>
          {reconciliation.financialYearClosed ? (
            <p className='mt-3 rounded-md bg-emerald-50/40 px-3 py-2 text-sm text-slate-700'>
              This financial year is closed and clearing is read-only.
            </p>
          ) : null}
        </div>
      </section>

      <ReconciliationLinesPanel
        reconciliationId={reconciliation.id}
        lines={lines}
        canUndo={!reconciliation.financialYearClosed}
      />
    </main>
  )
}
