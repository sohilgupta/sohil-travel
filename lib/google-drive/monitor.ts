/**
 * Google Drive change monitor — server-side only.
 *
 * Uses the Drive Changes API with a page token stored in Supabase.
 * On first run, initialises the token so subsequent polls only see new changes.
 *
 * Rate-limit handling:
 *  - Exponential back-off on 429/503 responses (via googleapis built-in retry)
 *  - Each poll is idempotent thanks to hash-based deduplication in processor.ts
 */

import { getDriveClient, getDriveFolderId } from './client'
import { createServerClient } from '@/lib/supabase/server'
import { processFile, deleteFile } from './processor'
import { DriveFileRecord, DriveChangeRecord, SyncSummary } from './types'
import { drive_v3 } from 'googleapis'

const SYNC_STATE_TABLE = 'drive_sync_state'

// ─── Page token persistence ────────────────────────────────────────────────────

async function loadPageToken(folderId: string): Promise<string | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from(SYNC_STATE_TABLE)
    .select('page_token')
    .eq('folder_id', folderId)
    .maybeSingle()
  return data?.page_token ?? null
}

async function savePageToken(folderId: string, token: string): Promise<void> {
  const supabase = createServerClient()
  await supabase.from(SYNC_STATE_TABLE).upsert(
    {
      folder_id: folderId,
      page_token: token,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: 'folder_id' }
  )
}

// ─── Drive file helpers ───────────────────────────────────────────────────────

function toFileRecord(f: drive_v3.Schema$File): DriveFileRecord {
  return {
    id: f.id ?? '',
    name: f.name ?? 'unknown',
    mimeType: f.mimeType ?? '',
    size: f.size ? parseInt(f.size, 10) : null,
    modifiedTime: f.modifiedTime ?? new Date().toISOString(),
    md5Checksum: f.md5Checksum ?? null,
    trashed: f.trashed ?? false,
  }
}

/**
 * List all non-folder files recursively within the monitored folder using BFS.
 * Drive API only supports `in parents` (direct children), so we walk the tree.
 */
