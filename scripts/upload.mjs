#!/usr/bin/env node
/**
 * Trip Vault — PDF Upload & Metadata Extraction Script
 *
 * Usage:
 *   node scripts/upload.mjs --folder "/path/to/your/documents"
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

// ── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BUCKET = 'travel-documents'

// ── Category detection ────────────────────────────────────────────────────────
function detectCategory(filename, text) {
  const f = filename.toLowerCase()
  const t = (text || '').toLowerCase()
  const combined = f + ' ' + t.slice(0, 2000)

  if (/flight|airline|boarding|pnr|departure|arrival|airways|depart|itinerary.*flight/i.test(combined)) {
    if (/\b[A-Z]{2}\d{3,4}\b/.test(text) || /\bPNR\b/i.test(combined)) return 'flights'
  }
  if (/hotel|resort|inn|lodge|accommodation|check.in|check.out|room|nights?\b/i.test(combined)) return 'hotels'
  if (/rental|car.hire|hertz|avis|enterprise|budget|thrifty|dollar|sixt|pickup|pick.up|drop.?off/i.test(combined)) return 'car_rental'
  if (/insurance|travel.protect|policy|cover|claim/i.test(combined)) return 'insurance'
  if (/tour|cruise|activity|zoo|safari|museum|park|ticket|booking|excursion|transfer|stargazing|hobbiton|milford|glacier|helicopter|sea.world|movie.world/i.test(combined)) return 'activities'
  if (/flight|airline|boarding|pnr|departure|arrival|airways/i.test(combined)) return 'flights'

  return 'misc'
}

// ── Metadata extraction ───────────────────────────────────────────────────────
function extractMetadata(text, category, filename) {
  const meta = {}

  // Passenger names: extract exact full names as written in source — no surname inference or merging
  const passengers = new Set()

  // Pattern 1: "Passenger: John Smith" / "Name: First Last" — colon required to avoid boilerplate
  const mixedCasePattern = /(?:passenger|name|travell?er):\s+([A-Z][a-z]+ [A-Z][a-z]+)/gi
  let mx
  while ((mx = mixedCasePattern.exec(text)) !== null) {
    const name = mx[1].trim().replace(/\s+/g, ' ')
    if (name.length > 3 && name.length < 50) passengers.add(name)
  }

  // Pattern 2: Title-prefixed ALL-CAPS names e.g. "MS RACHNA RACHNA", "MR SOHIL GUPTA"
  // Uses matchAll so each title gets its own independent match (no shared greedy state).
  // After capture, we truncate at the next embedded title to prevent cross-passenger merging.
  const titleMatches = [...text.matchAll(/\b(?:MR|MRS|MS|DR)\.?\s+([A-Z]+(?:\s+[A-Z]+)*)/g)]
  for (const match of titleMatches) {
    let namePart = match[1]
    // Stop at any embedded title word (e.g. "SOHIL GUPTA MS RACHNA" → "SOHIL GUPTA")
    const stopIdx = namePart.search(/\b(?:MR|MRS|MS|DR)\b/i)
    if (stopIdx !== -1) namePart = namePart.slice(0, stopIdx)
    // Limit to 3 words max (first [middle] last); require at least 2
    const words = namePart.trim().split(/\s+/).filter(Boolean).slice(0, 3)
    if (words.length < 2) continue
    // Convert ALL-CAPS to Title Case exactly as extracted — surname preserved verbatim
    const name = words
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
    if (name.length > 3 && name.length < 50) passengers.add(name)
  }

  if (passengers.size > 0) meta.passengers = [...passengers].slice(0, 4)

  if (category === 'flights') {
    // Flight number: JQ410, VA147, EK521
    const flightMatch = text.match(/\b([A-Z]{1,2}\d{3,4})\b/)
    if (flightMatch) meta.flight_number = flightMatch[1]

    // PNR: 6 alphanumeric chars near PNR/Booking ref keywords
    const pnrMatch = text.match(/(?:PNR|booking\s*(?:ref|reference|code)|confirmation)[:\s#]+([A-Z0-9]{5,8})/i)
    if (pnrMatch) meta.pnr = pnrMatch[1].toUpperCase()

    // Route: 3-letter IATA codes
    const routeMatch = text.match(/\b([A-Z]{3})\s*(?:→|->|to|-)\s*([A-Z]{3})\b/)
    if (routeMatch) {
      meta.departure_airport = routeMatch[1]
      meta.arrival_airport = routeMatch[2]
    } else {
      // From filename: SYD-OOL, MEL-ZQN
      const fnRoute = filename.match(/([A-Z]{3})-([A-Z]{3})/i)
      if (fnRoute) {
        meta.departure_airport = fnRoute[1].toUpperCase()
        meta.arrival_airport = fnRoute[2].toUpperCase()
      }
    }

    // Departure time
    const timeMatch = text.match(/(?:departs?|departure|dep)[:\s]+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
    if (timeMatch) meta.departure_time = timeMatch[1].trim()

    // Arrival time
    const arrMatch = text.match(/(?:arrives?|arrival|arr)[:\s]+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
    if (arrMatch) meta.arrival_time = arrMatch[1].trim()

    // Airline
    const airlineMatch = text.match(/(?:airline|operated\s+by|carrier)[:\s]+([A-Za-z\s]+?)(?:\n|,|flight)/i)
      || text.match(/\b(Virgin Australia|Jetstar|Qantas|Emirates|Air New Zealand|Singapore Airlines)\b/i)
    if (airlineMatch) meta.airline = (airlineMatch[1] || airlineMatch[0]).trim()
  }

  if (category === 'hotels') {
    // Hotel name: first proper noun heading usually
    const hotelMatch = text.match(/(?:hotel|resort|inn|lodge|property)[:\s]+([^\n]+)/i)
      || text.match(/^([A-Z][A-Za-z\s&']+(?:Hotel|Resort|Inn|Lodge|Suites|Motel))/m)
    if (hotelMatch) meta.hotel_name = hotelMatch[1].trim().replace(/\s+/g, ' ')

    // Check-in / Check-out
    const checkInMatch = text.match(/(?:check.?in|arrival)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+\w+\s+\d{4})/i)
    if (checkInMatch) meta.check_in = checkInMatch[1]

    const checkOutMatch = text.match(/(?:check.?out|departure)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+\w+\s+\d{4})/i)
    if (checkOutMatch) meta.check_out = checkOutMatch[1]
  }

  if (category === 'car_rental') {
    const pickupMatch = text.match(/(?:pick.?up|pickup\s+location)[:\s]+([^\n]+)/i)
    if (pickupMatch) meta.pickup_location = pickupMatch[1].trim()

    const dropoffMatch = text.match(/(?:drop.?off|return\s+location)[:\s]+([^\n]+)/i)
    if (dropoffMatch) meta.dropoff_location = dropoffMatch[1].trim()

    const vehicleMatch = text.match(/(?:vehicle|car|model)[:\s]+([^\n]{3,40})/i)
    if (vehicleMatch) meta.vehicle = vehicleMatch[1].trim()

    const pickupTimeMatch = text.match(/(?:pick.?up\s+time|pickup\s+time)[:\s]+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
    if (pickupTimeMatch) meta.pickup_time = pickupTimeMatch[1]

    const bookingMatch = text.match(/(?:booking|confirmation|reservation)\s*(?:ref|reference|number|id|no)[:\s#]+([A-Z0-9\-]{4,20})/i)
    if (bookingMatch) meta.booking_ref = bookingMatch[1]
  }

  if (category === 'activities') {
    // Activity name from filename or first line
    const lines = text.split('\n').filter((l) => l.trim().length > 5)
    if (lines[0]) meta.activity_name = lines[0].trim().slice(0, 100)

    const timeMatch = text.match(/(?:departs?|starts?|begins?|time)[:\s]+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
    if (timeMatch) meta.start_time = timeMatch[1].trim()

    const endMatch = text.match(/(?:ends?|returns?|finishes?)[:\s]+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i)
    if (endMatch) meta.end_time = endMatch[1].trim()

    const locationMatch = text.match(/(?:location|meeting\s+point|departs?\s+from|departure\s+point)[:\s]+([^\n]{3,80})/i)
    if (locationMatch) meta.location = locationMatch[1].trim()

    const bookingMatch = text.match(/(?:booking|confirmation|reservation|ref)[:\s#]+([A-Z0-9\-]{4,20})/i)
    if (bookingMatch) meta.booking_ref = bookingMatch[1]
  }

  return meta
}

// ── Date extraction ────────────────────────────────────────────────────────────
function extractEventDate(text, filename) {
  // Try filename first (most reliable): "5Apr2026", "11Apr_", "14 Apr"
  const fnPatterns = [
    /(\d{1,2})\s?Apr(?:il)?\s?(?:2026)?/i,
    /(\d{1,2})Apr(\d{4})?/i,
  ]
  for (const p of fnPatterns) {
    const m = filename.match(p)
    if (m) {
      const day = m[1].padStart(2, '0')
      return `2026-04-${day}`
    }
  }

  // Pipe dates from text
  const datePatterns = [
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})\b/gi,
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    /\b(\d{2})\/(\d{2})\/(\d{4})\b/g,
  ]

  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 }

  for (const pattern of datePatterns) {
    pattern.lastIndex = 0
    const m = pattern.exec(text)
    if (!m) continue

    try {
      if (pattern.source.includes('Jan|Feb')) {
        const d = m[1].padStart(2,'0')
        const mo = String(months[m[2].toLowerCase().slice(0,3)]).padStart(2,'0')
        const y = m[3]
        return `${y}-${mo}-${d}`
      }
      if (pattern.source.startsWith('\\b(\\d{4})')) {
        return `${m[1]}-${m[2]}-${m[3]}`
      }
      return `${m[3]}-${m[2]}-${m[1]}`
    } catch { /* skip */ }
  }

  return null
}

