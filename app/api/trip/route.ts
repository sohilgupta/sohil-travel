import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { TripData } from '@/lib/types'

export async function GET() {
  try {
    const supabase = createServerClient()

    const { data: metadata, error } = await supabase
      .from('trip_metadata')
      .select('key, value')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const trip: Partial<TripData> & Record<string, unknown> = {
      start_date: null,
      end_date: null,
      destinations: [],
      passengers: [],
      primary_airline: null,
      duration_days: null,
      total_flights: 0,
      total_activities: 0,
      total_hotels: 0,
      trip_name: null,
    }

    metadata?.forEach(({ key, value }) => {
      ;(trip as Record<string, unknown>)[key] = value
    })

    return NextResponse.json(trip, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
