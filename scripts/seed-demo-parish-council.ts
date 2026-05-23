import dotenv from 'dotenv'
import { eq } from 'drizzle-orm'

import type { DefaultNominal } from '@/lib/nominal-codes/default-chart'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing after loading .env.local')
}

const DEMO_COUNCIL_ID = 'demo-parish-council'
const DEMO_COUNCIL_NAME = 'Barton Seagrave Demo Parish Council'
const DEMO_USER_EMAIL = 'demo@example.com'
const DEMO_USER_PASSWORD = 'DemoReview2026!'
const DEMO_REVIEW_DATE = '2026-05-18'
const PRIOR_YEAR_ID = 'demo-fy-2025-26'
const CURRENT_YEAR_ID = 'demo-fy-2026-27'

type FinancialYearId = typeof PRIOR_YEAR_ID | typeof CURRENT_YEAR_ID
type CodeMap = Record<string, string>

const EXPECTED_DEMO_OPENING_BALANCES: Record<
  FinancialYearId,
  Record<string, number>
> = {
  [PRIOR_YEAR_ID]: {
    '1200': 22000,
    '1210': 8000,
    '1600': 65000,
    '2300': -18000,
    '3000': -30000,
    '3090': -65000,
    '3095': 18000
  },
  [CURRENT_YEAR_ID]: {
    '1200': 28500,
    '1210': 8000,
    '1600': 69800,
    '2300': -14500,
    '3000': -36500,
    '3090': -69800,
    '3095': 14500
  }
}

function codeId(financialYearId: FinancialYearId, code: string) {
  const yearSlug = financialYearId.replace('demo-fy-', '')

  return `demo-code-${yearSlug}-${code}`
}

function lineId(journalId: string, lineNumber: number) {
  return `${journalId}-line-${lineNumber}`
}

function bankTxId(providerTxId: string) {
  return `demo-bank-tx-${providerTxId}`
}

function formatAmount(amount: number) {
  return amount.toFixed(2)
}

