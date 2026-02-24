import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isAuthenticated } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const supabase = createServerClient()

    const { data: doc, error } = await supabase
      .from('documents')
      .select('storage_path, filename')
      .eq('id', id)
      .single()

    if (error || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Generate short-lived signed URL (60 seconds)
    const { data: signed, error: urlError } = await supabase.storage
      .from('travel-documents')
      .createSignedUrl(doc.storage_path, 60)

    if (urlError || !signed) {
      return NextResponse.json({ error: 'Could not generate URL' }, { status: 500 })
    }

    return NextResponse.json({
      url: signed.signedUrl,
      filename: doc.filename,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
