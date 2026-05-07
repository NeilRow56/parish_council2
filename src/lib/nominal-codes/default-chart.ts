// src/lib/nominal-codes/default-chart.ts

export type AgarBox =
  | 'BOX_2_PRECEPT'
  | 'BOX_3_OTHER_RECEIPTS'
  | 'BOX_4_STAFF_COSTS'
  | 'BOX_5_LOAN_REPAYMENTS'
  | 'BOX_6_OTHER_PAYMENTS'
  | 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS'
  | 'BOX_9_FIXED_ASSETS'
  | 'BOX_10_BORROWINGS'

export type DefaultNominal = {
  code: string
  name: string
  type: 'INCOME' | 'EXPENDITURE' | 'BALANCE_SHEET'
  category: string
  agarBox?: AgarBox
  isBank?: boolean
  isVatRecoverable?: boolean
  isVatPayable?: boolean
}

export const defaultChart: DefaultNominal[] = [
  // ─── Balance sheet ─────────────────────────────────────────
  {
    code: '1200',
    name: 'Transaction Account 1',
    type: 'BALANCE_SHEET',
    category: 'Bank',
    agarBox: 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS',
    isBank: true
  },
  {
    code: '1210',
    name: 'Savings Account 1',
    type: 'BALANCE_SHEET',
    category: 'Bank',
    agarBox: 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS',
    isBank: true
  },
  {
    code: '1220',
    name: 'Transaction Account 2',
    type: 'BALANCE_SHEET',
    category: 'Bank',
    agarBox: 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS',
    isBank: true
  },
  {
    code: '1230',
    name: 'Savings Account 2',
    type: 'BALANCE_SHEET',
    category: 'Bank',
    agarBox: 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS',
    isBank: true
  },
  {
    code: '1240',
    name: 'Transaction Account 3',
    type: 'BALANCE_SHEET',
    category: 'Bank',
    agarBox: 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS',
    isBank: true
  },
  {
    code: '2100',
    name: 'VAT / Control Account',
    type: 'BALANCE_SHEET',
    category: 'Control'
  },
  {
    code: '2110',
    name: 'Input VAT recoverable',
    type: 'BALANCE_SHEET',
    category: 'Control',
    isVatRecoverable: true
  },
  {
    code: '2120',
    name: 'Output VAT payable',
    type: 'BALANCE_SHEET',
    category: 'Control',
    isVatPayable: true
  },
  {
    code: '2200',
    name: 'Creditors',
    type: 'BALANCE_SHEET',
    category: 'Liabilities'
  },

  // ─── Income ────────────────────────────────────────────────
  {
    code: '4000',
    name: 'Precept',
    type: 'INCOME',
    category: 'Income',
    agarBox: 'BOX_2_PRECEPT'
  },
  {
    code: '4010',
    name: 'Grants',
    type: 'INCOME',
    category: 'Income',
    agarBox: 'BOX_3_OTHER_RECEIPTS'
  },
  {
    code: '4020',
    name: 'Donations',
    type: 'INCOME',
    category: 'Income',
    agarBox: 'BOX_3_OTHER_RECEIPTS'
  },
  {
    code: '4030',
    name: 'Other Income',
    type: 'INCOME',
    category: 'Income',
    agarBox: 'BOX_3_OTHER_RECEIPTS'
  },

  // ─── Expenditure ───────────────────────────────────────────
  {
    code: '5000',
    name: 'General Administration',
    type: 'EXPENDITURE',
    category: 'Admin',
    agarBox: 'BOX_6_OTHER_PAYMENTS'
  },
  {
    code: '5010',
    name: 'Insurance',
    type: 'EXPENDITURE',
    category: 'Admin',
    agarBox: 'BOX_6_OTHER_PAYMENTS'
  },
  {
    code: '5020',
    name: 'Licences & Subscriptions',
    type: 'EXPENDITURE',
    category: 'Admin',
    agarBox: 'BOX_6_OTHER_PAYMENTS'
  },
  {
    code: '5030',
    name: 'Audit Fees',
    type: 'EXPENDITURE',
    category: 'Admin',
    agarBox: 'BOX_6_OTHER_PAYMENTS'
  },
  {
    code: '5040',
    name: 'Clerk Salary',
    type: 'EXPENDITURE',
    category: 'Staff',
    agarBox: 'BOX_4_STAFF_COSTS'
  },
  {
    code: '5050',
    name: 'PAYE / NI',
    type: 'EXPENDITURE',
    category: 'Staff',
    agarBox: 'BOX_4_STAFF_COSTS'
  },
  {
    code: '5100',
    name: 'Grounds Maintenance',
    type: 'EXPENDITURE',
    category: 'Maintenance',
    agarBox: 'BOX_6_OTHER_PAYMENTS'
  },
  {
    code: '5110',
    name: 'Repairs & Maintenance',
    type: 'EXPENDITURE',
    category: 'Maintenance',
    agarBox: 'BOX_6_OTHER_PAYMENTS'
  },
  {
    code: '5120',
    name: 'Utilities',
    type: 'EXPENDITURE',
    category: 'Running Costs',
    agarBox: 'BOX_6_OTHER_PAYMENTS'
  },
  {
    code: '5130',
    name: 'Subscriptions',
    type: 'EXPENDITURE',
    category: 'Admin',
    agarBox: 'BOX_6_OTHER_PAYMENTS'
  },
  {
    code: '5140',
    name: 'Training',
    type: 'EXPENDITURE',
    category: 'Admin',
    agarBox: 'BOX_6_OTHER_PAYMENTS'
  },
  {
    code: '5150',
    name: 'Office Costs',
    type: 'EXPENDITURE',
    category: 'Admin',
    agarBox: 'BOX_6_OTHER_PAYMENTS'
  },
  {
    code: '5160',
    name: 'Website / IT',
    type: 'EXPENDITURE',
    category: 'IT',
    agarBox: 'BOX_6_OTHER_PAYMENTS'
  }
]
