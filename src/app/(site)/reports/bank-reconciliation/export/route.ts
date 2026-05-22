import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer
} from '@react-pdf/renderer'
import { and, desc, eq, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { createElement } from 'react'

import { db } from '@/db'
import {
  bankConnections,
  bankOpeningBalances,
  bankTransactions,
  parishCouncils
} from '@/db/schema'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
  nominalOpeningBalances
} from '@/db/schema/nominalLedger'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const h = createElement

type FinancialYear = {
  id: string
  label: string
  startDate: string
  endDate: string
  isClosed: boolean
}

type BankReconciliationRow = {
  connectionId: string | null
  accountLabel: string
  providerLabel: string
  nominalCode: string
  nominalName: string
  openingBalance: number
  inboxReceipts: number
  inboxPayments: number
  inboxNetMovement: number
  unmatchedManualNetMovement: number
  ledgerBalance: number
  adjustedBankBalance: number
  difference: number
}

type BankReconciliationReport = {
  councilName: string | null
  financialYear: FinancialYear
  rows: BankReconciliationRow[]
  totalInboxReceipts: number
  totalInboxPayments: number
  totalInboxNetMovement: number
  totalUnmatchedManualNetMovement: number
  totalLedgerBalance: number
  totalAdjustedBankBalance: number
  totalDifference: number
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

function formatAmount(value: number) {
  if (value === 0) return '—'

  return value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatCurrency(value: number) {
  if (value === 0) return '£—'

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)
}

function formatDifference(value: number) {
  if (value === 0) return '£—'

  const amount = Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return value < 0 ? `£(${amount})` : `£${amount}`
}

function escapeFilename(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: '#ffffff',
    color: '#111827',
    fontFamily: 'Helvetica',
    fontSize: 7.5
  },
  header: {
    marginBottom: 14
  },
  eyebrow: {
    marginBottom: 3,
    color: '#64748b',
    fontSize: 8,
    textTransform: 'uppercase'
  },
  title: {
    fontSize: 20,
    fontWeight: 700
  },
  subtitle: {
    marginTop: 5,
    color: '#475569',
    fontSize: 9
  },
  summary: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  summaryCard: {
    flex: 1,
    border: '1px solid #dbe3ee',
    borderRadius: 4,
    padding: 7
  },
  summaryLabel: {
    marginBottom: 4,
    color: '#64748b',
    fontSize: 7.5
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: 700
  },
  table: {
    border: '1px solid #dbe3ee',
    borderBottom: 0
  },
  row: {
    flexDirection: 'row',
    borderBottom: '1px solid #dbe3ee',
    minHeight: 22
  },
  headerRow: {
    backgroundColor: '#f8fafc'
  },
  totalRow: {
    backgroundColor: '#f8fafc'
  },
  sectionTitle: {
    marginBottom: 5,
    fontSize: 9,
    fontWeight: 700
  },
  cell: {
    paddingHorizontal: 4,
    paddingVertical: 5
  },
  headerCell: {
    color: '#475569',
    fontSize: 7,
    fontWeight: 700
  },
  accountCell: {
    width: 126
  },
  nominalCell: {
    width: 112
  },
  moneyCell: {
    width: 68,
    textAlign: 'right'
  },
  wideMoneyCell: {
    width: 82,
    textAlign: 'right'
  },
  totalLabelCell: {
    flex: 1,
    fontWeight: 700
  },
  totalMoneyCell: {
    width: 68,
    fontWeight: 700,
    textAlign: 'right'
  },
  totalWideMoneyCell: {
    width: 82,
    fontWeight: 700,
    textAlign: 'right'
  },
  muted: {
    color: '#64748b',
    fontSize: 7
  },
  pageNumber: {
    position: 'absolute',
    right: 28,
    bottom: 18,
    color: '#64748b',
    fontSize: 8
  }
})

async function getFinancialYear({
  parishCouncilId,
  financialYearId
}: {
  parishCouncilId: string
  financialYearId?: string
}) {
  const [financialYear] = financialYearId
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
            eq(financialYears.id, financialYearId),
            eq(financialYears.parishCouncilId, parishCouncilId)
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

  return financialYear ?? null
}

