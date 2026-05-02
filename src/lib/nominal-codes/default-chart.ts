// src/lib/nominal-codes/default-chart.ts

export type DefaultNominal = {
  code: string
  name: string
  type: 'INCOME' | 'EXPENDITURE' | 'BALANCE_SHEET'
  category: string
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
    isBank: true
  },
  {
    code: '1210',
    name: 'Savings Account 1',
    type: 'BALANCE_SHEET',
    category: 'Bank',
    isBank: true
  },
  {
    code: '1220',
    name: 'Transaction Account 2',
    type: 'BALANCE_SHEET',
    category: 'Bank',
    isBank: true
  },
  {
    code: '1230',
    name: 'Savings Account 2',
    type: 'BALANCE_SHEET',
    category: 'Bank',
    isBank: true
  },
  {
    code: '1240',
    name: 'Transaction Account 3',
    type: 'BALANCE_SHEET',
    category: 'Bank',
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
    category: 'Income'
  },
  {
    code: '4010',
    name: 'Grants',
    type: 'INCOME',
    category: 'Income'
  },
  {
    code: '4020',
    name: 'Donations',
    type: 'INCOME',
    category: 'Income'
  },
  {
    code: '4030',
    name: 'Other Income',
    type: 'INCOME',
    category: 'Income'
  },

  // ─── Expenditure ───────────────────────────────────────────
  {
    code: '5000',
    name: 'General Administration',
    type: 'EXPENDITURE',
    category: 'Admin'
  },
  {
    code: '5010',
    name: 'Insurance',
    type: 'EXPENDITURE',
    category: 'Admin'
  },
  {
    code: '5020',
    name: 'Licences & Subscriptions',
    type: 'EXPENDITURE',
    category: 'Admin'
  },
  {
    code: '5030',
    name: 'Audit Fees',
    type: 'EXPENDITURE',
    category: 'Admin'
  },
  {
    code: '5040',
    name: 'Clerk Salary',
    type: 'EXPENDITURE',
    category: 'Staff'
  },
  {
    code: '5050',
    name: 'PAYE / NI',
    type: 'EXPENDITURE',
    category: 'Staff'
  },
  {
    code: '5100',
    name: 'Grounds Maintenance',
    type: 'EXPENDITURE',
    category: 'Maintenance'
  },
  {
    code: '5110',
    name: 'Repairs & Maintenance',
    type: 'EXPENDITURE',
    category: 'Maintenance'
  },
  {
    code: '5120',
    name: 'Utilities',
    type: 'EXPENDITURE',
    category: 'Running Costs'
  },
  {
    code: '5130',
    name: 'Subscriptions',
    type: 'EXPENDITURE',
    category: 'Admin'
  },
  {
    code: '5140',
    name: 'Training',
    type: 'EXPENDITURE',
    category: 'Admin'
  },
  {
    code: '5150',
    name: 'Office Costs',
    type: 'EXPENDITURE',
    category: 'Admin'
  },
  {
    code: '5160',
    name: 'Website / IT',
    type: 'EXPENDITURE',
    category: 'IT'
  }
]
