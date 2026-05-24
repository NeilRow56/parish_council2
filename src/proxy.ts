import { eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'

import { authDb } from '@/db/auth-db'
import { parishCouncils } from '@/db/schema/authSchema'
import { auth } from '@/lib/auth'

const protectedPathPrefixes = [
  '/bank-connections',
  '/banking',
  '/dashboard',
  '/ledger',
  '/onboarding',
  '/reports',
  '/settings',
  '/transactions',
  '/vat'
]

function isProtectedPath(pathname: string) {
  return protectedPathPrefixes.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  if (!isProtectedPath(pathname)) {
    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    })
  }

  if (pathname.startsWith('/onboarding/council-details')) {
    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    })
  }

  const session = await auth.api.getSession({
    headers: request.headers
  })

  if (!session?.user?.parishCouncilId) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set(
      'next',
      `${pathname}${request.nextUrl.search}`
    )

    return NextResponse.redirect(loginUrl)
  }

  const [council] = await authDb
    .select({
      addressLine1: parishCouncils.addressLine1
    })
    .from(parishCouncils)
    .where(eq(parishCouncils.id, session.user.parishCouncilId))
    .limit(1)

  if (council && !council.addressLine1?.trim()) {
    return NextResponse.redirect(
      new URL(
        '/onboarding/council-details?notice=complete-settings',
        request.url
      )
    )
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)']
}