async function getBankReconciliationReport({
  parishCouncilId,
  financialYear
}: {
  parishCouncilId: string
  financialYear: FinancialYear
}): Promise<BankReconciliationReport> {
  const [council] = await db
    .select({ name: parishCouncils.name })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  const accounts = await db
    .select({
      connectionId: bankConnections.id,
      providerName: bankConnections.providerName,
      accountName: bankConnections.accountName,
      accountLast4: bankConnections.accountLast4,
      nominalCodeId: nominalCodes.id,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name,
      nominalOpeningBalance: sql<number>`coalesce(max(${nominalOpeningBalances.amount}), 0)`,
      bankOpeningBalance: sql<number>`coalesce(max(${bankOpeningBalances.openingBalance}), 0)`,
      ledgerDebit: sql<number>`
        coalesce(
          sum(
            case
              when ${journalEntries.id} is not null
              then ${journalLines.debit}
              else 0
            end
          ),
          0
        )
      `,
      ledgerCredit: sql<number>`
        coalesce(
          sum(
            case
              when ${journalEntries.id} is not null
              then ${journalLines.credit}
              else 0
            end
          ),
          0
        )
      `
    })
    .from(nominalCodes)
    .leftJoin(
      bankConnections,
      eq(bankConnections.nominalCodeId, nominalCodes.id)
    )
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
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, financialYear.id)
      )
    )
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id),
        eq(nominalCodes.isBank, true)
      )
    )
    .groupBy(
      bankConnections.id,
      bankConnections.providerName,
      bankConnections.accountName,
      bankConnections.sortCode,
      bankConnections.accountLast4,
      bankConnections.nominalCodeId,
      nominalCodes.id,
      nominalCodes.code,
      nominalCodes.name
    )
    .orderBy(nominalCodes.code)

  const inboxItems = await db
    .select({
      connectionId: bankTransactions.connectionId,
      amount: bankTransactions.amount,
      transactionType: bankTransactions.transactionType
    })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.parishCouncilId, parishCouncilId),
        inArray(bankTransactions.status, ['PENDING', 'CODED']),
        lte(bankTransactions.date, financialYear.endDate)
      )
    )
    .orderBy(desc(bankTransactions.date), desc(bankTransactions.importedAt))

  const matchedJournalRows = await db
    .select({
      journalEntryId: bankTransactions.matchedJournalEntryId
    })
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

  const manualBankLedgerItems = (
    await db
      .select({
        journalEntryId: journalEntries.id,
        nominalCodeId: nominalCodes.id,
        debit: journalLines.debit,
        credit: journalLines.credit
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
          eq(journalEntries.financialYearId, financialYear.id),
          eq(journalEntries.source, 'MANUAL'),
          eq(nominalCodes.isBank, true),
          isNull(journalLines.clearedAt),
          lte(journalEntries.date, financialYear.endDate)
        )
      )
  ).filter(item => !matchedJournalEntryIds.has(item.journalEntryId))

  const rows = accounts.map(account => {
    const accountInboxItems =
      account.connectionId
        ? inboxItems.filter(
            item => String(item.connectionId) === String(account.connectionId)
          )
        : []

    const accountLabel =
      account.accountName ||
      (account.nominalCode
        ? `${account.nominalCode} — ${account.nominalName}`
        : 'Bank account')

    const providerLabel = account.providerName
      ? `${account.providerName}${account.accountLast4 ? ` · ${account.accountLast4}` : ''}`
      : financialYear.isClosed
        ? 'Historic bank nominal code'
        : 'No linked bank connection'

    const inboxReceipts = accountInboxItems.reduce((sum, item) => {
      const amount = Math.abs(Number(item.amount ?? 0))
      const type = item.transactionType?.toUpperCase()

      return type === 'CREDIT' ? sum + amount : sum
    }, 0)

    const inboxPayments = accountInboxItems.reduce((sum, item) => {
      const amount = Math.abs(Number(item.amount ?? 0))
      const type = item.transactionType?.toUpperCase()

      return type === 'DEBIT' ? sum + amount : sum
    }, 0)

    const inboxNetMovement = inboxReceipts - inboxPayments
    const accountManualBankLedgerItems = manualBankLedgerItems.filter(
      item => String(item.nominalCodeId) === String(account.nominalCodeId)
    )
    const unmatchedManualNetMovement = accountManualBankLedgerItems.reduce(
      (sum, item) => sum + Number(item.credit ?? 0) - Number(item.debit ?? 0),
      0
    )
    const ledgerDebit = Number(account.ledgerDebit ?? 0)
    const ledgerCredit = Number(account.ledgerCredit ?? 0)
    const nominalOpeningBalance = Number(account.nominalOpeningBalance ?? 0)
    const bankOpeningBalance = Number(account.bankOpeningBalance ?? 0)
    const openingBalance =
      nominalOpeningBalance !== 0 ? nominalOpeningBalance : bankOpeningBalance
    const ledgerBalance = openingBalance + ledgerDebit - ledgerCredit
    const difference = inboxNetMovement + unmatchedManualNetMovement
    const adjustedBankBalance = ledgerBalance + difference

    return {
      connectionId: account.connectionId,
      accountLabel,
      providerLabel,
      nominalCode: account.nominalCode,
      nominalName: account.nominalName,
      openingBalance,
      inboxReceipts,
      inboxPayments,
      inboxNetMovement,
      unmatchedManualNetMovement,
      ledgerBalance,
      adjustedBankBalance,
      difference
    }
  })

  const totalInboxReceipts = rows.reduce(
    (sum, row) => sum + row.inboxReceipts,
    0
  )
  const totalInboxPayments = rows.reduce(
    (sum, row) => sum + row.inboxPayments,
    0
  )
  const totalInboxNetMovement = rows.reduce(
    (sum, row) => sum + row.inboxNetMovement,
    0
  )
  const totalUnmatchedManualNetMovement = rows.reduce(
    (sum, row) => sum + row.unmatchedManualNetMovement,
    0
  )
  const totalLedgerBalance = rows.reduce(
    (sum, row) => sum + row.ledgerBalance,
    0
  )
  const totalAdjustedBankBalance = rows.reduce(
    (sum, row) => sum + row.adjustedBankBalance,
    0
  )
  const totalDifference = totalInboxNetMovement + totalUnmatchedManualNetMovement

  return {
    councilName: council?.name ?? null,
    financialYear,
    rows,
    totalInboxReceipts,
    totalInboxPayments,
    totalInboxNetMovement,
    totalUnmatchedManualNetMovement,
    totalLedgerBalance,
    totalAdjustedBankBalance,
    totalDifference
  }
}

