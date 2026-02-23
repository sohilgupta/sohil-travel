import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    const supabase = createServerClient()

    let query = supabase
      .from('documents')
      .select('id, filename, category, title, metadata, event_date, created_at')
      .order('event_date', { ascending: true, nullsFirst: false })

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (search && search.trim()) {
      query = query.or(
        `title.ilike.%${search}%,filename.ilike.%${search}%`
      )
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
