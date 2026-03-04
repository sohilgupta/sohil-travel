/**
 * /api/sync-drive — Admin-only manual re-sync endpoint.
 *
 * POST  /api/sync-drive           → incremental sync (same as cron)
 * POST  /api/sync-drive?full=true → full folder re-sync (resets page token)
 *
 * Secured with SYNC_DRIVE_ADMIN_KEY via Authorization: Bearer <key>.
 * No credentials are returned in the response.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkForChanges, fullResync } from '@/lib/google-drive/monitor'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  // Admin key check — completely separate from the session cookie auth
  const authHeader = request.headers.get('authorization')
  const adminKey = process.env.SYNC_DRIVE_ADMIN_KEY

  if (!adminKey) {
    console.error('[sync-drive] SYNC_DRIVE_ADMIN_KEY not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const isFullResync = searchParams.get('full') === 'true'

  try {
    const summary = isFullResync ? await fullResync() : await checkForChanges()

    return NextResponse.json({
      ok: true,
      mode: isFullResync ? 'full' : 'incremental',
      processed: summary.processed.map(r => ({
        filename: r.filename,
        action: r.action,
        ...(r.reason ? { reason: r.reason } : {}),
      })),
      errors: summary.errors,
      error_count: summary.errors.length,
      started_at: summary.started_at,
      finished_at: summary.finished_at,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[sync-drive] Unhandled error:', message)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
