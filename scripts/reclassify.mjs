#!/usr/bin/env node
/**
 * Trip Vault — Reclassify Script
 *
 * Fixes mis-categorised documents by:
 *   1. Deleting all existing document records + storage files
 *   2. Re-uploading every PDF from the source folder using the
 *      parent-folder name as the authoritative category hint.
 *
 * Usage:
 *   node scripts/reclassify.mjs --folder "/path/to/documents"
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient }          from '@supabase/supabase-js'
import { createRequire }         from 'module'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, basename, dirname }    from 'path'
import { config }                from 'dotenv'
import { fileURLToPath }         from 'url'

const require   = createRequire(import.meta.url)
const pdfParse  = require('pdf-parse')

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const BUCKET = 'travel-documents'

// ── Folder → category map ─────────────────────────────────────────────────────
const FOLDER_CATEGORY = {
  'flights':      'flights',
  'activities':   'activities',
  'car rental':   'car_rental',
  'hotels':       'hotels',
  'insurance':    'insurance',
  'personal docs':'misc',
  'personal':     'misc',
}

function folderToCategory(folderName) {
  return FOLDER_CATEGORY[folderName.toLowerCase()] ?? null
}

// ── Fallback category detection (same logic as upload.mjs) ───────────────────
function detectCategory(filename, text, folderHint) {
  if (folderHint) {
    const mapped = folderToCategory(folderHint)
    if (mapped) return mapped
  }

  const f = filename.toLowerCase()
  const t = (text || '').toLowerCase()
  const combined = f + ' ' + t.slice(0, 2000)

  const hasFlightNumber = /(?:^|[\s_\-])([A-Z]{2}\d{3,4})(?:$|[\s_\-.])/i.test(filename) ||
    /\b[A-Z]{2}\d{3,4}\b/.test(text)
  const hasPNR = /(?:^|[\s_\-])PNR[-_]/i.test(filename) || /\bPNR\b/i.test(combined)
  const hasAirportRoute = /\b[A-Z]{3}-[A-Z]{3}\b/.test(filename)
  const hasFlightKeywords = /flight|airline|boarding|departure|arrival|airways|depart/i.test(combined)

  if (hasFlightNumber || hasPNR || hasAirportRoute) return 'flights'
  if (/tour|cruise|activity|zoo|safari|museum|park|ticket|booking|excursion|transfer|stargazing|hobbiton|milford|glacier|helicopter|sea.world|movie.world|waitomo|scenic/i.test(combined)) return 'activities'
  if (/hotel|resort|inn|lodge|accommodation|check.in|check.out|room|nights?\b/i.test(combined)) return 'hotels'
  if (/rental|car.hire|hertz|avis|enterprise|budget|thrifty|dollar|sixt|drop.?off/i.test(combined)) return 'car_rental'
  if (/insurance|travel.protect|policy|cover|claim/i.test(combined)) return 'insurance'
  if (hasFlightKeywords) return 'flights'
  return 'misc'
}

// ── Helpers (copied from upload.mjs) ─────────────────────────────────────────
function extractMetadata(text, category, filename) {
  const meta = {}
  const passengers = new Set()
  const mixedCasePattern = /(?:passenger|name|travell?er):\s+([A-Z][a-z]+ [A-Z][a-z]+)/gi
  let m
  while ((m = mixedCasePattern.exec(text)) !== null) passengers.add(m[1])
  const capsPattern = /\bPASSENGER[S]?\b[\s\S]{0,5}([A-Z]{2,}\s+[A-Z]{2,})/g
  while ((m = capsPattern.exec(text)) !== null) {
    const raw = m[1].trim()
    const parts = raw.split(/\s+/)
    if (parts.length >= 2) {
      const name = parts.map(p => p[0] + p.slice(1).toLowerCase()).join(' ')
      passengers.add(name)
    }
  }
  if (passengers.size > 0) meta.passengers = [...passengers]

  if (category === 'flights') {
    const fn = (text.match(/\b([A-Z]{2}\d{3,4})\b/) || filename.match(/(?:^|[\s_\-])([A-Z]{2}\d{3,4})(?:$|[\s_\-.])/i))
    if (fn) meta.flight_number = fn[1]
    const pnr = text.match(/\bPNR[:\s#-]*([A-Z0-9]{5,8})\b/i) || filename.match(/PNR[-_]([A-Z0-9]{5,8})/i)
    if (pnr) meta.pnr = pnr[1]
    const airports = filename.match(/\b([A-Z]{3})-([A-Z]{3})\b/)
    if (airports) {
      meta.departure_airport = airports[1]
      meta.arrival_airport   = airports[2]
    }
  }

  if (category === 'hotels') {
    const hn = text.match(/(?:hotel|resort|lodge|inn)[:\s]+([A-Za-z ]{3,40})/i)
    if (hn) meta.hotel_name = hn[1].trim()
  }

  if (category === 'car_rental') {
    const br = text.match(/(?:booking|confirmation|reservation)[#:\s]*([A-Z0-9]{6,})/i) ||
               filename.match(/Booking([A-Z0-9]+)/i)
    if (br) meta.booking_ref = br[1]
  }

  if (category === 'activities') {
    const times = filename.match(/(\d{1,2}[.:]\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}[.:]\d{2}\s*(?:AM|PM)?)/i) ||
                  text.match(/(\d{1,2}[.:]\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}[.:]\d{2}\s*(?:AM|PM)?)/i)
    if (times) {
      meta.start_time = times[1].trim()
      meta.end_time   = times[2].trim()
    }
  }

  return meta
}

function extractEventDate(text, filename) {
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 }
  const datePatterns = [
    /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/gi,
    /\b(\d{4})[\/\-](\d{2})[\/\-](\d{2})\b/g,
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,
  ]
  const combined = filename + ' ' + (text || '').slice(0, 1000)
  for (const pattern of datePatterns) {
    pattern.lastIndex = 0
    const m = pattern.exec(combined)
    if (!m) continue
    try {
      if (pattern.source.includes('Jan|Feb')) {
        const d  = m[1].padStart(2,'0')
        const mo = String(months[m[2].toLowerCase().slice(0,3)]).padStart(2,'0')
        return `${m[3]}-${mo}-${d}`
      }
      if (pattern.source.startsWith('\\b(\\d{4})')) return `${m[1]}-${m[2]}-${m[3]}`
      return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
    } catch { /* skip */ }
  }
  return null
}

