import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

// Better Auth handles all its own routes (sign-in, sign-up, session, etc.)
// through this single catch-all. No individual route files needed.
export const { GET, POST } = toNextJsHandler(auth)
