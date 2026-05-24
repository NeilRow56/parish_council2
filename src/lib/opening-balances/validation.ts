export type OpeningBalanceNominalCode = {
  category: string | null
  code: string
  agarBox: string | null
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

export function openingBalanceCentsTotal(amounts: Iterable<number>) {
  return Array.from(amounts).reduce(
    (sum, amount) => sum + Math.round(amount * 100),
    0
  )
}

export function openingBalancesBalance(amounts: Iterable<number>) {
  return openingBalanceCentsTotal(amounts) === 0
}
