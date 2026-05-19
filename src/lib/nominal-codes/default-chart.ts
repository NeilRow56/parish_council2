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
  agarBox?: AgarBox | null
  isBank?: boolean
  isVatRecoverable?: boolean
  isVatPayable?: boolean
}

export const defaultChart: DefaultNominal[] = [
  // ─── Balance sheet ─────────────────────────────────────────
  // ─── Bank ────────────────────────────────────────────────
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
  // ─── Fixed Assets ────────────────────────────────────────────────
  {
    code: '1600',
    name: 'Fixed Assets - Land and Buildings',
    type: 'BALANCE_SHEET',
    category: 'Fixed Assets',
    agarBox: 'BOX_9_FIXED_ASSETS'
  },
  {
    code: '1610',
    name: 'Fixed Assets - Street Furniture',
    type: 'BALANCE_SHEET',
    category: 'Fixed Assets',
    agarBox: 'BOX_9_FIXED_ASSETS'
  },
  {
    code: '1620',
    name: 'Fixed Assets - Play Equipment',
    type: 'BALANCE_SHEET',
    category: 'Fixed Assets',
    agarBox: 'BOX_9_FIXED_ASSETS'
  },
  {
    code: '1630',
    name: 'Fixed Assets - Office Equipment',
    type: 'BALANCE_SHEET',
    category: 'Fixed Assets',
    agarBox: 'BOX_9_FIXED_ASSETS'
  },
  {
    code: '1640',
    name: 'Fixed Assets - War Memorials',
    type: 'BALANCE_SHEET',
    category: 'Fixed Assets',
    agarBox: 'BOX_9_FIXED_ASSETS'
  },
  {
    code: '1650',
    name: 'Fixed Assets - Other Community Assets',
    type: 'BALANCE_SHEET',
    category: 'Fixed Assets',
    agarBox: 'BOX_9_FIXED_ASSETS'
  },
  // ─── VAT ────────────────────────────────────────────────
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
  // ─── Borrowings ────────────────────────────────────────────────
  {
    code: '2300',
    name: 'Borrowings / Loans Outstanding',
    type: 'BALANCE_SHEET',
    category: 'Liabilities',
    agarBox: 'BOX_10_BORROWINGS'
  },
  // ─── Reserves ────────────────────────────────────────────────
  {
    code: '3000',
    name: 'General Reserve',
    type: 'BALANCE_SHEET',
    category: 'Reserves',
    isBank: false,
    isVatRecoverable: false,
    isVatPayable: false,
    agarBox: null
  },
  {
    code: '3010',
    name: 'Earmarked Reserves',
    type: 'BALANCE_SHEET',
    category: 'Reserves',
    isBank: false,
    isVatRecoverable: false,
    isVatPayable: false,
    agarBox: null
  },
  {
    code: '3090',
    name: 'Fixed Asset Opening Reserve (memo only)',
    type: 'BALANCE_SHEET',
    category: 'Reserves',
    isBank: false,
    isVatRecoverable: false,
    isVatPayable: false,
    agarBox: null
  },
  {
    code: '3095',
    name: 'Borrowings Opening Reserve (memo only)',
    type: 'BALANCE_SHEET',
    category: 'Reserves',
    isBank: false,
    isVatRecoverable: false,
    isVatPayable: false,
    agarBox: null
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
  },
  {
    code: '5200',
    name: 'Loan Repayments',
    type: 'EXPENDITURE',
    category: 'Finance',
    agarBox: 'BOX_5_LOAN_REPAYMENTS'
  },
  {
    code: '5210',
    name: 'Loan Interest',
    type: 'EXPENDITURE',
    category: 'Finance',
    agarBox: 'BOX_5_LOAN_REPAYMENTS'
  }
]
