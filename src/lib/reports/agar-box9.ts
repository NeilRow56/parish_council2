import { and, eq, gte, lte, sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  journalEntries,
  journalLines,
  nominalCodes,
  nominalOpeningBalances
} from '@/db/schema/nominalLedger'

type FinancialYearForAgarBox9 = {
  id: string
  startDate: string
  endDate: string
}

function normalise(value: unknown) {
  return Number(value ?? 0)
}

export async function getAgarBox9Figure({
  parishCouncilId,
  financialYear
}: {
  parishCouncilId: string
  financialYear: FinancialYearForAgarBox9
}) {
  const [openingTotals] = await db
    .select({
      fixedAssets: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_9_FIXED_ASSETS'
            then ${nominalOpeningBalances.amount}
            else 0
          end
        ), 0)
      `
    })
    .from(nominalOpeningBalances)
    .innerJoin(
      nominalCodes,
      eq(nominalOpeningBalances.nominalCodeId, nominalCodes.id)
    )
    .where(
      and(
        eq(nominalOpeningBalances.parishCouncilId, parishCouncilId),
        eq(nominalOpeningBalances.financialYearId, financialYear.id)
      )
    )

  const [totals] = await db
    .select({
      fixedAssets: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.agarBox} = 'BOX_9_FIXED_ASSETS'
            then ${journalLines.debit} - ${journalLines.credit}
            else 0
          end
        ), 0)
      `
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .innerJoin(nominalCodes, eq(journalLines.nominalCodeId, nominalCodes.id))
    .where(
      and(
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, financialYear.id),
        gte(journalEntries.date, financialYear.startDate),
        lte(journalEntries.date, financialYear.endDate)
      )
    )

  return normalise(openingTotals?.fixedAssets) + normalise(totals?.fixedAssets)
}
