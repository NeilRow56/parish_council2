import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  and,
  eq,
  isNotNull,
  isNull,
  lte,
  sql
} from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { user } from '@/db/schema/authSchema'
import { bankOpeningBalances, bankTransactions } from '@/db/schema'
import {
  bankReconciliations,
  journalEntries,
  journalLines,
  nominalCodes,
  nominalOpeningBalances
} from '@/db/schema/nominalLedger'
import { getSelectedFinancialYear } from '@/lib/financial-years/selected-year'
import {
  ManualReconciliationPanel,
  type ManualBankLine
} from './_components/manual-reconciliation-panel'

type SearchParams = {
  bankNominalCodeId?: string
  statementDate?: string
}

function getStatementDate({
  input,
  startDate,
  endDate
}: {
  input?: string
  startDate: string
  endDate: string
}) {
  const today = new Date().toISOString().slice(0, 10)
  const fallback = today < startDate || today > endDate ? endDate : today

  if (!input || input < startDate || input > endDate) {
    return fallback
  }

  return input
}

export default async function ManualReconciliationPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>
}) {
  const params = await searchParams
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId

  const { financialYear } = await getSelectedFinancialYear(parishCouncilId)

  if (!financialYear) {
    return (
      <main className='mx-auto max-w-5xl px-6 py-8'>
        <div className='rounded-lg border bg-white p-8 text-sm text-slate-600 shadow-sm'>
          Open a financial year before reconciling manual bank items.{' '}
          <Link
            href='/settings/financial-years'
            className='font-medium text-emerald-800 hover:underline'
          >
            Manage financial years
          </Link>
          .
        </div>
      </main>
    )
  }

  if (financialYear.isClosed) {
    return (
      <main className='mx-auto max-w-5xl px-6 py-8'>
        <div className='rounded-lg border border-amber-200 bg-amber-50 p-8 text-sm text-amber-900'>
          <p className='font-medium'>
            Financial year {financialYear.label} is closed.
          </p>
          <p className='mt-1'>
            Manual reconciliation cannot be edited for a closed financial year.
            View the bank reconciliation report instead, or select an open year
            from the header.
          </p>
          <Link
            href={`/reports/bank-reconciliation?financialYearId=${financialYear.id}`}
            className='mt-3 inline-flex font-medium text-emerald-800 hover:underline'
          >
            View bank reconciliation report
          </Link>
        </div>
      </main>
    )
  }

  const statementDate = getStatementDate({
    input: params?.statementDate,
    startDate: financialYear.startDate,
    endDate: financialYear.endDate
  })

  const bankAccounts = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id),
        eq(nominalCodes.isBank, true),
        eq(nominalCodes.isActive, true)
      )
    )
    .orderBy(nominalCodes.code)

  if (!bankAccounts.length) {
    return (
      <main className='mx-auto max-w-5xl px-6 py-8'>
        <div className='rounded-lg border bg-white p-8 text-sm text-slate-600 shadow-sm'>
          No active bank nominal codes are configured for {financialYear.label}.
        </div>
      </main>
    )
  }

  const selectedAccount =
    bankAccounts.find(account => account.id === params?.bankNominalCodeId) ??
    bankAccounts[0]

  const [balanceRow] = await db
    .select({
      nominalOpeningBalance: sql<number>`coalesce(max(${nominalOpeningBalances.amount}), 0)`,
      bankOpeningBalance: sql<number>`coalesce(max(${bankOpeningBalances.openingBalance}), 0)`,
      debit: sql<number>`
        coalesce(
          sum(case when ${journalEntries.id} is not null then ${journalLines.debit} else 0 end),
          0
        )
      `,
      credit: sql<number>`
        coalesce(
          sum(case when ${journalEntries.id} is not null then ${journalLines.credit} else 0 end),
          0
        )
      `
    })
    .from(nominalCodes)
    .leftJoin(
      nominalOpeningBalances,
      and(
        eq(nominalOpeningBalances.nominalCodeId, nominalCodes.id),
        eq(nominalOpeningBalances.financialYearId, financialYear.id),
        eq(nominalOpeningBalances.parishCouncilId, parishCouncilId)
      )
    )
    .leftJoin(
      bankOpeningBalances,
      and(
        eq(bankOpeningBalances.nominalCodeId, nominalCodes.id),
        eq(bankOpeningBalances.financialYearId, financialYear.id),
        eq(bankOpeningBalances.parishCouncilId, parishCouncilId)
      )
    )
    .leftJoin(journalLines, eq(journalLines.nominalCodeId, nominalCodes.id))
    .leftJoin(
      journalEntries,
      and(
        eq(journalEntries.id, journalLines.journalEntryId),
        eq(journalEntries.financialYearId, financialYear.id),
        eq(journalEntries.parishCouncilId, parishCouncilId),
        lte(journalEntries.date, statementDate)
      )
    )
    .where(
      and(
        eq(nominalCodes.id, selectedAccount.id),
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id)
      )
    )
    .groupBy(nominalCodes.id)

  const matchedJournalRows = await db
    .select({ journalEntryId: bankTransactions.matchedJournalEntryId })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.parishCouncilId, parishCouncilId),
        isNotNull(bankTransactions.matchedJournalEntryId)
      )
    )

  const matchedJournalEntryIds = new Set(
    matchedJournalRows
      .map(row => row.journalEntryId)
      .filter((id): id is string => Boolean(id))
  )

  const lines: ManualBankLine[] = (
    await db
      .select({
        id: journalLines.id,
        journalEntryId: journalEntries.id,
        date: journalEntries.date,
        reference: journalEntries.reference,
        description: journalEntries.description,
        debit: journalLines.debit,
        credit: journalLines.credit
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
      .where(
        and(
          eq(journalLines.parishCouncilId, parishCouncilId),
          eq(journalLines.nominalCodeId, selectedAccount.id),
          isNull(journalLines.clearedAt),
          eq(journalEntries.parishCouncilId, parishCouncilId),
          eq(journalEntries.financialYearId, financialYear.id),
          eq(journalEntries.source, 'MANUAL'),
          lte(journalEntries.date, statementDate)
        )
      )
      .orderBy(journalEntries.date, journalEntries.createdAt)
  )
    .filter(line => !matchedJournalEntryIds.has(line.journalEntryId))
    .map(line => ({
      id: line.id,
      date: line.date,
      reference: line.reference,
      description: line.description,
      debit: line.debit,
      credit: line.credit
    }))

  const nominalOpeningBalance = Number(balanceRow?.nominalOpeningBalance ?? 0)
  const bankOpeningBalance = Number(balanceRow?.bankOpeningBalance ?? 0)
  const openingBalance =
    nominalOpeningBalance !== 0 ? nominalOpeningBalance : bankOpeningBalance
  const ledgerBalance =
    openingBalance +
    Number(balanceRow?.debit ?? 0) -
    Number(balanceRow?.credit ?? 0)

  const [statementEvidence] = await db
    .select({
      id: bankReconciliations.id,
      statementBalance: bankReconciliations.statementBalance,
      statementAttachmentUrl: bankReconciliations.statementAttachmentUrl,
      statementAttachmentName: bankReconciliations.statementAttachmentName,
      statementAttachmentKey: bankReconciliations.statementAttachmentKey,
      reconciledAt: bankReconciliations.reconciledAt,
      reconciledByName: user.name
    })
    .from(bankReconciliations)
    .leftJoin(user, eq(user.id, bankReconciliations.reconciledByUserId))
    .where(
      and(
        eq(bankReconciliations.parishCouncilId, parishCouncilId),
        eq(bankReconciliations.financialYearId, financialYear.id),
        eq(bankReconciliations.bankNominalCodeId, selectedAccount.id),
        eq(bankReconciliations.statementDate, statementDate)
      )
    )
    .limit(1)

  return (
    <main className='mx-auto max-w-7xl px-6 py-8'>
      <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight text-slate-950'>
            Manual bank reconciliation
          </h1>
          <p className='mt-1 max-w-3xl text-sm text-slate-600'>
            Mark manual bank receipts and payments cleared when they appear on
            the bank statement. Posting and ledger balances stay unchanged.
          </p>
        </div>
        <Link
          href='/reports/bank-reconciliation'
          className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-emerald-50/40'
        >
          Bank Reconciliation
        </Link>
      </div>

      <ManualReconciliationPanel
        key={`${selectedAccount.id}:${statementDate}`}
        accounts={bankAccounts.map(account => ({
          id: account.id,
          label: `${account.code} — ${account.name}`
        }))}
        selectedAccountId={selectedAccount.id}
        selectedAccountLabel={`${selectedAccount.code} — ${selectedAccount.name}`}
        financialYearId={financialYear.id}
        financialYearLabel={financialYear.label}
        statementDate={statementDate}
        statementBalance={statementEvidence?.statementBalance ?? ''}
        statementEvidence={statementEvidence ?? null}
        ledgerBalance={ledgerBalance}
        lines={lines}
      />
    </main>
  )
}
