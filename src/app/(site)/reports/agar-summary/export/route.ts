import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer
} from '@react-pdf/renderer'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { createElement } from 'react'

import { db } from '@/db'
import { parishCouncils } from '@/db/schema'
import {
  calculateBox7Box8Reconciliation,
  calculateReceiptsAndPaymentsTotals,
  getEffectiveAccountingBasis,
  type AgarTotals,
  type AccountingBasis,
  type Box7Box8CurrentBalance,
  type Box7Box8Reconciliation
} from '@/lib/reports/agar'
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
}

type AgarRow = {
  box: string
  label: string
  guidance: string
  amount: number
}

type AgarReport = {
  councilName: string | null
  financialYear: FinancialYear
  accountingBasis: AccountingBasis
  rows: AgarRow[]
  box7Box8Reconciliation: Box7Box8Reconciliation | null
}

function formatWholePounds(value: number) {
  return new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 0
  }).format(Math.round(value))
}

function formatSignedWholePounds(value: number) {
  const formatted = formatWholePounds(Math.abs(value))

  if (value > 0) return `+£${formatted}`
  if (value < 0) return `-£${formatted}`
  return '£0'
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value))
}

function normalise(value: unknown) {
  return Number(value ?? 0)
}

function getAccountingBasisLabel(accountingBasis: AccountingBasis) {
  return accountingBasis === 'RECEIPTS_AND_PAYMENTS'
    ? 'Receipts and payments'
    : 'Income and expenditure (accruals basis)'
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
    fontSize: 8
  },
  header: {
    marginBottom: 16
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
  meta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  metaCard: {
    flex: 1,
    border: '1px solid #dbe3ee',
    borderRadius: 4,
    padding: 8
  },
  metaLabel: {
    marginBottom: 4,
    color: '#64748b',
    fontSize: 8
  },
  metaValue: {
    fontSize: 10,
    fontWeight: 700
  },
  table: {
    border: '1px solid #dbe3ee',
    borderBottom: 0
  },
  reconciliationSection: {
    marginTop: 14
  },
  reconciliationHeader: {
    marginBottom: 6
  },
  reconciliationTitle: {
    fontSize: 11,
    fontWeight: 700
  },
  reconciliationText: {
    marginTop: 3,
    color: '#475569',
    fontSize: 8
  },
  reconciliationStatusOk: {
    marginTop: 6,
    border: '1px solid #a7f3d0',
    borderRadius: 4,
    padding: 5,
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    fontSize: 8,
    fontWeight: 700
  },
  reconciliationStatusWarning: {
    marginTop: 6,
    border: '1px solid #fde68a',
    borderRadius: 4,
    padding: 5,
    backgroundColor: '#fffbeb',
    color: '#92400e',
    fontSize: 8,
    fontWeight: 700
  },
  reconciliationTable: {
    border: '1px solid #dbe3ee',
    borderBottom: 0
  },
  reconciliationRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #dbe3ee',
    minHeight: 20
  },
  reconciliationTotalRow: {
    backgroundColor: '#f8fafc'
  },
  reconciliationLabel: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 5
  },
  reconciliationAmount: {
    width: 88,
    paddingHorizontal: 6,
    paddingVertical: 5,
    textAlign: 'right'
  },
  row: {
    flexDirection: 'row',
    borderBottom: '1px solid #dbe3ee',
    minHeight: 24
  },
  headerRow: {
    backgroundColor: '#111827',
    color: '#ffffff'
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 5
  },
  headerCell: {
    fontSize: 8,
    fontWeight: 700
  },
  boxCell: {
    width: 38
  },
  descriptionCell: {
    flex: 1.35
  },
  amountCell: {
    width: 88,
    textAlign: 'right'
  },
  guidanceCell: {
    flex: 1.75,
    color: '#475569'
  },
  amountText: {
    fontWeight: 700
  },
  note: {
    marginTop: 12,
    border: '1px solid #fde68a',
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#fffbeb',
    color: '#92400e',
    fontSize: 8
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
  const [year] = financialYearId
    ? await db
        .select({
          id: financialYears.id,
          label: financialYears.label,
          startDate: financialYears.startDate,
          endDate: financialYears.endDate
        })
        .from(financialYears)
        .where(
          and(
            eq(financialYears.parishCouncilId, parishCouncilId),
            eq(financialYears.id, financialYearId)
          )
        )
        .limit(1)
    : await db
        .select({
          id: financialYears.id,
          label: financialYears.label,
          startDate: financialYears.startDate,
          endDate: financialYears.endDate
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

  return year ?? null
}

async function getAgarReport({
  parishCouncilId,
  financialYear
}: {
  parishCouncilId: string
  financialYear: FinancialYear
}): Promise<AgarReport> {
  const [council] = await db
    .select({
      name: parishCouncils.name,
      accountingBasis: parishCouncils.accountingBasis
    })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, parishCouncilId))
    .limit(1)

  const accountingBasis = getEffectiveAccountingBasis(council?.accountingBasis)
  const includeOperationalAgarEntrySql =
    accountingBasis === 'RECEIPTS_AND_PAYMENTS'
      ? sql`${journalEntries.excludeFromAgar} = false`
      : sql`true`

  const [openingTotals] = await db
    .select({
      reserves: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.category} = 'Reserves'
              and ${nominalCodes.code} not in ('3090', '3095')
            then ${nominalOpeningBalances.amount}
            else 0
          end
        ), 0)
      `,

      cashAndShortTermInvestments: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS'
            then ${nominalOpeningBalances.amount}
            else 0
          end
        ), 0)
      `,

      fixedAssets: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_9_FIXED_ASSETS'
            then ${nominalOpeningBalances.amount}
            else 0
          end
        ), 0)
      `,

      borrowings: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_10_BORROWINGS'
            then ${nominalOpeningBalances.amount}
            else 0
          end
        ), 0)
      `
    })
    .from(nominalOpeningBalances)
    .innerJoin(
      nominalCodes,
      eq(nominalOpeningBalances.nominalCodeId, nominalCodes.id)
    )
    .where(
      and(
        eq(nominalOpeningBalances.parishCouncilId, parishCouncilId),
        eq(nominalOpeningBalances.financialYearId, financialYear.id)
      )
    )

  const [totals] = await db
    .select({
      precept: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_2_PRECEPT'
              and ${includeOperationalAgarEntrySql}
            then ${journalLines.credit} - ${journalLines.debit}
            else 0
          end
        ), 0)
      `,

      otherReceipts: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_3_OTHER_RECEIPTS'
              and ${includeOperationalAgarEntrySql}
            then ${journalLines.credit} - ${journalLines.debit}
            else 0
          end
        ), 0)
      `,

      staffCosts: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_4_STAFF_COSTS'
              and ${includeOperationalAgarEntrySql}
            then ${journalLines.debit} - ${journalLines.credit}
            else 0
          end
        ), 0)
      `,

      loanRepayments: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_5_LOAN_REPAYMENTS'
              and ${includeOperationalAgarEntrySql}
            then ${journalLines.debit} - ${journalLines.credit}
            else 0
          end
        ), 0)
      `,

      otherPayments: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_6_OTHER_PAYMENTS'
              and ${includeOperationalAgarEntrySql}
            then ${journalLines.debit} - ${journalLines.credit}
            else 0
          end
        ), 0)
      `,

      cashAndShortTermInvestments: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS'
            then ${journalLines.debit} - ${journalLines.credit}
            else 0
          end
        ), 0)
      `,

      fixedAssets: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_9_FIXED_ASSETS'
            then ${journalLines.debit} - ${journalLines.credit}
            else 0
          end
        ), 0)
      `,

      borrowings: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_10_BORROWINGS'
            then ${journalLines.credit} - ${journalLines.debit}
            else 0
          end
        ), 0)
      `
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
        gte(journalEntries.date, financialYear.startDate),
        lte(journalEntries.date, financialYear.endDate)
      )
    )

  const baseTotals: AgarTotals = {
    precept: normalise(totals?.precept),
    otherReceipts: normalise(totals?.otherReceipts),
    staffCosts: normalise(totals?.staffCosts),
    loanRepayments: normalise(totals?.loanRepayments),
    otherPayments: normalise(totals?.otherPayments),
    cashAndShortTermInvestments: normalise(totals?.cashAndShortTermInvestments),
    fixedAssets: normalise(totals?.fixedAssets),
    borrowings: normalise(totals?.borrowings)
  }

  const agarLineRows =
    accountingBasis === 'RECEIPTS_AND_PAYMENTS'
      ? await db
          .select({
            journalEntryId: journalLines.journalEntryId,
            excludeFromAgar: journalEntries.excludeFromAgar,
            source: journalEntries.source,
            nominalCode: nominalCodes.code,
            agarBox: nominalCodes.agarBox,
            isBank: nominalCodes.isBank,
            isVatRecoverable: nominalCodes.isVatRecoverable,
            isVatPayable: nominalCodes.isVatPayable,
            debit: journalLines.debit,
            credit: journalLines.credit
          })
          .from(journalLines)
          .innerJoin(
            journalEntries,
            eq(journalLines.journalEntryId, journalEntries.id)
          )
          .innerJoin(
            nominalCodes,
            eq(journalLines.nominalCodeId, nominalCodes.id)
          )
          .where(
            and(
              eq(journalEntries.parishCouncilId, parishCouncilId),
              eq(journalEntries.financialYearId, financialYear.id),
              gte(journalEntries.date, financialYear.startDate),
              lte(journalEntries.date, financialYear.endDate)
            )
          )
      : []

  const reportTotals =
    accountingBasis === 'RECEIPTS_AND_PAYMENTS'
      ? calculateReceiptsAndPaymentsTotals(baseTotals, agarLineRows)
      : baseTotals

  const openingFixedAssets = normalise(openingTotals?.fixedAssets)
  const openingBorrowings = Math.abs(normalise(openingTotals?.borrowings))
  const balancesBroughtForward = -normalise(openingTotals?.reserves)

  const precept = reportTotals.precept
  const otherReceipts = reportTotals.otherReceipts
  const staffCosts = reportTotals.staffCosts
  const loanRepayments = reportTotals.loanRepayments
  const otherPayments = reportTotals.otherPayments

  const cashAndShortTermInvestments =
    normalise(openingTotals?.cashAndShortTermInvestments) +
    reportTotals.cashAndShortTermInvestments

  const fixedAssets =
    openingFixedAssets + reportTotals.fixedAssets

  const borrowings = openingBorrowings + reportTotals.borrowings

  const balancesCarriedForward =
    balancesBroughtForward +
    precept +
    otherReceipts -
    staffCosts -
    loanRepayments -
    otherPayments

  const rawBox7Box8Difference =
    balancesCarriedForward - cashAndShortTermInvestments
  const shouldShowBox7Box8Reconciliation =
    accountingBasis === 'INCOME_AND_EXPENDITURE' ||
    Math.abs(rawBox7Box8Difference) >= 0.005

  const box7Box8Reconciliation: Box7Box8Reconciliation | null =
    shouldShowBox7Box8Reconciliation
      ? await (async () => {
          const openingRows = await db
            .select({
              code: nominalCodes.code,
              name: nominalCodes.name,
              category: nominalCodes.category,
              agarBox: nominalCodes.agarBox,
              isBank: nominalCodes.isBank,
              amount: sql<string>`coalesce(sum(${nominalOpeningBalances.amount}), 0)`
            })
            .from(nominalOpeningBalances)
            .innerJoin(
              nominalCodes,
              eq(nominalOpeningBalances.nominalCodeId, nominalCodes.id)
            )
            .where(
              and(
                eq(nominalOpeningBalances.parishCouncilId, parishCouncilId),
                eq(nominalOpeningBalances.financialYearId, financialYear.id),
                eq(nominalCodes.type, 'BALANCE_SHEET')
              )
            )
            .groupBy(
              nominalCodes.code,
              nominalCodes.name,
              nominalCodes.category,
              nominalCodes.agarBox,
              nominalCodes.isBank
            )

          const movementRows = await db
            .select({
              code: nominalCodes.code,
              name: nominalCodes.name,
              category: nominalCodes.category,
              agarBox: nominalCodes.agarBox,
              isBank: nominalCodes.isBank,
              amount: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}), 0)`
            })
            .from(journalLines)
            .innerJoin(
              journalEntries,
              eq(journalLines.journalEntryId, journalEntries.id)
            )
            .innerJoin(
              nominalCodes,
              eq(journalLines.nominalCodeId, nominalCodes.id)
            )
            .where(
              and(
                eq(journalEntries.parishCouncilId, parishCouncilId),
                eq(journalEntries.financialYearId, financialYear.id),
                gte(journalEntries.date, financialYear.startDate),
                lte(journalEntries.date, financialYear.endDate),
                // The AGAR reconciliation uses AGAR-adjusted balance sheet
                // balances, so VAT settlement journals do not clear the
                // debtor/creditor explanation used between Box 7 and Box 8.
                eq(journalEntries.excludeFromAgar, false),
                eq(nominalCodes.type, 'BALANCE_SHEET')
              )
            )
            .groupBy(
              nominalCodes.code,
              nominalCodes.name,
              nominalCodes.category,
              nominalCodes.agarBox,
              nominalCodes.isBank
            )

          const balancesByCode = new Map<string, Box7Box8CurrentBalance>()

          for (const row of openingRows) {
            balancesByCode.set(row.code, {
              code: row.code,
              name: row.name,
              category: row.category,
              agarBox: row.agarBox,
              isBank: row.isBank,
              balance: normalise(row.amount)
            })
          }

          for (const row of movementRows) {
            const existing = balancesByCode.get(row.code)

            balancesByCode.set(row.code, {
              code: row.code,
              name: row.name,
              category: row.category,
              agarBox: row.agarBox,
              isBank: row.isBank,
              balance: (existing?.balance ?? 0) + normalise(row.amount)
            })
          }

          const currentBalances = [...balancesByCode.values()]
          const agarAdjustedBox8Cash = currentBalances
            .filter(
              balance =>
                balance.isBank ||
                balance.agarBox === 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS'
            )
            .reduce((sum, balance) => sum + balance.balance, 0)

          const reconciliation = calculateBox7Box8Reconciliation({
            accountingBasis,
            box7Reserves: balancesCarriedForward,
            reportedBox8Cash: agarAdjustedBox8Cash,
            currentBalances
          })

          return accountingBasis === 'RECEIPTS_AND_PAYMENTS' &&
            reconciliation.agrees
            ? null
            : reconciliation
        })()
      : null

  return {
    councilName: council?.name ?? null,
    financialYear,
    accountingBasis,
    box7Box8Reconciliation,
    rows: [
      {
        box: '1',
        label: 'Balances brought forward',
        guidance:
          'Opening cash-backed balances and reserves, excluding fixed assets and borrowings.',
        amount: balancesBroughtForward
      },
      {
        box: '2',
        label: '(+) Precept or rates and levies',
        guidance:
          'Total amount of precept, rates and levies received or receivable in the year.',
        amount: precept
      },
      {
        box: '3',
        label: '(+) Total other receipts',
        guidance: 'Total income or receipts less precept/rates/levies.',
        amount: otherReceipts
      },
      {
        box: '4',
        label: '(-) Staff costs',
        guidance:
          'Total expenditure or payments made to and on behalf of employees.',
        amount: staffCosts
      },
      {
        box: '5',
        label: '(-) Loan interest / capital repayments',
        guidance:
          'Total expenditure or payments of capital and interest on borrowings.',
        amount: loanRepayments
      },
      {
        box: '6',
        label: '(-) All other payments',
        guidance:
          'Total expenditure or payments less staff costs and loan repayments.',
        amount: otherPayments
      },
      {
        box: '7',
        label: '(=) Balances carried forward',
        guidance:
          'Closing cash-backed balances and reserves, excluding fixed assets and borrowings. Must equal (1 + 2 + 3) - (4 + 5 + 6).',
        amount: balancesCarriedForward
      },
      {
        box: '8',
        label: 'Total value of cash and short term investments',
        guidance:
          'Opening bank balances plus current year bank account movements.',
        amount: cashAndShortTermInvestments
      },
      {
        box: '9',
        label: 'Total fixed assets plus long term investments and assets',
        guidance: 'Opening fixed assets plus current year fixed asset movements.',
        amount: fixedAssets
      },
      {
        box: '10',
        label: 'Total borrowings',
        guidance: 'Opening borrowings plus current year borrowing movements.',
        amount: borrowings
      }
    ]
  }
}

function metaCard(label: string, value: string) {
  return h(
    View,
    { style: styles.metaCard },
    h(Text, { style: styles.metaLabel }, label),
    h(Text, { style: styles.metaValue }, value)
  )
}

function reportRow(row: AgarRow) {
  return h(
    View,
    { key: row.box, style: styles.row, wrap: false },
    h(Text, { style: [styles.cell, styles.boxCell] }, row.box),
    h(Text, { style: [styles.cell, styles.descriptionCell] }, row.label),
    h(
      Text,
      { style: [styles.cell, styles.amountCell, styles.amountText] },
      `£${formatWholePounds(row.amount)}`
    ),
    h(Text, { style: [styles.cell, styles.guidanceCell] }, row.guidance)
  )
}

function reconciliationRow(
  label: string,
  amount: string,
  isTotal = false
) {
  const rowStyle = isTotal
    ? [styles.reconciliationRow, styles.reconciliationTotalRow]
    : styles.reconciliationRow
  const labelStyle = isTotal
    ? [styles.reconciliationLabel, styles.amountText]
    : styles.reconciliationLabel
  const amountStyle = isTotal
    ? [styles.reconciliationAmount, styles.amountText]
    : styles.reconciliationAmount

  return h(
    View,
    { style: rowStyle },
    h(Text, { style: labelStyle }, label),
    h(Text, { style: amountStyle }, amount)
  )
}

function reconciliationSection(
  reconciliation: Box7Box8Reconciliation | null
) {
  if (!reconciliation) return null

  return h(
    View,
    { style: styles.reconciliationSection },
    h(
      View,
      { style: styles.reconciliationHeader },
      h(Text, { style: styles.reconciliationTitle }, 'Box 7 to Box 8 reconciliation'),
      h(
        Text,
        { style: styles.reconciliationText },
        'Box 7 is reserves/current fund. Box 8 is cash only; non-cash balances explain the difference.'
      ),
      h(
        Text,
        {
          style: reconciliation.agrees
            ? styles.reconciliationStatusOk
            : styles.reconciliationStatusWarning
        },
        reconciliation.agrees
          ? 'Agrees to Box 8'
          : `Difference ${formatSignedWholePounds(reconciliation.difference)}`
      )
    ),
    h(
      View,
      { style: styles.reconciliationTable },
      reconciliationRow(
        'Box 7 reserves/current fund',
        `£${formatWholePounds(reconciliation.box7Reserves)}`,
        true
      ),
      reconciliation.rows.map(row =>
        reconciliationRow(row.label, formatSignedWholePounds(row.amount))
      ),
      reconciliationRow(
        'Reconciled Box 8 cash',
        `£${formatWholePounds(reconciliation.reconciledBox8Cash)}`,
        true
      ),
      reconciliationRow(
        'AGAR-adjusted Box 8 cash and short-term investments',
        `£${formatWholePounds(reconciliation.reportedBox8Cash)}`,
        true
      )
    )
  )
}

function agarPdf(report: AgarReport) {
  return h(
    Document,
    {
      title: `AGAR accounting statements - ${report.financialYear.label}`,
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
        h(Text, { style: styles.title }, 'AGAR accounting statements'),
        h(
          Text,
          { style: styles.subtitle },
          'Draft Section 2 accounting statement totals'
        )
      ),
      h(
        View,
        { style: styles.meta },
        metaCard('Parish council', report.councilName ?? '—'),
        metaCard('Financial year', report.financialYear.label),
        metaCard(
          'Period',
          `${formatDate(report.financialYear.startDate)} to ${formatDate(
            report.financialYear.endDate
          )}`
        ),
        metaCard('Accounting basis', getAccountingBasisLabel(report.accountingBasis))
      ),
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: [styles.row, styles.headerRow], fixed: true },
          h(Text, { style: [styles.cell, styles.headerCell, styles.boxCell] }, 'Box'),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.descriptionCell] },
            'Description'
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.amountCell] },
            report.financialYear.label
          ),
          h(
            Text,
            { style: [styles.cell, styles.headerCell, styles.guidanceCell] },
            'Notes and guidance'
          )
        ),
        report.rows.map(reportRow)
      ),
      reconciliationSection(report.box7Box8Reconciliation),
      h(
        Text,
        { style: styles.note },
        'Draft report: boxes 1, 8, 9 and 10 include opening balances where entered. Borrowings and fixed assets should still be reviewed before final AGAR submission.'
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

  const report = await getAgarReport({
    parishCouncilId,
    financialYear
  })

  const pdf = await renderToBuffer(agarPdf(report))
  const pdfBody = new ArrayBuffer(pdf.byteLength)
  new Uint8Array(pdfBody).set(pdf)
  const filename = `agar-summary-${escapeFilename(financialYear.label)}.pdf`

  return new Response(pdfBody, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