function summaryCard(label: string, value: string) {
  return h(
    View,
    { style: styles.summaryCard },
    h(Text, { style: styles.summaryLabel }, label),
    h(Text, { style: styles.summaryValue }, value)
  )
}

function reportRow(row: BankReconciliationRow) {
  return h(
    View,
    { key: row.nominalCode, style: styles.row, wrap: false },
    h(
      View,
      { style: [styles.cell, styles.accountCell] },
      h(Text, null, row.accountLabel),
      h(Text, { style: styles.muted }, row.providerLabel),
      row.openingBalance !== 0
        ? h(
            Text,
            { style: styles.muted },
            `Opening balance: ${formatCurrency(row.openingBalance)}`
          )
        : null
    ),
    h(
      Text,
      { style: [styles.cell, styles.nominalCell] },
      `${row.nominalCode} — ${row.nominalName}`
    ),
    h(
      Text,
      { style: [styles.cell, styles.moneyCell] },
      formatAmount(row.inboxReceipts)
    ),
    h(
      Text,
      { style: [styles.cell, styles.moneyCell] },
      formatAmount(row.inboxPayments)
    ),
    h(
      Text,
      { style: [styles.cell, styles.moneyCell] },
      formatDifference(row.inboxNetMovement).replace('£', '')
    ),
    h(
      Text,
      { style: [styles.cell, styles.moneyCell] },
      formatDifference(row.unmatchedManualNetMovement).replace('£', '')
    ),
    h(
      Text,
      { style: [styles.cell, styles.moneyCell] },
      formatDifference(row.difference).replace('£', '')
    ),
    h(Text, { style: [styles.cell, styles.moneyCell] }, formatAmount(row.ledgerBalance)),
    h(
      Text,
      { style: [styles.cell, styles.wideMoneyCell] },
      formatAmount(row.adjustedBankBalance)
    )
  )
}