// ── Title generation ──────────────────────────────────────────────────────────
function generateTitle(filename, category, meta) {
  // Clean filename (remove dates, extensions, underscores)
  let title = filename
    .replace(/\.(pdf|PDF)$/, '')
    .replace(/^\d{1,2}\s?(?:Apr|Jan|Feb|Mar|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s*\|?\s*/i, '')
    .replace(/_/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Use rich metadata for flight titles
  if (category === 'flights' && meta.departure_airport && meta.arrival_airport) {
    const fn = meta.flight_number ? ` (${meta.flight_number})` : ''
    title = `${meta.departure_airport} → ${meta.arrival_airport}${fn}`
  }

  if (category === 'hotels' && meta.hotel_name) {
    title = meta.hotel_name
  }

  return title.slice(0, 150)
}

// ── Collect all PDFs recursively ──────────────────────────────────────────────
function collectPDFs(dir) {
  const results = []
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (entry.startsWith('.')) continue
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        results.push(...collectPDFs(full))
      } else if (extname(entry).toLowerCase() === '.pdf') {
        results.push(full)
      }
    }
  } catch (e) {
    console.warn(`⚠️  Could not read ${dir}: ${e.message}`)
  }
  return results
}

// ── Build trip metadata aggregate ────────────────────────────────────────────
function buildTripMetadata(allDocs) {
  const dates = allDocs
    .filter((d) => d.event_date)
    .map((d) => d.event_date)
    .sort()

  const start_date = dates[0] || null
  const end_date = dates[dates.length - 1] || null

  // Duration
  let duration_days = null
  if (start_date && end_date) {
    const d1 = new Date(start_date)
    const d2 = new Date(end_date)
    duration_days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1
  }

  // Passengers
  const passengerSet = new Set()
  allDocs.forEach((d) => {
    ;(d.metadata?.passengers || []).forEach((p) => passengerSet.add(p))
  })

  // Destinations from flight routes
  const destinationSet = new Set()
  allDocs
    .filter((d) => d.category === 'flights')
    .forEach((d) => {
      if (d.metadata?.departure_airport) destinationSet.add(d.metadata.departure_airport)
      if (d.metadata?.arrival_airport) destinationSet.add(d.metadata.arrival_airport)
    })

  // Primary airline
  const airlineCounts = {}
  allDocs
    .filter((d) => d.category === 'flights' && d.metadata?.airline)
    .forEach((d) => {
      const a = d.metadata.airline
      airlineCounts[a] = (airlineCounts[a] || 0) + 1
    })
  const primary_airline = Object.entries(airlineCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  // Counts
  const total_flights = allDocs.filter((d) => d.category === 'flights').length
  const total_activities = allDocs.filter((d) => d.category === 'activities').length
  const total_hotels = allDocs.filter((d) => d.category === 'hotels').length

  // Trip name: infer from destinations
  const destArray = [...destinationSet]
  let trip_name = 'My Trip'
  if (destArray.length >= 2) {
    trip_name = `${destArray[0]} → ${destArray[destArray.length - 1]}`
  } else if (destArray.length === 1) {
    trip_name = `Trip to ${destArray[0]}`
  }

  return {
    start_date,
    end_date,
    duration_days,
    passengers: [...passengerSet].slice(0, 6),
    destinations: destArray,
    primary_airline,
    total_flights,
    total_activities,
    total_hotels,
    trip_name,
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const folderIdx = args.indexOf('--folder')
  const folder = folderIdx !== -1 ? args[folderIdx + 1] : args[0]

  if (!folder) {
    console.error('Usage: node scripts/upload.mjs --folder "/path/to/documents"')
    process.exit(1)
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  console.log(`\n📁 Scanning: ${folder}\n`)
  const pdfs = collectPDFs(folder)
  console.log(`Found ${pdfs.length} PDF(s)\n`)

  if (pdfs.length === 0) {
    console.log('No PDFs found. Exiting.')
    return
  }

  const allDocs = []

  for (const pdfPath of pdfs) {
    const filename = basename(pdfPath)
    console.log(`📄 Processing: ${filename}`)

    try {
      // Parse PDF text
      const buffer = readFileSync(pdfPath)
      let text = ''
      try {
        const parsed = await pdfParse(buffer)
        text = parsed.text || ''
      } catch (e) {
        console.warn(`   ⚠️  Could not parse text: ${e.message}`)
      }

      const category = detectCategory(filename, text)
      const meta = extractMetadata(text, category, filename)
      const event_date = extractEventDate(text, filename)
      const title = generateTitle(filename, category, meta)

      // Storage path: category/sanitized-filename
      // Supabase Storage only allows A-Z a-z 0-9 - _ . /
      const safeFilename = filename
        .replace(/[|,&'()]/g, '')         // strip symbols
        .replace(/[\s]+/g, '_')           // spaces → underscores
        .replace(/[^A-Za-z0-9._\-/]/g, '-') // anything else → dash
        .replace(/-{2,}/g, '-')           // collapse consecutive dashes
      const storagePath = `${category}/${safeFilename}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: 'application/pdf',
          upsert: true,
        })

      if (uploadError) {
        console.error(`   ❌ Upload failed: ${uploadError.message}`)
        continue
      }

      // Upsert document record
      const { error: dbError } = await supabase.from('documents').upsert(
        {
          filename,
          storage_path: storagePath,
          category,
          title,
          raw_text: text.slice(0, 10000),
          metadata: meta,
          event_date,
        },
        { onConflict: 'storage_path' }
      )

      if (dbError) {
        console.error(`   ❌ DB insert failed: ${dbError.message}`)
        continue
      }

      allDocs.push({ filename, category, metadata: meta, event_date })
      console.log(`   ✅ ${category.toUpperCase()} | ${event_date || 'no date'} | ${title}`)
    } catch (e) {
      console.error(`   ❌ Error: ${e.message}`)
    }
  }

  // Build and save trip metadata
  console.log('\n🗺️  Building trip metadata…')
  const tripMeta = buildTripMetadata(allDocs)
  console.log(tripMeta)

  // trip_metadata holds a single wide row — always update it, never insert duplicates
  const { data: existing } = await supabase
    .from('trip_metadata')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const metaPayload = {
    trip_name:       tripMeta.trip_name,
    start_date:      tripMeta.start_date,
    end_date:        tripMeta.end_date,
    destinations:    tripMeta.destinations,
    passengers:      tripMeta.passengers,
    total_documents: allDocs.length,
    updated_at:      new Date().toISOString(),
  }

  const { error: metaError } = existing?.id
    ? await supabase.from('trip_metadata').update(metaPayload).eq('id', existing.id)
    : await supabase.from('trip_metadata').insert(metaPayload)

  if (metaError) console.error('   ❌ Trip metadata save failed:', metaError.message)
  else console.log('   ✅ Trip metadata saved')

  console.log(`\n✅ Done! ${allDocs.length}/${pdfs.length} documents uploaded.`)
  console.log(`   Trip: ${tripMeta.trip_name}`)
  console.log(`   Dates: ${tripMeta.start_date} → ${tripMeta.end_date} (${tripMeta.duration_days} days)`)
  console.log(`   Passengers: ${tripMeta.passengers.join(', ') || 'not detected'}`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
