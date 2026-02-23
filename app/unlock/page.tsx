import { UnlockForm } from '@/components/unlock/UnlockForm'
import { TripData } from '@/lib/types'

async function getTripPreview(): Promise<Partial<TripData> | null> {
  try {
    // We fetch internally — use absolute URL for server components
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res = await fetch(`${base}/api/trip`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function UnlockPage() {
  const trip = await getTripPreview()
  return <UnlockForm trip={trip} />
}
