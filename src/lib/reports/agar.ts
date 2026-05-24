export type AccountingBasis = 'RECEIPTS_AND_PAYMENTS' | 'INCOME_AND_EXPENDITURE'

export type AgarTotals = {
  precept: number
  otherReceipts: number
  staffCosts: number
  loanRepayments: number
  otherPayments: number
  cashAndShortTermInvestments: number
  fixedAssets: number
  borrowings: number
}

export type AgarLine = {
  journalEntryId: string
  excludeFromAgar: boolean
  source: string
  nominalCode: string
  description: string | null
  agarBox: string | null
  isBank: boolean
  isVatRecoverable: boolean
  isVatPayable: boolean
  debit: string
  credit: string
}

export type Box7Box8Reconciliation = {
  box7Reserves: number
  rows: Box7Box8ReconciliationRow[]
  reconciledBox8Cash: number
  reportedBox8Cash: number
  difference: number
  agrees: boolean
}

export type Box7Box8ReconciliationRow = {
  code: string
  label: string
  amount: number
}

export type Box7Box8CurrentBalance = {
  code: string
  name: string
  category: string | null
  agarBox: string | null
  isBank: boolean
  balance: number
}

export function getEffectiveAccountingBasis(
  value: string | null | undefined
): AccountingBasis {
  if (value === 'RECEIPTS_AND_PAYMENTS') return 'RECEIPTS_AND_PAYMENTS'
  return 'INCOME_AND_EXPENDITURE'
}

function normalise(value: unknown) {
  return Number(value ?? 0)
}

function isInputVatLine(line: AgarLine) {
  return line.isVatRecoverable || line.nominalCode === '2110'
}

function isOutputVatLine(line: AgarLine) {
  return line.isVatPayable || line.nominalCode === '2120'
}

function isVatLine(line: AgarLine) {
  return isInputVatLine(line) || isOutputVatLine(line)
}

function isFixedAssetDisposalLossIndicator(line: AgarLine) {
  const description = line.description?.toLowerCase() ?? ''

  return (
    line.agarBox === 'BOX_6_OTHER_PAYMENTS' &&
    (line.nominalCode === '5990' ||
      description.includes('loss on fixed asset disposal') ||
      description.includes('loss on asset disposal'))
  )
}

function isFixedAssetDisposalProfitIndicator(line: AgarLine) {
  const description = line.description?.toLowerCase() ?? ''

  return (
    line.agarBox === 'BOX_3_OTHER_RECEIPTS' &&
    (line.nominalCode === '4090' ||
      description.includes('profit on fixed asset disposal') ||
      description.includes('profit on asset disposal'))
  )
}

function isFixedAssetDisposalProceedsLine(line: AgarLine) {
  const description = line.description?.toLowerCase() ?? ''

  return description.includes('fixed asset disposal proceeds')
}

function fixedAssetDisposalLossMovement(
  linesByJournal: Map<string, AgarLine[]>,
  options: { skipExcludedAgarJournals?: boolean } = {}
) {
  return [...linesByJournal.values()].reduce((sum, journalLinesForEntry) => {
    if (
      options.skipExcludedAgarJournals &&
      journalLinesForEntry.some(
        line => line.excludeFromAgar || line.source === 'VAT_RETURN'
      )
    ) {
      return sum
    }

    if (!journalLinesForEntry.some(isFixedAssetDisposalLossIndicator)) {
      return sum
    }

    const box6Movement = journalLinesForEntry
      .filter(line => line.agarBox === 'BOX_6_OTHER_PAYMENTS')
      .reduce(
        (lineSum, line) =>
          lineSum + normalise(line.debit) - normalise(line.credit),
        0
      )

    return sum + box6Movement
  }, 0)
}

function fixedAssetDisposalProfitMovement(
  linesByJournal: Map<string, AgarLine[]>
) {
  return [...linesByJournal.values()].reduce((sum, journalLinesForEntry) => {
    if (
      journalLinesForEntry.some(
        line => line.excludeFromAgar || line.source === 'VAT_RETURN'
      )
    ) {
      return sum
    }

    if (!journalLinesForEntry.some(isFixedAssetDisposalProfitIndicator)) {
      return sum
    }

    const box3Movement = journalLinesForEntry
      .filter(line => line.agarBox === 'BOX_3_OTHER_RECEIPTS')
      .reduce(
        (lineSum, line) =>
          lineSum + normalise(line.credit) - normalise(line.debit),
        0
      )

    return sum + box3Movement
  }, 0)
}

function fixedAssetDisposalProceeds(linesByJournal: Map<string, AgarLine[]>) {
  return [...linesByJournal.values()].reduce((sum, journalLinesForEntry) => {
    if (
      journalLinesForEntry.some(
        line => line.excludeFromAgar || line.source === 'VAT_RETURN'
      )
    ) {
      return sum
    }

    const proceeds = journalLinesForEntry
      .filter(isFixedAssetDisposalProceedsLine)
      .reduce(
        (lineSum, line) =>
          lineSum + Math.max(0, normalise(line.debit) - normalise(line.credit)),
        0
      )

    return sum + proceeds
  }, 0)
}

