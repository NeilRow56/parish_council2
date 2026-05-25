// src/server/seeds/seedVatRates.ts

import { db } from '@/db'
import { vatRates } from '@/db/schema'
import { DEFAULT_VAT_RATES } from '@/lib/vat/default-vat-rates'
import { and, count, eq } from 'drizzle-orm'

export async function seedVatRatesForCouncil(parishCouncilId: string) {
  for (const rate of DEFAULT_VAT_RATES) {
    const existing = await db.query.vatRates.findFirst({
      where: and(
        eq(vatRates.parishCouncilId, parishCouncilId),
        eq(vatRates.code, rate.code)
      )
    })

    if (!existing) {
      await db.insert(vatRates).values({
        parishCouncilId,
        code: rate.code,
        name: rate.name,
        ratePercent: rate.ratePercent,
        isSystem: rate.isSystem,
        sortOrder: rate.sortOrder,
        isActive: true
      })
    }
  }
}

export async function ensureDefaultVatRatesForCouncil(parishCouncilId: string) {
  const [existing] = await db
    .select({ total: count() })
    .from(vatRates)
    .where(eq(vatRates.parishCouncilId, parishCouncilId))

  if ((existing?.total ?? 0) > 0) {
    return { seeded: false }
  }

  await seedVatRatesForCouncil(parishCouncilId)

  return { seeded: true }
}
