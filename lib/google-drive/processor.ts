/**
 * File processing pipeline — server-side only.
 *
 * For each Drive file:
 *  1. Validate MIME type against allowlist
 *  2. Check file size against limit
 *  3. Early skip using Drive's md5Checksum (no download needed for unchanged binary files)
 *  4. Download content (only when needed)
 *  5. Compute version hash (Drive md5 for binary, SHA-256 for exported Workspace docs)
 *  6. Parse PDF metadata
 *  7. Classify using folder hint first, then filename/text patterns
 *  8. Upload to Supabase private bucket
 *  9. Upsert document record — stores drive_file_id + version hash in metadata JSONB
 *     (no schema migration required — avoids dependency on drive_file_id column)
 * 10. Recompute trip_metadata aggregate
 */

import { createHash } from 'crypto'
import pdf from 'pdf-parse'
import { getDriveClient } from './client'
import { createServerClient } from '@/lib/supabase/server'
import { DocumentCategory, DocumentMetadata } from '@/lib/types'
import {
  DriveFileRecord,
  ProcessResult,
  ACCEPTED_MIME_TYPES,
  maxFileSizeBytes,
} from './types'

// ─── MIME type helpers ────────────────────────────────────────────────────────

/** Returns true if the MIME type is in our allowlist */
function isAcceptedMime(mimeType: string): boolean {
  return ACCEPTED_MIME_TYPES.has(mimeType)
}

/** Maps a Google MIME type to the export MIME type we'll download */
function exportMime(mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.document') {
    return 'application/pdf'
  }
  return mimeType
}

// ─── Category classification ──────────────────────────────────────────────────

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: DocumentCategory }> = [
  { pattern: /flight|boarding|airline|pnr|itinerary/i, category: 'flights' },
  { pattern: /hotel|resort|accommodation|check.?in|check.?out/i, category: 'hotels' },
  { pattern: /car.?rental|vehicle|pickup|hertz|avis|enterprise|budget/i, category: 'car_rental' },
  { pattern: /tour|activity|excursion|ticket|admission/i, category: 'activities' },
  { pattern: /insurance|policy|coverage/i, category: 'insurance' },
]

function classifyDocument(
  filename: string,
  text: string,
  folderHint?: DocumentCategory
): DocumentCategory {
  // Drive subfolder name is the most reliable signal — use it directly
  if (folderHint) return folderHint

  const combined = `${filename} ${text.slice(0, 2000)}`
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(combined)) return category
  }
  return 'misc'
}

// ─── Metadata extraction ──────────────────────────────────────────────────────