function assetBalance(value: number) {
  return Math.max(0, value)
}

function liabilityBalance(value: number) {
  return Math.max(0, -value)
}

const vatControlCodes = new Set(['2100', '2110', '2120'])
const debtorPrepaymentCodes = new Set(['2150', '2160'])
const creditorAccrualCodes = new Set(['2200', '2210', '2220'])

function isFutureAccrualOrPrepaymentCode(balance: Box7Box8CurrentBalance) {
  const searchable = `${balance.code} ${balance.name} ${
    balance.category ?? ''
  }`.toLowerCase()

  return (
    searchable.includes('accrual') ||
    searchable.includes('prepayment') ||
    searchable.includes('prepaid') ||
    searchable.includes('receipt in advance') ||
    searchable.includes('receipts in advance')
  )
}

function reconciliationRowsForBalance({
  accountingBasis,
  balance
}: {
  accountingBasis: AccountingBasis
  balance: Box7Box8CurrentBalance
}): Box7Box8ReconciliationRow[] {
  const { code, name } = balance

  if (vatControlCodes.has(code)) {
    return []
  }

  if (debtorPrepaymentCodes.has(code)) {
    const debtors = assetBalance(balance.balance)

    return debtors > 0
      ? [{ code, label: `Less ${name} (${code})`, amount: -debtors }]
      : []
  }

  if (creditorAccrualCodes.has(code)) {
    const creditors = liabilityBalance(balance.balance)

    return creditors > 0
      ? [{ code, label: `Add ${name} (${code})`, amount: creditors }]
      : []
  }

  if (accountingBasis === 'INCOME_AND_EXPENDITURE' && code === '2110') {
    const vatRecoverable = assetBalance(balance.balance)

    return vatRecoverable > 0
      ? [{ code, label: `Less ${name} (${code})`, amount: -vatRecoverable }]
      : []
  }

  if (accountingBasis === 'INCOME_AND_EXPENDITURE' && code === '2120') {
    const vatPayable = liabilityBalance(balance.balance)

    return vatPayable > 0
      ? [{ code, label: `Add ${name} (${code})`, amount: vatPayable }]
      : []
  }

  if (!isFutureAccrualOrPrepaymentCode(balance)) {
    return []
  }

  if (balance.balance > 0) {
    return [{ code, label: `Less ${name} (${code})`, amount: -balance.balance }]
  }

  if (balance.balance < 0) {
    return [
      {
        code,
        label: `Add ${name} (${code})`,
        amount: Math.abs(balance.balance)
      }
    ]
  }

  return []
}

function vatOutstandingRow(
  currentBalances: Box7Box8CurrentBalance[]
): Box7Box8ReconciliationRow[] {
  const vatOutstanding = currentBalances
    .filter(balance => vatControlCodes.has(balance.code))
    .reduce((sum, balance) => sum + balance.balance, 0)

  if (Math.abs(vatOutstanding) < 0.005) {
    return []
  }

  return [
    {
      code: 'VAT_OUTSTANDING',
      label: 'VAT outstanding',
      amount: vatOutstanding > 0 ? -vatOutstanding : Math.abs(vatOutstanding)
    }
  ]
}

export function calculateBox7Box8Reconciliation({
  accountingBasis,
  box7Reserves,
  reportedBox8Cash,
  currentBalances
}: {
  accountingBasis: AccountingBasis
  box7Reserves: number
  reportedBox8Cash: number
  currentBalances: Box7Box8CurrentBalance[]
}): Box7Box8Reconciliation {
  const balanceRows = currentBalances.flatMap(balance =>
    reconciliationRowsForBalance({ accountingBasis, balance })
  )
  const rows =
    accountingBasis === 'INCOME_AND_EXPENDITURE'
      ? [
          ...balanceRows.filter(row => debtorPrepaymentCodes.has(row.code)),
          ...vatOutstandingRow(currentBalances),
          ...balanceRows.filter(row => creditorAccrualCodes.has(row.code)),
          ...balanceRows.filter(
            row =>
              !debtorPrepaymentCodes.has(row.code) &&
              !creditorAccrualCodes.has(row.code)
          )
        ]
      : balanceRows
  const totalAdjustments = rows.reduce((sum, row) => sum + row.amount, 0)

  // Box 7 is reserves/current fund. Box 8 is cash only.
  // Accruals-basis non-cash current balances explain the difference.
  // For income-and-expenditure councils, VAT control balances are netted into
  // one user-facing VAT outstanding row. Receipts/payments already includes
  // VAT gross in Boxes 3 and 6, so VAT is not a reconciling row there.
  const reconciledBox8Cash = box7Reserves + totalAdjustments
  const difference = reconciledBox8Cash - reportedBox8Cash

  return {
    box7Reserves,
    rows,
    reconciledBox8Cash,
    reportedBox8Cash,
    difference,
    agrees: Math.abs(difference) < 0.005
  }
}