async function run() {
  const { auth } = await import('@/lib/auth')
  const { db } = await import('@/db')
  const {
    account,
    parishCouncils,
    session,
    user
  } = await import('@/db/schema/authSchema')
  const { bankConnections } = await import('@/db/schema/bankConnection')
  const { bankOpeningBalances } = await import(
    '@/db/schema/bankOpeningBalances'
  )
  const { bankTransactions } = await import('@/db/schema/bankTransactions')
  const {
    budgets,
    financialYears,
    journalEntries,
    journalLines,
    matchingRules,
    nominalCodes,
    nominalOpeningBalances,
    yearEndRuns
  } = await import('@/db/schema/nominalLedger')
  const {
    projects,
    reserves,
    suppliers
  } = await import('@/db/schema/reservesProjectsSuppliers')
  const { fixedAssets } = await import('@/db/schema/fixedAssets')
  const { borrowings } = await import('@/db/schema/borrowings')
  const { vatReturns } = await import('@/db/schema/vatReturns')
  const { vatRates } = await import('@/db/schema/vatRates')
  const { defaultChart } = await import('@/lib/nominal-codes/default-chart')
  const { DEFAULT_VAT_RATES } = await import('@/lib/vat/default-vat-rates')

  console.log(`Resetting ${DEMO_COUNCIL_NAME} (${DEMO_COUNCIL_ID})`)

  await db.transaction(async trx => {
    const [existingDemoEmailUser] = await trx
      .select({
        id: user.id,
        parishCouncilId: user.parishCouncilId
      })
      .from(user)
      .where(eq(user.email, DEMO_USER_EMAIL))
      .limit(1)

    if (
      existingDemoEmailUser &&
      existingDemoEmailUser.parishCouncilId !== DEMO_COUNCIL_ID
    ) {
      throw new Error(
        `Cannot reset demo login: ${DEMO_USER_EMAIL} belongs to a non-demo user (${existingDemoEmailUser.id}).`
      )
    }

    const demoUsers = await trx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.parishCouncilId, DEMO_COUNCIL_ID))

    for (const demoUser of demoUsers) {
      await trx.delete(session).where(eq(session.userId, demoUser.id))
      await trx.delete(account).where(eq(account.userId, demoUser.id))
      await trx.delete(user).where(eq(user.id, demoUser.id))
    }

    await trx
      .delete(bankTransactions)
      .where(eq(bankTransactions.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(bankOpeningBalances)
      .where(eq(bankOpeningBalances.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(vatReturns)
      .where(eq(vatReturns.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(fixedAssets)
      .where(eq(fixedAssets.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(borrowings)
      .where(eq(borrowings.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(budgets)
      .where(eq(budgets.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(matchingRules)
      .where(eq(matchingRules.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(journalLines)
      .where(eq(journalLines.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(journalEntries)
      .where(eq(journalEntries.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(bankConnections)
      .where(eq(bankConnections.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(suppliers)
      .where(eq(suppliers.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(projects)
      .where(eq(projects.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(reserves)
      .where(eq(reserves.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(nominalOpeningBalances)
      .where(eq(nominalOpeningBalances.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(nominalCodes)
      .where(eq(nominalCodes.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(yearEndRuns)
      .where(eq(yearEndRuns.parishCouncilId, DEMO_COUNCIL_ID))
    await trx
      .delete(financialYears)
      .where(eq(financialYears.parishCouncilId, DEMO_COUNCIL_ID))
    await trx.delete(vatRates).where(eq(vatRates.parishCouncilId, DEMO_COUNCIL_ID))
    await trx.delete(parishCouncils).where(eq(parishCouncils.id, DEMO_COUNCIL_ID))

    await trx.insert(parishCouncils).values({
      id: DEMO_COUNCIL_ID,
      name: DEMO_COUNCIL_NAME,
      addressLine1: 'The Parish Office',
      addressLine2: 'Church Street',
      town: 'Barton Seagrave',
      county: 'North Northamptonshire',
      postcode: 'NN15 6NB',
      telephone: '01536 555010',
      email: 'clerk@bartonseagrave-demo.gov.uk',
      website: 'https://bartonseagrave-demo.gov.uk',
      canRecoverVat: true,
      vatStatus: 'NOT_REGISTERED',
      vatClaimFrequency: 'QUARTERLY',
      vatClaimMethod: 'VAT126',
      accountingBasis: 'RECEIPTS_AND_PAYMENTS',
      onboardingCompletedAt: new Date('2025-04-01T09:00:00Z'),
      createdAt: new Date('2025-04-01T09:00:00Z'),
      updatedAt: new Date('2026-05-01T09:00:00Z')
    })

    await trx.insert(financialYears).values([
      {
        id: PRIOR_YEAR_ID,
        parishCouncilId: DEMO_COUNCIL_ID,
        label: '2025/26',
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        isClosed: true,
        closedAt: new Date('2026-04-05T10:30:00Z')
      },
      {
        id: CURRENT_YEAR_ID,
        parishCouncilId: DEMO_COUNCIL_ID,
        label: '2026/27',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        isClosed: false
      }
    ])

    const priorCodes = await seedNominalCodes(trx, PRIOR_YEAR_ID, defaultChart)
    const currentCodes = await seedNominalCodes(
      trx,
      CURRENT_YEAR_ID,
      defaultChart
    )

    await trx.insert(vatRates).values(
      DEFAULT_VAT_RATES.map(rate => ({
        id: `demo-vat-rate-${rate.code}`,
        parishCouncilId: DEMO_COUNCIL_ID,
        code: rate.code,
        name: rate.name,
        ratePercent: rate.ratePercent,
        isActive: true,
        isSystem: rate.isSystem,
        sortOrder: rate.sortOrder
      }))
    )

    await trx.insert(reserves).values([
      {
        id: 'demo-reserve-general',
        parishCouncilId: DEMO_COUNCIL_ID,
        code: 'GEN',
        name: 'General Reserve',
        isDefault: true,
        isActive: true
      },
      {
        id: 'demo-reserve-playground',
        parishCouncilId: DEMO_COUNCIL_ID,
        code: 'PLAY',
        name: 'Playground Renewal Reserve',
        isDefault: false,
        isActive: true
      },
      {
        id: 'demo-reserve-cil',
        parishCouncilId: DEMO_COUNCIL_ID,
        code: 'CIL',
        name: 'CIL Reserve',
        isDefault: false,
        isActive: true
      }
    ])

    await trx.insert(projects).values([
      {
        id: 'demo-project-playground',
        parishCouncilId: DEMO_COUNCIL_ID,
        reserveId: 'demo-reserve-playground',
        code: 'PLAY-26',
        name: 'Play Area Refurbishment',
        description: 'Replacement surfacing and inspection works.',
        isActive: true
      },
      {
        id: 'demo-project-hall-path',
        parishCouncilId: DEMO_COUNCIL_ID,
        reserveId: 'demo-reserve-cil',
        code: 'CIL-PATH',
        name: 'Community Hall Path',
        description: 'CIL-funded accessible path improvements.',
        isActive: true
      }
    ])

    await trx.insert(suppliers).values([
      {
        id: 'demo-supplier-greenacre',
        parishCouncilId: DEMO_COUNCIL_ID,
        name: 'Greenacre Grounds Ltd',
        vatNumber: 'GB123456789',
        defaultGoodsSupplied: 'Grounds maintenance',
        defaultNominalCodeId: currentCodes['5100'],
        defaultReserveId: 'demo-reserve-general',
        isActive: true
      },
      {
        id: 'demo-supplier-came',
        parishCouncilId: DEMO_COUNCIL_ID,
        name: 'Came & Company Local Council Insurance',
        defaultGoodsSupplied: 'Annual insurance premium',
        defaultNominalCodeId: currentCodes['5010'],
        defaultReserveId: 'demo-reserve-general',
        isActive: true
      },
      {
        id: 'demo-supplier-playworks',
        parishCouncilId: DEMO_COUNCIL_ID,
        name: 'PlayWorks Safety Services',
        vatNumber: 'GB987654321',
        defaultGoodsSupplied: 'Playground repairs and inspections',
        defaultNominalCodeId: currentCodes['5110'],
        defaultReserveId: 'demo-reserve-playground',
        defaultProjectId: 'demo-project-playground',
        isActive: true
      },
      {
        id: 'demo-supplier-scribe',
        parishCouncilId: DEMO_COUNCIL_ID,
        name: 'Scribe Accounts',
        vatNumber: 'GB111222333',
        defaultGoodsSupplied: 'Accounting software subscription',
        defaultNominalCodeId: currentCodes['5160'],
        defaultReserveId: 'demo-reserve-general',
        isActive: true
      }
    ])

    await trx.insert(bankConnections).values([
      {
        id: 'demo-bank-current',
        parishCouncilId: DEMO_COUNCIL_ID,
        providerName: 'DEMO',
        providerId: 'demo-provider',
        providerAccountId: 'demo-current-account',
        accountName: 'Unity Trust Current Account',
        accountType: 'TRANSACTION',
        sortCode: '60-83-01',
        accountLast4: '1026',
        nominalCodeId: currentCodes['1200'],
        latestBalance: '49782.00',
        latestBalanceAt: new Date('2026-05-15T17:00:00Z'),
        accessToken: 'demo-access-token',
        refreshToken: 'demo-refresh-token',
        accessTokenExpiry: new Date('2099-01-01T00:00:00Z'),
        consentExpiry: new Date('2099-01-01T00:00:00Z'),
        lastSyncAt: new Date('2026-05-15T17:00:00Z'),
        status: 'ACTIVE'
      },
      {
        id: 'demo-bank-savings',
        parishCouncilId: DEMO_COUNCIL_ID,
        providerName: 'DEMO',
        providerId: 'demo-provider',
        providerAccountId: 'demo-savings-account',
        accountName: 'Cambridge Building Society Deposit',
        accountType: 'SAVINGS',
        sortCode: '20-00-00',
        accountLast4: '7741',
        nominalCodeId: currentCodes['1210'],
        latestBalance: '8000.00',
        latestBalanceAt: new Date('2026-05-15T17:00:00Z'),
        accessToken: 'demo-access-token',
        refreshToken: 'demo-refresh-token',
        accessTokenExpiry: new Date('2099-01-01T00:00:00Z'),
        consentExpiry: new Date('2099-01-01T00:00:00Z'),
        lastSyncAt: new Date('2026-05-15T17:00:00Z'),
        status: 'ACTIVE'
      }
    ])

    await seedOpeningBalances(trx, PRIOR_YEAR_ID, priorCodes, {
      '1200': 22000,
      '1210': 8000,
      '1600': 65000,
      '2300': -18000,
      '3000': -30000,
      '3090': -65000,
      '3095': 18000
    })

    await seedOpeningBalances(trx, CURRENT_YEAR_ID, currentCodes, {
      '1200': 28500,
      '1210': 8000,
      '1600': 69800,
      '2300': -14500,
      '3000': -36500,
      '3090': -69800,
      '3095': 14500
    })

    await trx.insert(bankOpeningBalances).values([
      {
        id: 'demo-bank-ob-current',
        parishCouncilId: DEMO_COUNCIL_ID,
        financialYearId: CURRENT_YEAR_ID,
        connectionId: 'demo-bank-current',
        nominalCodeId: currentCodes['1200'],
        openingBalance: '28500.00'
      },
      {
        id: 'demo-bank-ob-savings',
        parishCouncilId: DEMO_COUNCIL_ID,
        financialYearId: CURRENT_YEAR_ID,
        connectionId: 'demo-bank-savings',
        nominalCodeId: currentCodes['1210'],
        openingBalance: '8000.00'
      }
    ])

    await trx.insert(yearEndRuns).values({
      id: 'demo-year-end-2025-26',
      parishCouncilId: DEMO_COUNCIL_ID,
      fromFinancialYearId: PRIOR_YEAR_ID,
      toFinancialYearId: CURRENT_YEAR_ID,
      status: 'COMPLETED',
      startedAt: new Date('2026-04-05T10:00:00Z'),
      completedAt: new Date('2026-04-05T10:30:00Z'),
      notes: 'Demo year-end run carried forward to 2026/27.'
    })

    await seedJournals(trx, PRIOR_YEAR_ID, priorCodes, [
      {
        id: 'demo-je-prior-precept',
        reference: 'BNK-2025-04-15-PRECEP',
        date: '2025-04-15',
        description: 'First half precept received',
        source: 'BANK_FEED',
        lines: [
          ['1200', 42000, 0],
          ['4000', 0, 42000]
        ]
      },
      {
        id: 'demo-je-prior-grant',
        reference: 'BNK-2025-06-20-GRANT',
        date: '2025-06-20',
        description: 'North Northamptonshire grant for play area',
        source: 'BANK_FEED',
        lines: [
          ['1200', 7500, 0],
          ['4010', 0, 7500]
        ]
      },
      {
        id: 'demo-je-prior-donations',
        reference: 'BNK-2025-12-05-DONATE',
        date: '2025-12-05',
        description: 'Community event donations',
        source: 'BANK_FEED',
        lines: [
          ['1200', 900, 0],
          ['4020', 0, 900]
        ]
      },
      {
        id: 'demo-je-prior-salaries',
        reference: 'PAY-2025-STAFF',
        date: '2026-03-25',
        description: 'Clerk salary and PAYE for 2025/26',
        source: 'MANUAL',
        lines: [
          ['5040', 18000, 0],
          ['5050', 2200, 0],
          ['1200', 0, 20200]
        ]
      },
      {
        id: 'demo-je-prior-maintenance',
        reference: 'BNK-2025-GROUNDS',
        date: '2025-11-30',
        description: 'Grounds maintenance and repairs',
        source: 'BANK_FEED',
        lines: [
          ['5100', 9500, 0],
          ['5110', 3250, 0],
          ['2110', 2550, 0],
          ['1200', 0, 15300]
        ]
      },
      {
        id: 'demo-je-prior-admin',
        reference: 'BNK-2025-ADMIN',
        date: '2026-02-15',
        description: 'Insurance, audit, subscriptions and IT',
        source: 'BANK_FEED',
        lines: [
          ['5010', 1400, 0],
          ['5030', 650, 0],
          ['5130', 375, 0],
          ['5160', 1200, 0],
          ['2110', 240, 0],
          ['1200', 0, 3865]
        ]
      },
      {
        id: 'demo-je-prior-loan',
        reference: 'BNK-2026-LOAN',
        date: '2026-03-01',
        description: 'Public Works Loan Board repayment',
        source: 'BANK_FEED',
        lines: [
          ['5210', 700, 0],
          ['2300', 3500, 0],
          ['1200', 0, 4200]
        ]
      },
      {
        id: 'demo-je-prior-assets',
        reference: 'BNK-2026-ASSET',
        date: '2026-03-18',
        description: 'Noticeboards and playground surfacing additions',
        source: 'BANK_FEED',
        lines: [
          ['1610', 1800, 0],
          ['1620', 3000, 0],
          ['2110', 960, 0],
          ['1200', 0, 5760]
        ]
      },
      {
        id: 'demo-je-prior-vat-claim',
        reference: 'VAT126-2025-Q4',
        date: '2026-03-31',
        description: 'VAT 126 claim submitted for 2025/26',
        source: 'VAT_RETURN',
        lines: [
          ['1200', 3750, 0],
          ['2110', 0, 3750]
        ]
      }
    ])

    await seedJournals(trx, CURRENT_YEAR_ID, currentCodes, [
      {
        id: 'demo-je-current-precept',
        reference: 'BNK-2026-04-15-PRECEP',
        date: '2026-04-15',
        description: 'First instalment of annual precept',
        source: 'BANK_FEED',
        sourceId: bankTxId('posted-precept'),
        lines: [
          ['1200', 22000, 0],
          ['4000', 0, 22000]
        ]
      },
      {
        id: 'demo-je-current-rent',
        reference: 'BNK-2026-04-30-ALLOT',
        date: '2026-04-30',
        description: 'Allotment rent receipts',
        source: 'BANK_FEED',
        sourceId: bankTxId('posted-allotment-rent'),
        lines: [
          ['1200', 600, 0],
          ['4030', 0, 600]
        ]
      },
      {
        id: 'demo-je-current-salary',
        reference: 'BNK-2026-04-28-SALARY',
        date: '2026-04-28',
        description: 'April clerk salary',
        source: 'BANK_FEED',
        sourceId: bankTxId('posted-april-salary'),
        lines: [
          ['5040', 3200, 0],
          ['1200', 0, 3200]
        ]
      },
      {
        id: 'demo-je-current-grounds',
        reference: 'BNK-2026-05-02-GROUND',
        date: '2026-05-02',
        description: 'April grounds maintenance',
        source: 'BANK_FEED',
        sourceId: bankTxId('posted-grounds'),
        lines: [
          ['5100', 1500, 0],
          ['2110', 300, 0],
          ['1200', 0, 1800]
        ]
      },
      {
        id: 'demo-je-current-insurance',
        reference: 'BNK-2026-05-06-INSURE',
        date: '2026-05-06',
        description: 'Annual council insurance renewal',
        source: 'BANK_FEED',
        sourceId: bankTxId('posted-insurance'),
        lines: [
          ['5010', 1450, 0],
          ['1200', 0, 1450]
        ]
      },
      {
        id: 'demo-je-current-website',
        reference: 'BNK-2026-05-10-WEB',
        date: '2026-05-10',
        description: 'Website hosting renewal',
        source: 'BANK_FEED',
        sourceId: bankTxId('posted-website'),
        lines: [
          ['5160', 240, 0],
          ['2110', 48, 0],
          ['1200', 0, 288]
        ]
      },
      {
        id: 'demo-je-current-loan',
        reference: 'BNK-2026-05-15-LOAN',
        date: '2026-05-15',
        description: 'PWLB loan repayment',
        source: 'BANK_FEED',
        sourceId: bankTxId('posted-loan'),
        lines: [
          ['5210', 180, 0],
          ['2300', 1000, 0],
          ['1200', 0, 1180]
        ]
      },
      {
        id: 'demo-je-current-play-equipment',
        reference: 'BNK-2026-05-16-PLAY',
        date: '2026-05-16',
        description: 'Replacement swing seats',
        source: 'BANK_FEED',
        sourceId: bankTxId('posted-play-equipment'),
        lines: [
          ['1620', 1200, 0],
          ['2110', 240, 0],
          ['1200', 0, 1440]
        ]
      },
      {
        id: 'demo-je-current-matched-grant',
        reference: 'MAN-2026-CIL-GRANT',
        date: '2026-05-15',
        description: 'CIL neighbourhood receipt matched to bank feed',
        source: 'MANUAL',
        lines: [
          ['1200', 4200, 0],
          ['4010', 0, 4200]
        ]
      },
      {
        id: 'demo-je-current-manual-fete-receipt',
        reference: 'MAN-2026-FETE-RECEIPT',
        date: '2026-05-11',
        description: 'Manually entered village fete stall income',
        source: 'MANUAL',
        lines: [
          ['1200', 250, 0],
          ['4030', 0, 250]
        ]
      },
      {
        id: 'demo-je-current-uncleared-cheque',
        reference: 'MAN-2026-CHQ-1042',
        date: '2026-05-14',
        description: 'Cheque 1042: village hall room hire refund',
        source: 'MANUAL',
        lines: [
          ['5110', 375, 0],
          ['1200', 0, 375]
        ]
      }
    ])

    await trx.insert(budgets).values(
      [
        ['4000', '44000.00', 'Annual precept agreed by council.'],
        ['4010', '8500.00', 'Expected grants and CIL neighbourhood receipts.'],
        ['4030', '1400.00', 'Allotment rents and room hire.'],
        ['5010', '1550.00', 'Insurance renewal.'],
        ['5030', '750.00', 'Internal and external audit provision.'],
        ['5040', '19800.00', 'Clerk salary budget.'],
        ['5050', '2600.00', 'Payroll taxes and pension costs.'],
        ['5100', '11200.00', 'Grounds maintenance contract.'],
        ['5110', '7000.00', 'Reactive repairs and inspections.'],
        ['5160', '1800.00', 'Website, software and IT support.'],
        ['5200', '4000.00', 'Loan principal repayment.'],
        ['5210', '620.00', 'Loan interest.']
      ].map(([code, amount, notes]) => ({
        id: `demo-budget-${code}`,
        parishCouncilId: DEMO_COUNCIL_ID,
        financialYearId: CURRENT_YEAR_ID,
        nominalCodeId: currentCodes[code],
        amount,
        notes
      }))
    )

    await trx.insert(fixedAssets).values([
      {
        id: 'demo-asset-war-memorial',
        parishCouncilId: DEMO_COUNCIL_ID,
        financialYearId: CURRENT_YEAR_ID,
        nominalCodeId: currentCodes['1640'],
        refNo: 'FA-001',
        category: 'War Memorials',
        description: 'Village war memorial and railings',
        location: 'Church Street green',
        insuranceCategory: 'Heritage assets',
        dateAcquired: '1921-11-11',
        purchaseCost: '1.00',
        assetRegisterValue: '1.00',
        assetOrigin: 'opening_balance',
        notes: 'Community asset held at proxy value.',
        isDisposed: false
      },
      {
        id: 'demo-asset-play-area',
        parishCouncilId: DEMO_COUNCIL_ID,
        financialYearId: CURRENT_YEAR_ID,
        nominalCodeId: currentCodes['1620'],
        refNo: 'FA-014',
        category: 'Play Equipment',
        description: 'Polwell Lane play area equipment',
        location: 'Polwell Lane recreation ground',
        insuranceCategory: 'Play equipment',
        dateAcquired: '2018-08-20',
        purchaseCost: '48200.00',
        assetRegisterValue: '48200.00',
        assetOrigin: 'opening_balance',
        isDisposed: false
      },
      {
        id: 'demo-asset-noticeboards',
        parishCouncilId: DEMO_COUNCIL_ID,
        financialYearId: CURRENT_YEAR_ID,
        nominalCodeId: currentCodes['1610'],
        refNo: 'FA-027',
        category: 'Street Furniture',
        description: 'Three parish noticeboards',
        location: 'Village-wide',
        insuranceCategory: 'Street furniture',
        dateAcquired: '2026-03-18',
        purchaseCost: '1800.00',
        assetRegisterValue: '1800.00',
        assetOrigin: 'live',
        isDisposed: false
      },
      {
        id: 'demo-asset-laptop',
        parishCouncilId: DEMO_COUNCIL_ID,
        financialYearId: CURRENT_YEAR_ID,
        nominalCodeId: currentCodes['1630'],
        refNo: 'FA-031',
        category: 'Office Equipment',
        description: 'Clerk laptop',
        location: 'Parish Office',
        insuranceCategory: 'Office equipment',
        dateAcquired: '2024-09-01',
        purchaseCost: '950.00',
        assetRegisterValue: '950.00',
        assetOrigin: 'opening_balance',
        isDisposed: false
      }
    ])

    await trx.insert(borrowings).values({
      id: 'demo-borrowing-pwlb',
      parishCouncilId: DEMO_COUNCIL_ID,
      financialYearId: CURRENT_YEAR_ID,
      lender: 'Public Works Loan Board',
      reference: 'PWLB-504321',
      purpose: 'Community hall roof works',
      startDate: '2021-04-01',
      originalAmount: '25000.00',
      openingBalance: '14500.00',
      interestRate: '4.250',
      repaymentFrequency: 'Quarterly',
      nominalCodeId: currentCodes['2300'],
      notes: 'Quarterly repayments shown for borrowings report demo.',
      isActive: true
    })

    await trx.insert(vatReturns).values([
      {
        id: 'demo-vat-return-2025-q4',
        parishCouncilId: DEMO_COUNCIL_ID,
        financialYearId: PRIOR_YEAR_ID,
        periodStart: new Date('2026-01-01T00:00:00Z'),
        periodEnd: new Date('2026-03-31T00:00:00Z'),
        inputVat: '3750.00',
        outputVat: '0.00',
        netVat: '3750.00',
        status: 'SUBMITTED',
        submittedAt: new Date('2026-04-02T10:00:00Z')
      },
      {
        id: 'demo-vat-return-2026-q1',
        parishCouncilId: DEMO_COUNCIL_ID,
        financialYearId: CURRENT_YEAR_ID,
        periodStart: new Date('2026-04-01T00:00:00Z'),
        periodEnd: new Date(`${DEMO_REVIEW_DATE}T00:00:00Z`),
        inputVat: '588.00',
        outputVat: '0.00',
        netVat: '588.00',
        status: 'DRAFT'
      }
    ])

    await trx.insert(bankTransactions).values([
      {
        id: bankTxId('posted-precept'),
        connectionId: 'demo-bank-current',
        parishCouncilId: DEMO_COUNCIL_ID,
        providerTxId: 'posted-precept',
        date: '2026-04-15',
        description: 'NNC PRECEPT APRIL',
        amount: '22000.00',
        reserveId: 'demo-reserve-general',
        merchantName: 'North Northamptonshire Council',
        category: 'Income',
        transactionType: 'CREDIT',
        status: 'POSTED',
        nominalCodeId: currentCodes['4000'],
        vatRate: 'NO_VAT',
        vatTreatment: 'OUTSIDE_SCOPE',
        grossAmount: '22000.00',
        journalEntryId: 'demo-je-current-precept',
        postedAt: new Date('2026-04-15T12:00:00Z')
      },
      {
        id: bankTxId('posted-grounds'),
        connectionId: 'demo-bank-current',
        parishCouncilId: DEMO_COUNCIL_ID,
        providerTxId: 'posted-grounds',
        date: '2026-05-02',
        description: 'GREENACRE GROUNDS LTD',
        amount: '-1800.00',
        supplierId: 'demo-supplier-greenacre',
        reserveId: 'demo-reserve-general',
        merchantName: 'Greenacre Grounds Ltd',
        category: 'Maintenance',
        transactionType: 'DEBIT',
        status: 'POSTED',
        nominalCodeId: currentCodes['5100'],
        vatRate: 'STANDARD_20',
        vatTreatment: 'RECOVERABLE',
        netAmount: '1500.00',
        vatAmount: '300.00',
        grossAmount: '1800.00',
        journalEntryId: 'demo-je-current-grounds',
        postedAt: new Date('2026-05-02T12:00:00Z')
      },
      {
        id: bankTxId('posted-insurance'),
        connectionId: 'demo-bank-current',
        parishCouncilId: DEMO_COUNCIL_ID,
        providerTxId: 'posted-insurance',
        date: '2026-05-06',
        description: 'CAME COMPANY INSURANCE',
        amount: '-1450.00',
        supplierId: 'demo-supplier-came',
        reserveId: 'demo-reserve-general',
        merchantName: 'Came & Company Local Council Insurance',
        category: 'Insurance',
        transactionType: 'DEBIT',
        status: 'POSTED',
        nominalCodeId: currentCodes['5010'],
        vatRate: 'NO_VAT',
        vatTreatment: 'OUTSIDE_SCOPE',
        grossAmount: '1450.00',
        journalEntryId: 'demo-je-current-insurance',
        postedAt: new Date('2026-05-06T12:00:00Z')
      },
      {
        id: bankTxId('posted-play-equipment'),
        connectionId: 'demo-bank-current',
        parishCouncilId: DEMO_COUNCIL_ID,
        providerTxId: 'posted-play-equipment',
        date: '2026-05-16',
        description: 'PLAYWORKS SAFETY SERVICES',
        amount: '-1440.00',
        supplierId: 'demo-supplier-playworks',
        reserveId: 'demo-reserve-playground',
        projectId: 'demo-project-playground',
        merchantName: 'PlayWorks Safety Services',
        category: 'Fixed assets',
        transactionType: 'DEBIT',
        status: 'POSTED',
        nominalCodeId: currentCodes['1620'],
        vatRate: 'STANDARD_20',
        vatTreatment: 'RECOVERABLE',
        netAmount: '1200.00',
        vatAmount: '240.00',
        grossAmount: '1440.00',
        journalEntryId: 'demo-je-current-play-equipment',
        postedAt: new Date('2026-05-16T12:00:00Z')
      },
      {
        id: bankTxId('matched-cil-grant'),
        connectionId: 'demo-bank-current',
        parishCouncilId: DEMO_COUNCIL_ID,
        providerTxId: 'matched-cil-grant',
        date: '2026-05-17',
        description: 'NNC CIL NEIGHBOURHOOD',
        amount: '4200.00',
        reserveId: 'demo-reserve-cil',
        projectId: 'demo-project-hall-path',
        merchantName: 'North Northamptonshire Council',
        category: 'Grant',
        transactionType: 'CREDIT',
        status: 'MATCHED',
        nominalCodeId: currentCodes['4010'],
        vatRate: 'NO_VAT',
        vatTreatment: 'OUTSIDE_SCOPE',
        grossAmount: '4200.00',
        matchedJournalEntryId: 'demo-je-current-matched-grant',
        matchedAt: new Date('2026-05-17T12:00:00Z')
      },
      {
        id: bankTxId('coded-audit-fee'),
        connectionId: 'demo-bank-current',
        parishCouncilId: DEMO_COUNCIL_ID,
        providerTxId: 'coded-audit-fee',
        date: '2026-05-18',
        description: 'PKF LITTLEJOHN LLP',
        amount: '-720.00',
        reserveId: 'demo-reserve-general',
        merchantName: 'PKF Littlejohn LLP',
        category: 'Audit',
        transactionType: 'DEBIT',
        status: 'CODED',
        nominalCodeId: currentCodes['5030'],
        vatRate: 'STANDARD_20',
        vatTreatment: 'RECOVERABLE',
        netAmount: '600.00',
        vatAmount: '120.00',
        grossAmount: '720.00',
        notes: 'Ready to post during the demo.'
      },
      {
        id: bankTxId('pending-training'),
        connectionId: 'demo-bank-current',
        parishCouncilId: DEMO_COUNCIL_ID,
        providerTxId: 'pending-training',
        date: '2026-05-13',
        description: 'NORTHANTS ALC TRAINING',
        amount: '-95.00',
        reserveId: 'demo-reserve-general',
        merchantName: 'Northants ALC',
        category: 'Training',
        transactionType: 'DEBIT',
        status: 'PENDING',
        vatRate: 'NO_VAT',
        vatTreatment: 'OUTSIDE_SCOPE',
        grossAmount: '95.00',
        notes: 'Uncoded inbox item for workflow demo.'
      },
      {
        id: bankTxId('pending-room-hire'),
        connectionId: 'demo-bank-current',
        parishCouncilId: DEMO_COUNCIL_ID,
        providerTxId: 'pending-room-hire',
        date: '2026-05-14',
        description: 'COMMUNITY ROOM HIRE',
        amount: '85.00',
        reserveId: 'demo-reserve-general',
        merchantName: 'Community Room Hire',
        category: 'Income',
        transactionType: 'CREDIT',
        status: 'PENDING',
        vatRate: 'NO_VAT',
        vatTreatment: 'OUTSIDE_SCOPE',
        grossAmount: '85.00',
        notes: 'Receipt to code as other income.'
      },
      {
        id: bankTxId('pending-large-payment'),
        connectionId: 'demo-bank-current',
        parishCouncilId: DEMO_COUNCIL_ID,
        providerTxId: 'pending-large-payment',
        date: '2026-05-18',
        description: 'BELLAMY SURFACING LTD',
        amount: '-6400.00',
        reserveId: 'demo-reserve-playground',
        projectId: 'demo-project-playground',
        merchantName: 'Bellamy Surfacing Ltd',
        category: 'Repairs',
        transactionType: 'DEBIT',
        status: 'PENDING',
        vatRate: 'STANDARD_20',
        vatTreatment: 'RECOVERABLE',
        netAmount: '5333.33',
        vatAmount: '1066.67',
        grossAmount: '6400.00',
        notes: 'Large payment and VAT coding demo item.'
      },
      {
        id: bankTxId('pending-manual-fete-receipt'),
        connectionId: 'demo-bank-current',
        parishCouncilId: DEMO_COUNCIL_ID,
        providerTxId: 'pending-manual-fete-receipt',
        date: '2026-05-12',
        description: 'SUMUP VILLAGE FETE STALL',
        amount: '250.00',
        reserveId: 'demo-reserve-general',
        merchantName: 'SumUp Village Fete Stall',
        category: 'Income',
        transactionType: 'CREDIT',
        status: 'PENDING',
        vatRate: 'NO_VAT',
        vatTreatment: 'OUTSIDE_SCOPE',
        grossAmount: '250.00',
        notes:
          'Manual-entry-first demo: match this to MAN-2026-FETE-RECEIPT instead of posting it again.'
      }
    ])

    await trx.insert(matchingRules).values([
      {
        id: 'demo-rule-greenacre',
        parishCouncilId: DEMO_COUNCIL_ID,
        name: 'Greenacre grounds maintenance',
        matchField: 'description',
        matchType: 'contains',
        matchValue: 'GREENACRE',
        nominalCodeCode: '5100',
        priority: 10,
        isActive: true
      },
      {
        id: 'demo-rule-precept',
        parishCouncilId: DEMO_COUNCIL_ID,
        name: 'Precept receipt',
        matchField: 'description',
        matchType: 'contains',
        matchValue: 'PRECEPT',
        nominalCodeCode: '4000',
        priority: 20,
        isActive: true
      }
    ])
  })

  const signUpResult = await auth.api.signUpEmail({
    body: {
      name: 'Demo RFO',
      email: DEMO_USER_EMAIL,
      password: DEMO_USER_PASSWORD
    },
    headers: new Headers({
      host: new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').host
    })
  })

  await db
    .update(user)
    .set({
      parishCouncilId: DEMO_COUNCIL_ID,
      role: 'CLERK',
      emailVerified: true,
      updatedAt: new Date()
    })
    .where(eq(user.id, signUpResult.user.id))

  console.log('Demo council reseeded successfully.')
  console.log(`Sign in: ${DEMO_USER_EMAIL}`)
  console.log(`Password: ${DEMO_USER_PASSWORD}`)
}

async function seedNominalCodes(
  trx: Parameters<Parameters<typeof import('@/db').db.transaction>[0]>[0],
  financialYearId: FinancialYearId,
  defaultChart: DefaultNominal[]
): Promise<CodeMap> {
  const { nominalCodes } = await import('@/db/schema/nominalLedger')
  const values = defaultChart.map(item => ({
    id: codeId(financialYearId, item.code),
    parishCouncilId: DEMO_COUNCIL_ID,
    financialYearId,
    code: item.code,
    name: item.name,
    type: item.type,
    category: item.category,
    agarBox: item.agarBox ?? null,
    isBank: item.isBank ?? false,
    isVatRecoverable: item.isVatRecoverable ?? false,
    isVatPayable: item.isVatPayable ?? false,
    isActive: true
  }))

  await trx.insert(nominalCodes).values(values)

  return Object.fromEntries(values.map(value => [value.code, value.id]))
}

async function seedOpeningBalances(
  trx: Parameters<Parameters<typeof import('@/db').db.transaction>[0]>[0],
  financialYearId: FinancialYearId,
  codes: CodeMap,
  balances: Record<string, number>
) {
  const { nominalOpeningBalances } = await import('@/db/schema/nominalLedger')
  validateOpeningBalances(financialYearId, balances)

  for (const code of Object.keys(balances)) {
    if (!codes[code]) {
      throw new Error(
        `Opening balance seed for ${financialYearId} references missing nominal code ${code}.`
      )
    }
  }

  await trx.insert(nominalOpeningBalances).values(
    Object.entries(balances).map(([code, amount]) => ({
      id: `demo-ob-${financialYearId}-${code}`,
      parishCouncilId: DEMO_COUNCIL_ID,
      financialYearId,
      nominalCodeId: codes[code],
      amount: formatAmount(amount)
    }))
  )
}

async function seedJournals(
  trx: Parameters<Parameters<typeof import('@/db').db.transaction>[0]>[0],
  financialYearId: FinancialYearId,
  codes: CodeMap,
  journals: Array<{
    id: string
    reference: string
    date: string
    description: string
    source: 'BANK_FEED' | 'MANUAL' | 'YEAR_END' | 'OPENING_BALANCE' | 'VAT_RETURN'
    sourceId?: string
    excludeFromAgar?: boolean
    lines: Array<[code: string, debit: number, credit: number]>
  }>
) {
  const { journalEntries, journalLines } = await import(
    '@/db/schema/nominalLedger'
  )

  for (const journal of journals) {
    validateJournalBalances(journal)

    await trx.insert(journalEntries).values({
      id: journal.id,
      parishCouncilId: DEMO_COUNCIL_ID,
      financialYearId,
      reference: journal.reference,
      date: journal.date,
      description: journal.description,
      source: journal.source,
      sourceId: journal.sourceId,
      excludeFromAgar:
        journal.excludeFromAgar ?? journal.source === 'VAT_RETURN'
    })

    await trx.insert(journalLines).values(
      journal.lines.map(([code, debit, credit], index) => ({
        id: lineId(journal.id, index + 1),
        parishCouncilId: DEMO_COUNCIL_ID,
        journalEntryId: journal.id,
        nominalCodeId: codes[code],
        reserveId: 'demo-reserve-general',
        debit: formatAmount(debit),
        credit: formatAmount(credit),
        description: journal.description
      }))
    )
  }
}

function toCents(amount: number) {
  return Math.round(amount * 100)
}

function validateJournalBalances(journal: {
  reference: string
  lines: Array<[code: string, debit: number, credit: number]>
}) {
  const totalDebits = journal.lines.reduce(
    (sum, [, debit]) => sum + toCents(debit),
    0
  )
  const totalCredits = journal.lines.reduce(
    (sum, [, , credit]) => sum + toCents(credit),
    0
  )

  if (totalDebits !== totalCredits) {
    throw new Error(
      `Seed journal ${journal.reference} does not balance: debits ${formatAmount(totalDebits / 100)}, credits ${formatAmount(totalCredits / 100)}.`
    )
  }
}

function validateOpeningBalances(
  financialYearId: FinancialYearId,
  balances: Record<string, number>
) {
  const requiredCodes = ['1200', '1210', '1600', '2300', '3000', '3090', '3095']
  const expectedBalances = EXPECTED_DEMO_OPENING_BALANCES[financialYearId]

  for (const code of requiredCodes) {
    if (!(code in balances)) {
      throw new Error(
        `Opening balance seed for ${financialYearId} is missing nominal code ${code}.`
      )
    }

    const expectedAmount = expectedBalances[code]

    if (toCents((balances[code] ?? 0) - expectedAmount) !== 0) {
      throw new Error(
        `Opening balance seed for ${financialYearId} code ${code} should be ${formatAmount(expectedAmount)} but received ${formatAmount(balances[code] ?? 0)}.`
      )
    }
  }

  const total = Object.values(balances).reduce(
    (sum, amount) => sum + toCents(amount),
    0
  )

  if (total !== 0) {
    throw new Error(
      `Opening balances for ${financialYearId} do not balance: total ${formatAmount(total / 100)}.`
    )
  }

  const fixedAssetOpening = balances['1600'] ?? 0
  const fixedAssetMemoReserve = balances['3090'] ?? 0

  if (toCents(fixedAssetOpening + fixedAssetMemoReserve) !== 0) {
    throw new Error(
      `Opening fixed assets for ${financialYearId} must be balanced by 3090 Fixed Asset Opening Reserve.`
    )
  }

  const borrowingOpening = balances['2300'] ?? 0
  const borrowingMemoReserve = balances['3095'] ?? 0

  if (toCents(borrowingOpening + borrowingMemoReserve) !== 0) {
    throw new Error(
      `Opening borrowings for ${financialYearId} must be balanced by 3095 Borrowings Opening Reserve.`
    )
  }

  const cashBackedOpening = (balances['1200'] ?? 0) + (balances['1210'] ?? 0)
  const generalReserve = balances['3000'] ?? 0

  if (toCents(cashBackedOpening + generalReserve) !== 0) {
    throw new Error(
      `General Reserve opening for ${financialYearId} must equal cash-backed AGAR reserves only.`
    )
  }
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
