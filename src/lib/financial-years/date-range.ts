export type FinancialYearDateRange = {
  label: string
  startDate: string | Date
  endDate: string | Date
}

function toDateInputString(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }

  return value.split('T')[0]
}

function formatDisplayDate(value: string | Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(toDateInputString(value)))
}

export function isDateWithinFinancialYear(
  date: string,
  financialYear: FinancialYearDateRange
) {
  const inputDate = toDateInputString(date)
  const startDate = toDateInputString(financialYear.startDate)
  const endDate = toDateInputString(financialYear.endDate)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
    return false
  }

  return inputDate >= startDate && inputDate <= endDate
}

export function formatFinancialYearRange(
  financialYear: FinancialYearDateRange
) {
  return `${formatDisplayDate(financialYear.startDate)} and ${formatDisplayDate(
    financialYear.endDate
  )}`
}

export function getFinancialYearDateWarning(
  date: string,
  financialYear: FinancialYearDateRange
) {
  if (!date || isDateWithinFinancialYear(date, financialYear)) {
    return null
  }

  return `This date is outside the current financial year ${
    financialYear.label
  }. Please choose a date between ${formatFinancialYearRange(financialYear)}.`
}
