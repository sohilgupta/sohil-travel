'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TimelineView } from '@/components/timeline/TimelineView'
import { DocumentModal } from '@/components/documents/DocumentModal'
import { BottomNav } from '@/components/layout/BottomNav'
import { TimelineEvent } from '@/lib/types'
import { Loader2 } from 'lucide-react'

export default function TimelinePage() {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDoc, setActiveDoc] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/timeline')
      .then((r) => {
        if (r.status === 401) { window.location.href = '/unlock'; return [] }
        return r.json()
      })
      .then((data) => setTimeline(Array.isArray(data) ? data : []))
      .catch(() => setTimeline([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-dvh pb-nav">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-blue-600/8 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="pt-safe px-4 pt-6 pb-4">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-semibold text-white"
        >
          Timeline
        </motion.h1>
        <p className="text-xs text-white/35 mt-0.5">Your trip, day by day</p>
      </div>

      {/* Content */}
      <div className="px-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="text-white/30 animate-spin" />
          </div>
        ) : (
          <TimelineView timeline={timeline} onDocumentOpen={setActiveDoc} />
        )}
      </div>

      <BottomNav />

      <DocumentModal documentId={activeDoc} onClose={() => setActiveDoc(null)} />
    </div>
  )
}
