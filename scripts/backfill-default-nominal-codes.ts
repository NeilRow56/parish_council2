import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const databaseUrl = process.env.DATABASE_URL ?? ''

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing after loading .env.local')
}

const BACKFILL_DEFAULT_CODES = ['2100', '2110', '2120', '2150', '3090', '3095']

function getArg(name: string) {
  const prefix = `--${name}=`
  const arg = process.argv.find(value => value.startsWith(prefix))

  return arg?.slice(prefix.length)
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`)
}

function usage() {
  return [
    'Usage:',
    '  bun run backfill:nominal-codes -- --parishCouncilId=<id>',
    '  bun run backfill:nominal-codes -- --all',
    '',
    'Optional:',
    '  --dry-run  Show what would be inserted without changing data.'
  ].join('\n')
}

async function run() {
  const [
    { drizzle },
    { and, asc, eq, inArray },
    schema,
    { parishCouncils },
    { financialYears, nominalCodes },
    { defaultChart }
  ] = await Promise.all([
    import('drizzle-orm/neon-http'),
    import('drizzle-orm'),
    import('@/db/schema'),
    import('@/db/schema/authSchema'),
    import('@/db/schema/nominalLedger'),
    import('@/lib/nominal-codes/default-chart')
  ])
  const db = drizzle(databaseUrl, { schema })
  const parishCouncilId = getArg('parishCouncilId')
  const allCouncils = hasFlag('all')
  const dryRun = hasFlag('dry-run')

  if ((!parishCouncilId && !allCouncils) || (parishCouncilId && allCouncils)) {
    throw new Error(usage())
  }

  const defaultsToBackfill = defaultChart.filter(item =>
    BACKFILL_DEFAULT_CODES.includes(item.code)
  )

  if (defaultsToBackfill.length !== BACKFILL_DEFAULT_CODES.length) {
    const foundCodes = new Set(defaultsToBackfill.map(item => item.code))
    const missingCodes = BACKFILL_DEFAULT_CODES.filter(
      code => !foundCodes.has(code)
    )

    throw new Error(
      `Default chart is missing expected backfill codes: ${missingCodes.join(', ')}`
    )
  }

  const councils = await db
    .select({
      id: parishCouncils.id,
      name: parishCouncils.name
    })
    .from(parishCouncils)
    .where(
      parishCouncilId ? eq(parishCouncils.id, parishCouncilId) : undefined
    )
    .orderBy(asc(parishCouncils.name))

  if (councils.length === 0) {
    throw new Error(
      parishCouncilId
        ? `Parish council ${parishCouncilId} was not found.`
        : 'No parish councils found.'
    )
  }

  console.log(
    `${dryRun ? 'Checking' : 'Backfilling'} default nominal codes ${BACKFILL_DEFAULT_CODES.join(', ')} for ${councils.length} parish council(s).`
  )

  let insertedCount = 0
  let skippedCount = 0

  for (const council of councils) {
    const years = await db
      .select({
        id: financialYears.id,
        label: financialYears.label,
        startDate: financialYears.startDate
      })
      .from(financialYears)
      .where(eq(financialYears.parishCouncilId, council.id))
      .orderBy(asc(financialYears.startDate))

    if (years.length === 0) {
      console.log(`- ${council.name} (${council.id}): no financial years found.`)
      continue
    }

    for (const year of years) {
      const existingCodes = await db
        .select({ code: nominalCodes.code })
        .from(nominalCodes)
        .where(
          and(
            eq(nominalCodes.parishCouncilId, council.id),
            eq(nominalCodes.financialYearId, year.id),
            inArray(nominalCodes.code, BACKFILL_DEFAULT_CODES)
          )
        )

      const existingCodeSet = new Set(existingCodes.map(row => row.code))
      const missingDefaults = defaultsToBackfill.filter(
        item => !existingCodeSet.has(item.code)
      )

      for (const item of defaultsToBackfill) {
        if (existingCodeSet.has(item.code)) {
          skippedCount += 1
          console.log(
            `- ${council.name} (${council.id}) ${year.label}: skipped ${item.code} ${item.name}`
          )
        }
      }

      if (missingDefaults.length === 0) {
        continue
      }

      const values = missingDefaults.map(item => ({
        parishCouncilId: council.id,
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
      }))

      if (!dryRun) {
        await db
          .insert(nominalCodes)
          .values(values)
          .onConflictDoNothing({
            target: [
              nominalCodes.parishCouncilId,
              nominalCodes.financialYearId,
              nominalCodes.code
            ]
          })
      }

      insertedCount += missingDefaults.length

      for (const item of missingDefaults) {
        console.log(
          `- ${council.name} (${council.id}) ${year.label}: ${dryRun ? 'would insert' : 'inserted'} ${item.code} ${item.name}`
        )
      }
    }
  }

  console.log(
    `Done. ${dryRun ? 'Would insert' : 'Inserted'} ${insertedCount} code row(s); skipped ${skippedCount} existing code row(s).`
  )
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
