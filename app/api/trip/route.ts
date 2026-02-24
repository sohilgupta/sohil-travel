import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isAuthenticated } from '@/lib/auth'
import { TripData } from '@/lib/types'

export async function GET() {
  try {
    const supabase = createServerClient()
    const authed = await isAuthenticated()

    const { data: rows, error } = await supabase
      .from('trip_metadata')
      .select('*')
      .limit(1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const row = rows?.[0] ?? {}

    // Unauthenticated: return only what the unlock preview needs (no PII)
    if (!authed) {
      return NextResponse.json({
        trip_name: row.trip_name ?? null,
        start_date: row.start_date ?? null,
        end_date: row.end_date ?? null,
        destinations: row.destinations ?? [],
        primary_airline: row.primary_airline ?? null,
      }, {
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' },
      })
    }

    // Authenticated: return full trip data
    const trip: Partial<TripData> = {
      trip_name: row.trip_name ?? null,
      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,
      destinations: row.destinations ?? [],
      passengers: row.passengers ?? [],
      primary_airline: row.primary_airline ?? null,
      duration_days: row.duration_days ?? null,
      total_flights: row.total_flights ?? 0,
      total_activities: row.total_activities ?? 0,
      total_hotels: row.total_hotels ?? 0,
    }

    return NextResponse.json(trip, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
