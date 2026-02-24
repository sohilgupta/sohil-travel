import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isAuthenticated } from '@/lib/auth'
import { TripData } from '@/lib/types'

export async function GET() {
  try {
    const supabase = createServerClient()
    const authed = await isAuthenticated()

    const { data: metaRow, error } = await supabase
      .from('trip_metadata')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const row = (metaRow ?? {}) as Record<string, unknown>

    // Unauthenticated: return only what the unlock preview needs (no PII)
    if (!authed) {
      return NextResponse.json({
        trip_name:       (row.trip_name as string)      ?? null,
        start_date:      (row.start_date as string)     ?? null,
        end_date:        (row.end_date as string)       ?? null,
        destinations:    (row.destinations as string[]) ?? [],
        primary_airline: null,
      }, {
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' },
      })
    }

    // Authenticated: return full trip data
    const trip: Partial<TripData> = {
      trip_name:        (row.trip_name as string)      ?? null,
      start_date:       (row.start_date as string)     ?? null,
      end_date:         (row.end_date as string)       ?? null,
      destinations:     (row.destinations as string[]) ?? [],
      passengers:       (row.passengers as string[])   ?? [],
      primary_airline:  null,
      duration_days:    null,
      total_flights:    0,
      total_activities: 0,
      total_hotels:     0,
    }

    return NextResponse.json(trip, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
