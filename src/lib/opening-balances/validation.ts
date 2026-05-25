export type OpeningBalanceNominalCode = {
  category: string | null
  code: string
  name?: string
  type?: string
  agarBox: string | null
  isBank?: boolean
}

export function isFixedAssetCode(code: { category: string | null }) {
  return code.category === 'Fixed Assets'
}

export function isBorrowingCode(code: { agarBox: string | null }) {
  return code.agarBox === 'BOX_10_BORROWINGS'
}

export function isMemoReserveCode(code: { code: string }) {
  return code.code === '3090' || code.code === '3095'
}

export function isNormalReserveCode(code: {
  category: string | null
  code: string
}) {
  return code.category === 'Reserves' && !isMemoReserveCode(code)
}

export function isOpeningBalanceLiabilityCode(code: {
  category: string | null
  code: string
  name?: string
  agarBox: string | null
}) {
  const name = code.name?.toLowerCase() ?? ''

  return (
    isBorrowingCode(code) ||
    name.includes('creditor') ||
    name.includes('accrual') ||
    name.includes('receipt in advance') ||
    name.includes('output vat') ||
    name.includes('vat payable')
  )
}

export function openingBalanceSignForCode(code: {
  category: string | null
  code: string
  name?: string
  agarBox: string | null
}) {
  if (isNormalReserveCode(code) || isOpeningBalanceLiabilityCode(code)) {
    return -1
  }

  return 1
}

export function toStoredOpeningBalanceAmount(
  code: {
    category: string | null
    code: string
    name?: string
    agarBox: string | null
  },
  positiveAmount: number
) {
  return positiveAmount * openingBalanceSignForCode(code)
}

export function openingBalanceCentsTotal(amounts: Iterable<number>) {
  return Array.from(amounts).reduce(
    (sum, amount) => sum + Math.round(amount * 100),
    0
  )
}

export function openingBalancesBalance(amounts: Iterable<number>) {
  return openingBalanceCentsTotal(amounts) === 0
}
