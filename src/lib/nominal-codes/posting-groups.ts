export type PostingNominalCode = {
  code: string
  name: string
  type: string
  category: string | null
  isBank?: boolean
}

type PostingNominalCodeGroup<TCode extends PostingNominalCode> = {
  label: string
  codes: TCode[]
}

const controlCodes = new Set([
  '2100',
  '2110',
  '2120',
  '2150',
  '2160',
  '2200',
  '2210',
  '2220'
])
const liabilityCodes = new Set(['2300'])
const reserveCodes = new Set(['3000', '3010', '3090', '3095'])
const paymentCategoryOrder = new Map([
  ['Admin', '01'],
  ['Staff', '02'],
  ['Maintenance', '03'],
  ['Running Costs', '04'],
  ['IT', '05'],
  ['Finance', '06']
])

function postingGroupLabel(code: PostingNominalCode) {
  if (code.isBank || code.category === 'Bank') return 'Bank'
  if (controlCodes.has(code.code) || code.category === 'Control') {
    return 'Control / working balances'
  }
  if (code.category === 'Fixed Assets') return 'Fixed assets'
  if (liabilityCodes.has(code.code)) return 'Liabilities'
  if (reserveCodes.has(code.code) || code.category === 'Reserves')
    return 'Reserves'
  if (code.type === 'INCOME') return 'Receipts'
  if (code.type === 'EXPENDITURE') {
    return `Payments - ${code.category ?? 'General'}`
  }

  return code.category ?? 'Other'
}

function groupSortKey(label: string) {
  if (label === 'Receipts') return `01:${label}`
  if (label.startsWith('Payments - ')) {
    const category = label.replace('Payments - ', '')
    return `02:${paymentCategoryOrder.get(category) ?? '99'}:${label}`
  }
  if (label.startsWith('Payments')) return `02:99:${label}`
  if (label === 'Bank') return `03:${label}`
  if (label === 'Control / working balances') return `04:${label}`
  if (label === 'Fixed assets') return `05:${label}`
  if (label === 'Liabilities') return `06:${label}`
  if (label === 'Reserves') return `07:${label}`
  return `99:${label}`
}

export function groupNominalCodesForPosting<TCode extends PostingNominalCode>(
  codes: TCode[]
): PostingNominalCodeGroup<TCode>[] {
  const groups = codes.reduce<Record<string, TCode[]>>((acc, code) => {
    const label = postingGroupLabel(code)
    acc[label] = acc[label] ?? []
    acc[label].push(code)
    return acc
  }, {})

  return Object.entries(groups)
    .sort(([labelA], [labelB]) =>
      groupSortKey(labelA).localeCompare(groupSortKey(labelB))
    )
    .map(([label, groupCodes]) => ({
      label,
      codes: [...groupCodes].sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true })
      )
    }))
}