function generateTitle(filename, category, meta) {
  let title = filename
    .replace(/\.(pdf|PDF)$/, '')
    .replace(/^\d{1,2}\s?(?:Apr|Jan|Feb|Mar|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s*\|?\s*/i, '')
    .replace(/_/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (category === 'flights' && meta.departure_airport && meta.arrival_airport) {
    const fn = meta.flight_number ? ` (${meta.flight_number})` : ''
    title = `${meta.departure_airport} → ${meta.arrival_airport}${fn}`
  }
  if (category === 'hotels' && meta.hotel_name) title = meta.hotel_name

  return title.slice(0, 150)
}

function collectPDFs(dir) {
  const results = []
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.')) continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) results.push(...collectPDFs(full))
      else if (extname(entry).toLowerCase() === '.pdf') results.push(full)
    }
  } catch (e) { console.warn(`⚠️  ${dir}: ${e.message}`) }
  return results
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const folderIdx = args.indexOf('--folder')
  const folder = folderIdx !== -1 ? args[folderIdx + 1] : args[0]

  if (!folder) {
    console.error('Usage: node scripts/reclassify.mjs --folder "/path/to/documents"')
    process.exit(1)
  }

  console.log('\n🔄  Trip Vault — Reclassify\n')
  console.log(`📁  Source folder: ${folder}\n`)

  // ── Step 1: Delete all existing document records ──────────────────────────
  console.log('🗑️   Deleting all existing document records…')
  const { error: delErr } = await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) { console.error('❌  DB delete failed:', delErr.message); process.exit(1) }
  console.log('    ✅ Records cleared\n')

  // ── Step 2: Delete all files from storage ─────────────────────────────────
  console.log('🗑️   Clearing storage bucket…')
  const { data: storageFiles, error: listErr } = await supabase.storage.from(BUCKET).list('', { limit: 1000 })
  if (listErr) {
    console.warn('    ⚠️  Could not list storage root:', listErr.message)
  } else {
    // Gather all files across category subfolders
    const allPaths = []
    for (const item of storageFiles || []) {
      if (item.id) {
        allPaths.push(item.name)
      } else {
        // It's a folder — list its contents
        const { data: sub } = await supabase.storage.from(BUCKET).list(item.name, { limit: 1000 })
        for (const f of sub || []) allPaths.push(`${item.name}/${f.name}`)
      }
    }
    if (allPaths.length > 0) {
      const { error: removeErr } = await supabase.storage.from(BUCKET).remove(allPaths)
      if (removeErr) console.warn('    ⚠️  Some storage files could not be removed:', removeErr.message)
      else console.log(`    ✅ Removed ${allPaths.length} file(s)\n`)
    } else {
      console.log('    ✅ Storage already empty\n')
    }
  }

  // ── Step 3: Re-upload all PDFs with correct categories ────────────────────
  const pdfs = collectPDFs(folder)
  console.log(`📄  Found ${pdfs.length} PDF(s) — re-uploading with corrected categories…\n`)

  const allDocs = []

  for (const pdfPath of pdfs) {
    const filename   = basename(pdfPath)
    const parentDir  = basename(dirname(pdfPath))
    const folderHint = parentDir !== basename(folder) ? parentDir : null

    console.log(`📄  ${filename}`)
    if (folderHint) console.log(`    📂  folder hint: "${folderHint}"`)

    try {
      const buffer = readFileSync(pdfPath)
      let text = ''
      try {
        const parsed = await pdfParse(buffer)
        text = parsed.text || ''
      } catch (e) {
        console.warn(`    ⚠️  PDF parse warning: ${e.message}`)
      }

      const category   = detectCategory(filename, text, folderHint)
      const meta       = extractMetadata(text, category, filename)
      const event_date = extractEventDate(text, filename)
      const title      = generateTitle(filename, category, meta)

      const safeFilename = filename
        .replace(/[|,&'()]/g, '')
        .replace(/[\s]+/g, '_')
        .replace(/[^A-Za-z0-9._\-/]/g, '-')
        .replace(/-{2,}/g, '-')
      const storagePath = `${category}/${safeFilename}`

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })

      if (uploadErr) {
        console.error(`    ❌  Storage upload failed: ${uploadErr.message}`)
        continue
      }

      const { error: dbErr } = await supabase.from('documents').insert({
        filename,
        storage_path: storagePath,
        category,
        title,
        raw_text:  text.slice(0, 10000),
        metadata:  meta,
        event_date,
      })

      if (dbErr) {
        console.error(`    ❌  DB insert failed: ${dbErr.message}`)
        continue
      }

      allDocs.push({ filename, category, metadata: meta, event_date })
      console.log(`    ✅  ${category.toUpperCase().padEnd(12)} | ${(event_date || 'no date').padEnd(12)} | ${title}\n`)
    } catch (e) {
      console.error(`    ❌  Error: ${e.message}`)
    }
  }

  // ── Step 4: Update trip metadata ──────────────────────────────────────────
  console.log('🗺️   Updating trip metadata…')
  const dates = allDocs.filter(d => d.event_date).map(d => d.event_date).sort()
  const tripMeta = {
    start_date:    dates[0] || null,
    end_date:      dates[dates.length - 1] || null,
    total_flights: allDocs.filter(d => d.category === 'flights').length,
    total_hotels:  allDocs.filter(d => d.category === 'hotels').length,
    total_activities: allDocs.filter(d => d.category === 'activities').length,
    passengers:    [...new Set(allDocs.flatMap(d => d.metadata?.passengers || []))],
    destinations:  [...new Set(allDocs
      .filter(d => d.category === 'flights')
      .flatMap(d => [d.metadata?.departure_airport, d.metadata?.arrival_airport])
      .filter(Boolean))],
  }

  const { error: tripErr } = await supabase
    .from('trip_metadata')
    .upsert(tripMeta, { onConflict: 'id' })
    .select()

  if (tripErr) console.warn('    ⚠️  Trip metadata update skipped:', tripErr.message)
  else         console.log('    ✅  Trip metadata updated\n')

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = allDocs.reduce((acc, d) => { acc[d.category] = (acc[d.category] || 0) + 1; return acc }, {})
  console.log('═══════════════════════════════════════')
  console.log('✅  Reclassify complete!')
  Object.entries(counts).forEach(([cat, n]) => console.log(`    ${cat.padEnd(14)} ${n} doc(s)`))
  console.log('═══════════════════════════════════════\n')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
