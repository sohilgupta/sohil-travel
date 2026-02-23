import { NextRequest, NextResponse } from 'next/server'

// In-memory rate limiting (resets on cold start — acceptable for edge cases)
const attempts = new Map<string, { count: number; timestamp: number }>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  const now = Date.now()
  const record = attempts.get(ip)

  if (record) {
    if (now - record.timestamp < WINDOW_MS) {
      if (record.count >= MAX_ATTEMPTS) {
        return NextResponse.json(
          { error: 'Too many attempts. Try again in 15 minutes.' },
          { status: 429 }
        )
      }
      record.count++
    } else {
      attempts.set(ip, { count: 1, timestamp: now })
    }
  } else {
    attempts.set(ip, { count: 1, timestamp: now })
  }

  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!body.password) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 })
  }

  if (body.password === process.env.APP_PASSWORD) {
    attempts.delete(ip)

    const response = NextResponse.json({ success: true })
    response.cookies.set('trip_session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })
    return response
  }

  return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
}
