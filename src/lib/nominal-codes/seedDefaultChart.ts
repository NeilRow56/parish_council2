import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { financialYears, nominalCodes } from '@/db/schema/nominalLedger'
import { defaultChart } from '@/lib/nominal-codes/default-chart'
import {
  getParishFinancialYearForDate,
  getParishFinancialYearFromStartYear
} from '@/lib/financial-years/parish-year'

export async function seedDefaultChart({
  parishCouncilId,
  financialYearStartYear
}: {
  parishCouncilId: string
  financialYearStartYear?: number
}) {
  const fy =
    financialYearStartYear === undefined
      ? getParishFinancialYearForDate()
      : getParishFinancialYearFromStartYear(financialYearStartYear)

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
        agarBox: item.agarBox ?? null,
        isBank: item.isBank ?? false,
        isVatRecoverable: item.isVatRecoverable ?? false,
        isVatPayable: item.isVatPayable ?? false,
        isActive: true
      })
    }
  }

  return year
}
