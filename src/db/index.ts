import 'dotenv/config'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import * as schema from './schema'

neonConfig.webSocketConstructor = ws

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

const pool = new Pool({
  connectionString: databaseUrl
})

export const db = drizzle(pool, { schema })
