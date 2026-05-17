import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

dotenv.config({ path: '.env.local' })

neonConfig.webSocketConstructor = ws

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const migrationsDir = path.resolve(__dirname, '../migrations')

async function run() {
  const pool = new Pool({ connectionString: databaseUrl })

  try {
    await pool.query(`
      create table if not exists "__pc_accounts_migrations" (
        "name" text primary key,
        "applied_at" timestamp not null default now()
      )
    `)

    const files = (await readdir(migrationsDir))
      .filter(file => file.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const applied = await pool.query(
        'select 1 from "__pc_accounts_migrations" where "name" = $1',
        [file]
      )

      if (applied.rowCount && applied.rowCount > 0) {
        console.log(`Skipping ${file}`)
        continue
      }

      console.log(`Applying ${file}`)
      const sql = await readFile(path.join(migrationsDir, file), 'utf8')

      await pool.query('begin')

      try {
        await pool.query(sql)
        await pool.query(
          'insert into "__pc_accounts_migrations" ("name") values ($1)',
          [file]
        )
        await pool.query('commit')
      } catch (error) {
        await pool.query('rollback')
        throw error
      }
    }

    console.log('Migrations complete')
  } finally {
    await pool.end()
  }
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