function bankReconciliationPdf(report: BankReconciliationReport) {
  return h(
    Document,
    {
      title: `Bank Reconciliation - ${report.financialYear.label}`,
      author: report.councilName ?? undefined
    },
    h(
      Page,
      { size: 'A4', orientation: 'landscape', style: styles.page },
      h(
        View,
        { style: styles.header },
        report.councilName
          ? h(Text, { style: styles.eyebrow }, report.councilName)
          : null,
        h(Text, { style: styles.title }, 'Bank Reconciliation'),
        h(
          Text,
          { style: styles.subtitle },
          `Financial year ${report.financialYear.label} - ${formatDate(
            report.financialYear.startDate
          )} to ${formatDate(report.financialYear.endDate)}${
            report.financialYear.isClosed ? ' - Closed / read-only' : ''
          }`
        )
      ),
      h(
        View,
        { style: styles.summary },
        summaryCard('Inbox receipts', formatCurrency(report.totalInboxReceipts)),
        summaryCard('Inbox payments', formatCurrency(report.totalInboxPayments)),
        summaryCard(
          'Uncleared manual',
          formatDifference(report.totalUnmatchedManualNetMovement)
        ),
        summaryCard(
          'Reconciliation difference',
          formatDifference(report.totalDifference)
        ),
        summaryCard(
          'Adjusted bank balance',
          formatCurrency(report.totalAdjustedBankBalance)
        )
      ),
      h(
        View,
        { style: [styles.table, { marginBottom: 14 }] },
        h(Text, { style: [styles.cell, styles.sectionTitle] }, 'Adjusted bank balance breakdown'),
        h(
          View,
          { style: [styles.row, styles.headerRow], fixed: true },
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.accountCell] },
            'Bank account'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Ledger'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Inbox net'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Manual net'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.wideMoneyCell] },
            'Adjusted bank'
          )
        ),
        ...report.rows.map(row =>
          h(
            View,
            { key: `adjusted-${row.nominalCode}`, style: styles.row, wrap: false },
            h(
              View,
              { style: [styles.cell, styles.accountCell] },
              h(Text, null, row.accountLabel),
              h(Text, { style: styles.muted }, row.nominalCode)
            ),
            h(
              Text,
              { style: [styles.cell, styles.moneyCell] },
              formatAmount(row.ledgerBalance)
            ),
            h(
              Text,
              { style: [styles.cell, styles.moneyCell] },
              formatDifference(row.inboxNetMovement).replace('£', '')
            ),
            h(
              Text,
              { style: [styles.cell, styles.moneyCell] },
              formatDifference(row.unmatchedManualNetMovement).replace('£', '')
            ),
            h(
              Text,
              { style: [styles.cell, styles.wideMoneyCell] },
              formatAmount(row.adjustedBankBalance)
            )
          )
        ),
        h(
          View,
          { style: [styles.row, styles.totalRow], wrap: false },
          h(
            Text,
            { style: [styles.cell, styles.accountCell, { fontWeight: 700 }] },
            'Total'
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatAmount(report.totalLedgerBalance)
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatDifference(report.totalInboxNetMovement).replace('£', '')
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatDifference(report.totalUnmatchedManualNetMovement).replace(
              '£',
              ''
            )
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalWideMoneyCell] },
            formatAmount(report.totalAdjustedBankBalance)
          )
        )
      ),
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: [styles.row, styles.headerRow], fixed: true },
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.accountCell] },
            'Bank account'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.nominalCell] },
            'Nominal code'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Inbox receipts'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Inbox payments'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Inbox net'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Manual net'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Recon. diff.'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.moneyCell] },
            'Ledger balance'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.wideMoneyCell] },
            'Adjusted bank'
          )
        ),
        report.rows.length > 0
          ? report.rows.map(reportRow)
          : h(
              View,
              { style: styles.row },
              h(
                Text,
                { style: [styles.cell, styles.totalLabelCell] },
                'No bank nominal codes found for this financial year.'
              )
            ),
        h(
          View,
          { style: [styles.row, styles.totalRow], wrap: false },
          h(
            Text,
            { style: [styles.cell, styles.accountCell, { fontWeight: 700 }] },
            'Totals'
          ),
          h(Text, { style: [styles.cell, styles.nominalCell] }, ''),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatAmount(report.totalInboxReceipts)
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatAmount(report.totalInboxPayments)
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatDifference(report.totalInboxNetMovement).replace('£', '')
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatDifference(report.totalUnmatchedManualNetMovement).replace(
              '£',
              ''
            )
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatDifference(report.totalDifference).replace('£', '')
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalMoneyCell] },
            formatAmount(report.totalLedgerBalance)
          ),
          h(
            Text,
            { style: [styles.cell, styles.totalWideMoneyCell] },
            formatAmount(report.totalAdjustedBankBalance)
          )
        )
      ),
      h(Text, {
        style: styles.pageNumber,
        render: ({
          pageNumber,
          totalPages
        }: {
          pageNumber: number
          totalPages: number
        }) => `Page ${pageNumber} of ${totalPages}`,
        fixed: true
      })
    )
  )
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return new Response('Unauthorised', { status: 401 })
  }

  const parishCouncilId = session.user.parishCouncilId
  const { searchParams } = new URL(request.url)
  const financialYearId = searchParams.get('financialYearId')

  const financialYear = await getFinancialYear({
    parishCouncilId,
    financialYearId: financialYearId ?? undefined
  })

  if (!financialYear) {
    return new Response('Financial year not found', { status: 404 })
  }

  const report = await getBankReconciliationReport({
    parishCouncilId,
    financialYear
  })

  const pdf = await renderToBuffer(bankReconciliationPdf(report))
  const pdfBody = new ArrayBuffer(pdf.byteLength)
  new Uint8Array(pdfBody).set(pdf)
  const filename = `bank-reconciliation-${escapeFilename(financialYear.label)}.pdf`

  return new Response(pdfBody, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
