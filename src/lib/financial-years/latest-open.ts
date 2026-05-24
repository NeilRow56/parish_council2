import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { financialYears } from '@/db/schema/nominalLedger'

export async function getLatestOpenFinancialYear(parishCouncilId: string) {
  const [financialYear] = await getOpenFinancialYears(parishCouncilId)

  return financialYear ?? null
}

export async function getOpenFinancialYears(parishCouncilId: string) {
  return db
    .select()
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.isClosed, false)
      )
    )
    .orderBy(desc(financialYears.startDate))
}

export async function getFinancialYearsForCouncil(parishCouncilId: string) {
  return db
    .select()
    .from(financialYears)
    .where(eq(financialYears.parishCouncilId, parishCouncilId))
    .orderBy(desc(financialYears.startDate))
}
