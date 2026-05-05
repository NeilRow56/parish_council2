export const DEFAULT_VAT_RATES = [
  {
    code: 'NO_VAT',
    name: 'No VAT',
    ratePercent: '0.00',
    isSystem: true,
    sortOrder: 100
  },
  {
    code: 'ZERO',
    name: 'Zero rated',
    ratePercent: '0.00',
    isSystem: true,
    sortOrder: 200
  },
  {
    code: 'STANDARD_20',
    name: 'Standard 20%',
    ratePercent: '20.00',
    isSystem: true,
    sortOrder: 400
  },
  {
    code: 'REDUCED_5',
    name: 'Reduced 5%',
    ratePercent: '5.00',
    isSystem: true,
    sortOrder: 300
  }
]