function extractMetadata(text: string, category: DocumentCategory): DocumentMetadata {
  const meta: DocumentMetadata = {}

  if (category === 'flights') {
    const pnr = text.match(/\b([A-Z]{2,3}\d{4,6}|[A-Z0-9]{6})\b/)
    if (pnr) meta.pnr = pnr[1]

    const flight = text.match(/\b([A-Z]{2}\d{3,4})\b/)
    if (flight) meta.flight_number = flight[1]

    const airports = text.match(/\b([A-Z]{3})\s*[-→]\s*([A-Z]{3})\b/)
    if (airports) {
      meta.departure_airport = airports[1]
      meta.arrival_airport = airports[2]
    }

    const times = text.match(/\b(\d{2}:\d{2})\b/g)
    if (times && times.length >= 2) {
      meta.departure_time = times[0]
      meta.arrival_time = times[1]
    }

    const passengers = text.match(/(?:passenger|name)[:\s]+([A-Z][A-Z ]+)/gi)
    if (passengers) {
      meta.passengers = passengers
        .map(p => p.replace(/^(?:passenger|name)[:\s]+/i, '').trim())
        .filter(Boolean)
    }
  }

  if (category === 'hotels') {
    const checkIn = text.match(/check.?in[:\s]+([0-9A-Za-z ,]+)/i)
    if (checkIn) meta.check_in = checkIn[1].trim()

    const checkOut = text.match(/check.?out[:\s]+([0-9A-Za-z ,]+)/i)
    if (checkOut) meta.check_out = checkOut[1].trim()

    const hotel = text.match(/(?:hotel|resort|inn)[:\s]+([A-Za-z &]+)/i)
    if (hotel) meta.hotel_name = hotel[1].trim()
  }

  if (category === 'car_rental') {
    const pickup = text.match(/pickup[:\s]+([A-Za-z ,]+)/i)
    if (pickup) meta.pickup_location = pickup[1].trim()

    const dropoff = text.match(/(?:return|drop.?off)[:\s]+([A-Za-z ,]+)/i)
    if (dropoff) meta.dropoff_location = dropoff[1].trim()

    const ref = text.match(/(?:booking|reservation|confirmation)[:\s#]+([A-Z0-9]+)/i)
    if (ref) meta.booking_ref = ref[1].trim()
  }

  return meta
}

// ─── SHA-256 hash ─────────────────────────────────────────────────────────────

function computeHash(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

// ─── Supabase storage path ────────────────────────────────────────────────────

function storagePath(driveFileId: string, filename: string): string {
  // Supabase storage keys must be URL-safe.
  // Replace everything that isn't alphanumeric, hyphen, underscore, or period
  // with an underscore, then collapse runs and trim edges.
  const safe = filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // spaces, |, &, ', ,  → _
    .replace(/_+/g, '_')               // collapse consecutive underscores
    .replace(/^_+|_+$/g, '')           // trim leading/trailing underscores
    .slice(0, 120)
  return `drive/${driveFileId}/${safe}`
}

// ─── Trip metadata recompute ──────────────────────────────────────────────────

async function recomputeTripMetadata() {
  const supabase = createServerClient()

  const { data: docs } = await supabase
    .from('documents')
    .select('category, metadata, event_date')

  if (!docs) return

  const passengers = new Set<string>()
  const destinations = new Set<string>()
  let startDate: string | null = null
  let endDate: string | null = null
  let primaryAirline: string | null = null
  const flightDocs = docs.filter(d => d.category === 'flights')
  const hotelDocs = docs.filter(d => d.category === 'hotels')
  const activityDocs = docs.filter(d => d.category === 'activities')

  for (const doc of docs) {
    const meta = doc.metadata as DocumentMetadata
    if (Array.isArray(meta.passengers)) {
      meta.passengers.forEach((p: string) => passengers.add(p))
    }
    if (meta.arrival_airport) destinations.add(meta.arrival_airport)
    if (meta.hotel_name) destinations.add(meta.hotel_name)
    if (doc.event_date) {
      if (!startDate || doc.event_date < startDate) startDate = doc.event_date
      if (!endDate || doc.event_date > endDate) endDate = doc.event_date
    }
    if (!primaryAirline && meta.airline) primaryAirline = meta.airline as string
  }

  await supabase.from('trip_metadata').upsert(
    {
      id: 1,
      passengers: Array.from(passengers),
      destinations: Array.from(destinations),
      start_date: startDate,
      end_date: endDate,
      primary_airline: primaryAirline,
      total_flights: flightDocs.length,
      total_hotels: hotelDocs.length,
      total_activities: activityDocs.length,
    },
    { onConflict: 'id' }
  )
}

// ─── Main process function ────────────────────────────────────────────────────

export async function processFile(file: DriveFileRecord): Promise<ProcessResult> {
  const { id: fileId, name: filename, mimeType, size } = file

  // 1. MIME type validation
  if (!isAcceptedMime(mimeType)) {
    return { fileId, filename, action: 'skipped', reason: `Unsupported MIME type: ${mimeType}` }
  }

  // 2. File size check
  const limitBytes = maxFileSizeBytes()
  if (size !== null && size > limitBytes) {
    return {
      fileId,
      filename,
      action: 'skipped',
      reason: `File exceeds size limit (${Math.round(size / 1024 / 1024)}MB > ${Math.round(limitBytes / 1024 / 1024)}MB)`,
    }
  }

  try {
    const supabase = createServerClient()

    // 3. Look up existing record by drive_file_id stored in metadata JSONB.
    //    This approach works WITHOUT any schema migration — no drive_file_id column needed.
    //    PostgREST supports ->> operator to filter by JSONB text fields.
    const { data: existing } = await supabase
      .from('documents')
      .select('id, metadata, storage_path')
      .eq('metadata->>drive_file_id' as string, fileId)
      .maybeSingle()

    const existingHash = (existing?.metadata as Record<string, unknown> | null)
      ?.drive_version_hash as string | undefined

    // 4. Early skip using Drive's native md5Checksum (no download required).
    //    Binary files (PDF, Word) always have this. Google Workspace docs do not.
    const driveChecksum = file.md5Checksum
    if (driveChecksum && existingHash === driveChecksum) {
      return { fileId, filename, action: 'skipped', reason: 'Content unchanged (Drive md5 match)' }
    }

    // 5. Download file content (needed for new/changed files, or Google Workspace docs)
    const drive = getDriveClient()
    const downloadMime = exportMime(mimeType)
    let fileBuffer: Buffer

    if (mimeType.startsWith('application/vnd.google-apps.')) {
      // Export Google Workspace document as PDF
      const res = await drive.files.export(
        { fileId, mimeType: downloadMime },
        { responseType: 'arraybuffer' }
      )
      fileBuffer = Buffer.from(res.data as ArrayBuffer)
    } else {
      const res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      )
      fileBuffer = Buffer.from(res.data as ArrayBuffer)
    }

    // Re-check size after download (covers cases where size was null)
    if (fileBuffer.length > limitBytes) {
      return {
        fileId,
        filename,
        action: 'skipped',
        reason: `Downloaded content exceeds size limit (${Math.round(fileBuffer.length / 1024 / 1024)}MB)`,
      }
    }

    // 6. Determine version hash.
    //    Binary files: use Drive's md5 (already verified above if it existed).
    //    Exported Google Docs: compute SHA-256 from the downloaded PDF bytes.
    const versionHash = driveChecksum ?? computeHash(fileBuffer)

    // Secondary hash check for Google Workspace docs (where driveChecksum is null)
    if (!driveChecksum && existingHash === versionHash) {
      return { fileId, filename, action: 'skipped', reason: 'Content unchanged (sha256 match)' }
    }

    // 7. Parse PDF text for metadata extraction
    let parsedText = ''
    try {
      const parsed = await pdf(fileBuffer)
      parsedText = parsed.text ?? ''
    } catch {
      // Non-fatal — we still store the file even if parsing fails
      parsedText = ''
    }

    // 8. Classify and extract metadata
    // folderHint (from Drive subfolder name) takes priority over text patterns
    const category = classifyDocument(filename, parsedText, file.folderHint)
    const metadata = extractMetadata(parsedText, category)

    // 9. Upload to Supabase private bucket — never public
    const path = storagePath(fileId, filename)
    const { error: uploadError } = await supabase.storage
      .from('travel-documents')
      .upload(path, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    // Extract event date from metadata — must be a YYYY-MM-DD date string.
    // departure_time and arrival_time are HH:MM strings, NOT dates — exclude them.
    const DATE_RE = /^\d{4}-\d{2}-\d{2}/
    const eventDate =
      [metadata.check_in, metadata.pickup_date]
        .find(v => typeof v === 'string' && DATE_RE.test(v)) ?? null

    // 10. Upsert document record.
    //     drive_file_id and drive_version_hash go into the metadata JSONB field
    //     so no schema migration is needed. The ->> filter above finds existing records.
    const docRecord = {
      filename,
      storage_path: path,
      category,
      title: filename.replace(/\.[^.]+$/, ''),
      metadata: {
        ...metadata,
        drive_file_id: fileId,
        drive_version_hash: versionHash,
      },
      event_date: eventDate,
    }

    const action = existing ? 'updated' : 'inserted'

    if (existing) {
      const { error: dbError } = await supabase
        .from('documents')
        .update(docRecord)
        .eq('metadata->>drive_file_id' as string, fileId)
      if (dbError) throw new Error(`DB update failed: ${dbError.message}`)
    } else {
      const { error: dbError } = await supabase.from('documents').insert(docRecord)
      if (dbError) throw new Error(`DB insert failed: ${dbError.message}`)
    }

    // 11. Recompute trip_metadata aggregate
    await recomputeTripMetadata()

    return { fileId, filename, action }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { fileId, filename, action: 'error', reason: message }
  }
}

// ─── Delete handler ───────────────────────────────────────────────────────────

export async function deleteFile(fileId: string, filename: string): Promise<ProcessResult> {
  try {
    const supabase = createServerClient()

    // Find the record using drive_file_id stored in metadata JSONB
    const { data: existing } = await supabase
      .from('documents')
      .select('id, storage_path')
      .eq('metadata->>drive_file_id' as string, fileId)
      .maybeSingle()

    if (!existing) {
      return { fileId, filename, action: 'skipped', reason: 'File not found in DB' }
    }

    // Remove from Supabase Storage
    await supabase.storage.from('travel-documents').remove([existing.storage_path])

    // Remove from DB
    await supabase.from('documents').delete().eq('id', existing.id)

    // Recompute trip_metadata after deletion
    await recomputeTripMetadata()

    return { fileId, filename, action: 'deleted' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { fileId, filename, action: 'error', reason: message }
  }
}
