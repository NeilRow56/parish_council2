import { cookies } from 'next/headers'

import { getFinancialYearsForCouncil } from './latest-open'

export function getSelectedFinancialYearCookieName(parishCouncilId: string) {
  return `pc_selected_fy_${parishCouncilId}`
}

export async function getSelectedFinancialYear(
  parishCouncilId: string,
  explicitFinancialYearId?: string | null
) {
  const years = await getFinancialYearsForCouncil(parishCouncilId)

  if (years.length === 0) {
    return {
      financialYear: null,
      years,
      source: 'none' as const
    }
  }

  if (explicitFinancialYearId) {
    const explicitYear =
      years.find(year => year.id === explicitFinancialYearId) ?? null

    return {
      financialYear: explicitYear,
      years,
      source: explicitYear
        ? ('explicit' as const)
        : ('invalid-explicit' as const)
    }
  }

  const cookieStore = await cookies()
  const cookieName = getSelectedFinancialYearCookieName(parishCouncilId)
  const cookieFinancialYearId = cookieStore.get(cookieName)?.value
  const cookieYear = cookieFinancialYearId
    ? (years.find(year => year.id === cookieFinancialYearId) ?? null)
    : null

  if (cookieYear) {
    return {
      financialYear: cookieYear,
      years,
      source: 'cookie' as const
    }
  }

  const latestOpenYear = years.find(year => !year.isClosed) ?? null

  return {
    financialYear: latestOpenYear ?? years[0],
    years,
    source: latestOpenYear ? ('latest-open' as const) : ('latest-year' as const)
  }
}
