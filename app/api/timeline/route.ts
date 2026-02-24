import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isAuthenticated } from '@/lib/auth'
import { TimelineEvent, TimelineItem, DocumentCategory } from '@/lib/types'

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, category, title, metadata, event_date')
      .not('event_date', 'is', null)
      .order('event_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group events by date
    const grouped: Record<string, TimelineItem[]> = {}

    documents?.forEach((doc) => {
      const date = doc.event_date as string
      if (!grouped[date]) grouped[date] = []

      const meta = doc.metadata || {}
      let time = ''
      let subtitle = ''
      let title = doc.title || ''

      switch (doc.category as DocumentCategory) {
        case 'flights':
          time = meta.departure_time || ''
          if (meta.departure_airport && meta.arrival_airport) {
            subtitle = `${meta.departure_airport} → ${meta.arrival_airport}`
          }
          if (meta.flight_number) {
            title = title || `Flight ${meta.flight_number}`
          }
          break
        case 'hotels':
          time = 'Check-in'
          subtitle = meta.hotel_name || meta.pickup_location || ''
          break
        case 'car_rental':
          time = meta.pickup_time || 'Pickup'
          subtitle = meta.pickup_location || ''
          break
        case 'activities':
          time = meta.start_time || ''
          subtitle = meta.location || ''
          title = title || meta.activity_name || ''
          break
        default:
          break
      }

      grouped[date].push({
        id: doc.id,
        type: doc.category as DocumentCategory,
        title,
        time,
        subtitle,
        document_id: doc.id,
      })
    })

    // Sort events within each day by time
    const timeline: TimelineEvent[] = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]) => ({
        date,
        events: events.sort((a, b) => (a.time || '').localeCompare(b.time || '')),
      }))

    return NextResponse.json(timeline)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
