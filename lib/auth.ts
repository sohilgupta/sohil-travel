import { cookies } from 'next/headers'

const SESSION_COOKIE = 'trip_session'

/**
 * Check authentication from API route handlers.
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE)
  return session?.value === 'authenticated'
}
