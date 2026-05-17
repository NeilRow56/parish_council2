import 'dotenv/config'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool, neonConfig } from '@neondatabase/serverless'
import * as schema from './schema'

neonConfig.poolQueryViaFetch = true

if (typeof WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = WebSocket
}

const databaseUrl = process.env.DATABASE_URL

if (process.env.NODE_ENV !== 'production') {
  if (!databaseUrl) {
    console.warn('DATABASE_URL is missing')
  } else {
    try {
      const url = new URL(databaseUrl)
      console.log(`🗄️  DB: ${process.env.VERCEL_ENV ?? 'local'} → ${url.host}`)
    } catch {
      console.warn('DATABASE_URL is invalid')
    }
  }
}

function createDbClient() {
  const pool = new Pool({
    connectionString: databaseUrl
  })

  return {
    pool,
    db: drizzle(pool, { schema })
  }
}

type DbClient = ReturnType<typeof createDbClient>

const globalForDb = globalThis as typeof globalThis & {
  __pcAccountsDbClient?: DbClient
}

const client =
  process.env.NODE_ENV === 'production'
    ? createDbClient()
    : (globalForDb.__pcAccountsDbClient ??= createDbClient())

export const db = client.db
