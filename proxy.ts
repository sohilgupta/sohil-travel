import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/dashboard', '/timeline', '/documents']
const SESSION_COOKIE = 'trip_session'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get(SESSION_COOKIE)
  const isLoggedIn = session?.value === 'authenticated'

  // Protect pages that require authentication
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))
  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL('/unlock', request.url))
  }

  // Redirect authenticated users away from unlock page
  if (pathname === '/unlock' && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
}
