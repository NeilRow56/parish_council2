import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { financialYears, nominalCodes } from '@/db/schema/nominalLedger'
import { defaultChart } from '@/lib/nominal-codes/default-chart'

function getCurrentParishFinancialYear(today = new Date()) {
  const year = today.getFullYear()
  const month = today.getMonth() // Jan = 0, Apr = 3

  const startYear = month >= 3 ? year : year - 1
  const endYear = startYear + 1

  return {
    label: `${startYear}/${String(endYear).slice(-2)}`,
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`
  }
}

export async function seedDefaultChart({
  parishCouncilId
}: {
  parishCouncilId: string
}) {
  const fy = getCurrentParishFinancialYear()

  let [year] = await db
    .select()
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.label, fy.label)
      )
    )
    .limit(1)

  if (!year) {
    ;[year] = await db
      .insert(financialYears)
      .values({
        parishCouncilId,
        label: fy.label,
        startDate: fy.startDate,
        endDate: fy.endDate,
        isClosed: false
      })
      .returning()
  }

  for (const item of defaultChart) {
    const [exists] = await db
      .select({ id: nominalCodes.id })
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.parishCouncilId, parishCouncilId),
          eq(nominalCodes.financialYearId, year.id),
          eq(nominalCodes.code, item.code)
        )
      )
      .limit(1)

    if (!exists) {
      await db.insert(nominalCodes).values({
        parishCouncilId,
        financialYearId: year.id,
        code: item.code,
        name: item.name,
        type: item.type,
        category: item.category,
        isBank: item.isBank ?? false,
        isActive: true
      })
    }
  }

  return year
}
