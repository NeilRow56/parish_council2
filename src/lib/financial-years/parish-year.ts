export type ParishFinancialYearSpec = {
  label: string
  startDate: string
  endDate: string
  startYear: number
}

export function getParishFinancialYearFromStartYear(
  startYear: number
): ParishFinancialYearSpec {
  const endYear = startYear + 1

  return {
    label: `${startYear}/${String(endYear).slice(-2)}`,
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`,
    startYear
  }
}

export function getParishFinancialYearForDate(
  date = new Date()
): ParishFinancialYearSpec {
  const year = date.getFullYear()
  const month = date.getMonth()
  const startYear = month >= 3 ? year : year - 1

  return getParishFinancialYearFromStartYear(startYear)
}

export function getInitialFinancialYearOptions(date = new Date()) {
  const currentStartYear = getParishFinancialYearForDate(date).startYear

  return [currentStartYear - 1, currentStartYear, currentStartYear + 1].map(
    getParishFinancialYearFromStartYear
  )
}
