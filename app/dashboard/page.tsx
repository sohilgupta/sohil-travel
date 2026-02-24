import { createServerClient } from '@/lib/supabase/server'
import { HeroCard } from '@/components/dashboard/HeroCard'
import { CategoryTiles } from '@/components/dashboard/CategoryTiles'
import { TripData, DocumentCategory, CategoryInfo } from '@/lib/types'
import { CATEGORY_META } from '@/lib/utils'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { BottomNav } from '@/components/layout/BottomNav'

async function getDashboardData() {
  const supabase = createServerClient()

  const [metaRes, countRes] = await Promise.all([
    supabase.from('trip_metadata').select('*').limit(1).maybeSingle(),
    supabase.from('documents').select('category'),
  ])

  const row = (metaRes.data ?? {}) as Record<string, unknown>

  const trip: Partial<TripData> & Record<string, unknown> = {
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

  // Build category counts
  const counts: Partial<Record<DocumentCategory, number>> = {}
  countRes.data?.forEach(({ category }) => {
    const cat = category as DocumentCategory
    counts[cat] = (counts[cat] || 0) + 1
  })

  const categories: CategoryInfo[] = (Object.keys(counts) as DocumentCategory[])
    .filter((k) => CATEGORY_META[k])
    .map((k) => ({ ...CATEGORY_META[k], count: counts[k]! }))
    .sort((a, b) => {
      const order: DocumentCategory[] = ['flights', 'hotels', 'car_rental', 'activities', 'insurance', 'misc']
      return order.indexOf(a.key) - order.indexOf(b.key)
    })

  return { trip, categories }
}

export default async function DashboardPage() {
  const { trip, categories } = await getDashboardData()

  return (
    <div className="min-h-dvh pb-nav">
      {/* Header */}
      <div className="pt-safe px-4 pt-6 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Trip Vault</h1>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="p-2 rounded-[10px] bg-white/8 text-white/40 hover:text-white/70 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </form>
      </div>

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-purple-600/8 blur-[120px]" />
      </div>

      {/* Content */}
      <div className="px-4 flex flex-col gap-4 pb-4">
        <HeroCard trip={trip} />
        <CategoryTiles categories={categories} />

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/timeline">
            <div className="glass rounded-[20px] p-4 text-center active:scale-[0.97] transition-transform duration-150">
              <p className="text-sm font-medium text-white">View Timeline</p>
              <p className="text-xs text-white/40 mt-0.5">Day by day</p>
            </div>
          </Link>
          <Link href="/documents">
            <div className="glass rounded-[20px] p-4 text-center active:scale-[0.97] transition-transform duration-150">
              <p className="text-sm font-medium text-white">All Documents</p>
              <p className="text-xs text-white/40 mt-0.5">Search & browse</p>
            </div>
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