export function calculateReceiptsAndPaymentsTotals(
  baseTotals: AgarTotals,
  lines: AgarLine[]
): AgarTotals {
  const totals = { ...baseTotals }

  const linesByJournal = new Map<string, AgarLine[]>()

  for (const line of lines) {
    const existingLines = linesByJournal.get(line.journalEntryId) ?? []
    existingLines.push(line)
    linesByJournal.set(line.journalEntryId, existingLines)
  }

  const fixedAssetDisposalLosses = fixedAssetDisposalLossMovement(
    linesByJournal,
    { skipExcludedAgarJournals: true }
  )
  const fixedAssetDisposalProfits =
    fixedAssetDisposalProfitMovement(linesByJournal)
  const disposalProceeds = fixedAssetDisposalProceeds(linesByJournal)

  totals.otherReceipts -= fixedAssetDisposalProfits
  totals.otherReceipts += disposalProceeds
  totals.otherPayments -= fixedAssetDisposalLosses

  for (const journalLinesForEntry of linesByJournal.values()) {
    if (
      journalLinesForEntry.some(
        line => line.excludeFromAgar || line.source === 'VAT_RETURN'
      )
    ) {
      continue
    }

    const nonBankReportingLines = journalLinesForEntry.filter(
      line => !line.isBank && !isVatLine(line)
    )

    const hasPaymentBoxLine = nonBankReportingLines.some(
      line =>
        line.agarBox === 'BOX_4_STAFF_COSTS' ||
        line.agarBox === 'BOX_5_LOAN_REPAYMENTS' ||
        line.agarBox === 'BOX_6_OTHER_PAYMENTS' ||
        line.agarBox === 'BOX_9_FIXED_ASSETS'
    )

    const fixedAssetPayments = nonBankReportingLines
      .filter(line => line.agarBox === 'BOX_9_FIXED_ASSETS')
      .reduce(
        (sum, line) =>
          sum + Math.max(0, normalise(line.debit) - normalise(line.credit)),
        0
      )
    const borrowingCapitalRepayments = nonBankReportingLines
      .filter(line => line.agarBox === 'BOX_10_BORROWINGS')
      .reduce(
        (sum, line) =>
          sum + Math.max(0, normalise(line.debit) - normalise(line.credit)),
        0
      )

    totals.otherPayments += fixedAssetPayments
    totals.loanRepayments += borrowingCapitalRepayments

    for (const line of journalLinesForEntry) {
      // Receipts and payments AGAR boxes use gross operating cash values:
      // input VAT belongs in Box 6, and output VAT belongs in Box 3.
      // VAT return/settlement journals are excluded above at journal level.
      if (isInputVatLine(line) && hasPaymentBoxLine) {
        totals.otherPayments += normalise(line.debit)
      }

      if (isOutputVatLine(line)) {
        totals.otherReceipts += normalise(line.credit)
      }
    }
  }

  return totals
}

export function calculateIncomeAndExpenditureTotals(
  baseTotals: AgarTotals,
  lines: AgarLine[],
  options: {
    liveDisposedAssetJournalEntryIds?: Set<string>
  } = {}
): AgarTotals {
  const totals = { ...baseTotals }
  const linesByJournal = new Map<string, AgarLine[]>()
  const liveDisposedAssetJournalEntryIds =
    options.liveDisposedAssetJournalEntryIds ?? new Set<string>()

  for (const line of lines) {
    const existingLines = linesByJournal.get(line.journalEntryId) ?? []
    existingLines.push(line)
    linesByJournal.set(line.journalEntryId, existingLines)
  }

  const fixedAssetAdditions = lines
    .filter(line => line.agarBox === 'BOX_9_FIXED_ASSETS')
    .reduce(
      (sum, line) =>
        sum + Math.max(0, normalise(line.debit) - normalise(line.credit)),
      0
    )
  const liveDisposedFixedAssetCosts = [...linesByJournal.values()].reduce(
    (sum, journalLinesForEntry) => {
      const fixedAssetReduction = journalLinesForEntry
        .filter(line => {
          const description = line.description?.toLowerCase() ?? ''

          return (
            line.agarBox === 'BOX_9_FIXED_ASSETS' &&
            description.includes('fixed asset value removed') &&
            (!description.includes('opening balance') ||
              liveDisposedAssetJournalEntryIds.has(line.journalEntryId))
          )
        })
        .reduce(
          (lineSum, line) =>
            lineSum +
            Math.max(0, normalise(line.credit) - normalise(line.debit)),
          0
        )

      return sum + fixedAssetReduction
    },
    0
  )

  totals.otherPayments += fixedAssetAdditions
  totals.otherPayments -= Math.min(
    liveDisposedFixedAssetCosts,
    fixedAssetAdditions
  )

  return totals
}
