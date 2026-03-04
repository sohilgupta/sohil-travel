/**
 * /api/drive-poll — Vercel Cron endpoint.
 *
 * Called automatically every 5 minutes by Vercel's scheduler (see vercel.json).
 * Secured with CRON_SECRET to prevent unauthorised triggering.
 *
 * Credentials are server-side only — none are exposed in the response.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkForChanges } from '@/lib/google-drive/monitor'

export const maxDuration = 300 // Vercel Pro max; matches 5-minute poll cadence

export async function GET(request: NextRequest) {
  // Validate Vercel cron secret — prevents unauthenticated polling
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[drive-poll] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await checkForChanges()

    // Return only aggregate counts — no raw file content, no credentials
    return NextResponse.json({
      ok: true,
      processed: summary.processed.length,
      errors: summary.errors.length,
      started_at: summary.started_at,
      finished_at: summary.finished_at,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[drive-poll] Unhandled error:', message)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
