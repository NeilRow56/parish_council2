// scripts/backfill-vat-rates.ts

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing after loading .env.local')
}

async function run() {
  const { db } = await import('@/db')
  const { parishCouncils } = await import('@/db/schema/authSchema')
  const { seedVatRatesForCouncil } = await import('@/server/seeds/seedVatRates')

  const councils = await db.select().from(parishCouncils)

  for (const council of councils) {
    console.log(`Ensuring default VAT rates for ${council.id}`)
    await seedVatRatesForCouncil(council.id)
  }

  console.log(`Done. Checked ${councils.length} council(s).`)
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
