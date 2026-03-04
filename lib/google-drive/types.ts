/**
 * Types for Google Drive monitoring.
 * All credentials come exclusively from server-side environment variables.
 */

export interface DriveFileRecord {
  id: string
  name: string
  mimeType: string
  size: number | null
  modifiedTime: string
  md5Checksum: string | null
  trashed: boolean
}

export interface DriveChangeRecord {
  type: 'added' | 'modified' | 'deleted'
  fileId: string
  file: DriveFileRecord | null
}

export interface DriveSyncState {
  folder_id: string
  page_token: string
  last_synced_at: string
}

export interface ProcessResult {
  fileId: string
  filename: string
  action: 'inserted' | 'updated' | 'skipped' | 'deleted' | 'error'
  reason?: string
}

export interface SyncSummary {
  processed: ProcessResult[]
  errors: string[]
  started_at: string
  finished_at: string
}

/** MIME types the system accepts for processing */
export const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.google-apps.document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
])

/** Maximum file size in bytes (25 MB default, overridable via env) */
export function maxFileSizeBytes(): number {
  const configured = parseInt(process.env.DRIVE_MAX_FILE_SIZE_MB ?? '25', 10)
  return (isNaN(configured) ? 25 : configured) * 1024 * 1024
}