async function listFolderFiles(folderId: string): Promise<DriveFileRecord[]> {
  const drive = getDriveClient()
  const allFiles: DriveFileRecord[] = []
  const queue = [folderId] // BFS queue of folder IDs to scan

  while (queue.length > 0) {
    const currentId = queue.shift()!
    let pageToken: string | undefined

    do {
      const res = await drive.files.list({
        q: `'${currentId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum, trashed)',
        pageSize: 100,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })

      for (const file of res.data.files ?? []) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          if (file.id) queue.push(file.id) // recurse into subfolders
        } else {
          allFiles.push(toFileRecord(file))
        }
      }

      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken)
  }

  return allFiles
}

/**
 * Returns the set of all folder IDs in the monitored hierarchy
 * (root + every subfolder at any depth) using BFS.
 * Used to filter the Drive change feed to only our folder tree.
 */
async function getFolderHierarchyIds(folderId: string): Promise<Set<string>> {
  const drive = getDriveClient()
  const ids = new Set<string>([folderId])
  const queue = [folderId]

  while (queue.length > 0) {
    const currentId = queue.shift()!

    const res = await drive.files.list({
      q: `'${currentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    for (const folder of res.data.files ?? []) {
      if (folder.id && !ids.has(folder.id)) {
        ids.add(folder.id)
        queue.push(folder.id) // recurse into nested subfolders
      }
    }
  }

  return ids
}

/** Get the Drive start page token to use for future change tracking */
async function getStartPageToken(): Promise<string> {
  const drive = getDriveClient()
  const res = await drive.changes.getStartPageToken({
    supportsAllDrives: true,
  })
  const token = res.data.startPageToken
  if (!token) throw new Error('Could not obtain start page token from Drive API')
  return token
}

/** Fetch changes since the stored page token */
async function fetchChanges(
  pageToken: string,
  folderId: string
): Promise<{ changes: DriveChangeRecord[]; newToken: string }> {
  const drive = getDriveClient()
  const changes: DriveChangeRecord[] = []
  let currentToken = pageToken

  // Build the full folder hierarchy once so we can match files in subfolders
  const folderIds = await getFolderHierarchyIds(folderId)

  while (true) {
    const res = await drive.changes.list({
      pageToken: currentToken,
      fields:
        'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, size, modifiedTime, md5Checksum, trashed, parents))',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      includeRemoved: true,
    })

    for (const change of res.data.changes ?? []) {
      const fileId = change.fileId ?? ''
      if (!fileId) continue

      const file = change.file

      // Removed or trashed — let deleteFile check if it's tracked in our DB
      if (change.removed || file?.trashed) {
        changes.push({ type: 'deleted', fileId, file: null })
        continue
      }

      if (!file) continue

      // Only process files whose direct parent is within our folder hierarchy
      // (handles files in root folder AND any subfolder depth)
      const parents = file.parents ?? []
      if (!parents.some(p => folderIds.has(p))) continue

      const record = toFileRecord(file)
      changes.push({ type: 'added', fileId, file: record })
    }

    if (res.data.newStartPageToken) {
      return { changes, newToken: res.data.newStartPageToken }
    }

    if (res.data.nextPageToken) {
      currentToken = res.data.nextPageToken
    } else {
      break
    }
  }

  return { changes, newToken: currentToken }
}

// ─── Sleep helper for rate-limit back-off ────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Main check function ───────────────────────────────────────────────────────

/**
 * Check for changes in the Drive folder and process them.
 * Safe to call concurrently — Supabase upsert is idempotent.
 */
export async function checkForChanges(): Promise<SyncSummary> {
  const startedAt = new Date().toISOString()
  const folderId = getDriveFolderId()
  const results: SyncSummary['processed'] = []
  const errors: string[] = []

  try {
    let pageToken = await loadPageToken(folderId)

    if (!pageToken) {
      // First run: initialise token and do a full folder scan
      console.log('[drive-monitor] First run — initialising page token and scanning folder')
      pageToken = await getStartPageToken()
      await savePageToken(folderId, pageToken)

      const files = await listFolderFiles(folderId)
      for (const file of files) {
        await sleep(200) // gentle rate limiting between file requests
        const result = await processFile(file)
        results.push(result)
        if (result.action === 'error') {
          errors.push(`${file.name}: ${result.reason}`)
        }
      }
    } else {
      // Subsequent runs: use change feed
      const { changes, newToken } = await fetchChanges(pageToken, folderId)
      await savePageToken(folderId, newToken)

      console.log(`[drive-monitor] ${changes.length} change(s) detected`)

      for (const change of changes) {
        await sleep(200)
        if (change.type === 'deleted' || !change.file) {
          const result = await deleteFile(change.fileId, change.file?.name ?? change.fileId)
          results.push(result)
          if (result.action === 'error') errors.push(`${change.fileId}: ${result.reason}`)
        } else {
          const result = await processFile(change.file)
          results.push(result)
          if (result.action === 'error') errors.push(`${change.file.name}: ${result.reason}`)
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    errors.push(`Monitor error: ${message}`)
    console.error('[drive-monitor] Fatal error:', message)
  }

  const finishedAt = new Date().toISOString()
  console.log(
    `[drive-monitor] Done — ${results.length} file(s) processed, ${errors.length} error(s)`,
    { started_at: startedAt, finished_at: finishedAt }
  )

  return { processed: results, errors, started_at: startedAt, finished_at: finishedAt }
}

// ─── On-access check ──────────────────────────────────────────────────────────

/**
 * In-progress guard — prevents concurrent executions within the same
 * serverless instance. Across instances, hash-based deduplication in
 * processor.ts ensures idempotency.
 */
let syncInProgress = false

/**
 * Timestamp of the last completed check (per instance).
 * Prevents hammering the Drive API on rapid page refreshes.
 */
let lastCheckedAt = 0
const MIN_CHECK_INTERVAL_MS = 60_000 // 1 minute

/**
 * Called after a dashboard response is sent (via Next.js `after()`).
 *
 * Fast path (nothing changed): one Drive API call + Supabase token read ≈ 300ms.
 * Slow path (files changed): downloads, parses, and syncs only the changed files.
 *
 * Errors are swallowed so they never surface to the user — all logged server-side.
 */
export async function checkOnAccess(): Promise<void> {
  // Throttle: skip if we just checked recently (same instance)
  const now = Date.now()
  if (now - lastCheckedAt < MIN_CHECK_INTERVAL_MS) return

  // Prevent concurrent runs within this instance
  if (syncInProgress) return
  syncInProgress = true
  lastCheckedAt = now

  try {
    await checkForChanges()
  } catch (err) {
    // Never propagate — this runs after the response is already sent
    console.error('[drive-monitor] checkOnAccess error:', err instanceof Error ? err.message : err)
  } finally {
    syncInProgress = false
  }
}

/**
 * Full re-sync: reset the page token and reprocess every file in the folder.
 * Used by the admin /api/sync-drive endpoint.
 */
export async function fullResync(): Promise<SyncSummary> {
  const folderId = getDriveFolderId()
  const supabase = createServerClient()

  // Reset stored token so checkForChanges treats this as a first run
  await supabase.from(SYNC_STATE_TABLE).delete().eq('folder_id', folderId)

  return checkForChanges()
}
