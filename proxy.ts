import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/dashboard', '/timeline', '/documents']
const SESSION_COOKIE = 'trip_session'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))

  if (isProtected) {
    const session = request.cookies.get(SESSION_COOKIE)
    if (!session?.value) {
      const url = new URL('/unlock', request.url)
      url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
    }
  }

  // Already authenticated — skip unlock page
  if (pathname === '/unlock') {
    const session = request.cookies.get(SESSION_COOKIE)
    if (session?.value) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
}
