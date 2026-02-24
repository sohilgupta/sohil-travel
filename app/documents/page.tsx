'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { DocumentCard } from '@/components/documents/DocumentCard'
import { DocumentModal } from '@/components/documents/DocumentModal'
import { BottomNav } from '@/components/layout/BottomNav'
import { TravelDocument, DocumentCategory } from '@/lib/types'
import { CATEGORY_META } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

const ALL_CATEGORIES: { key: DocumentCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  ...Object.values(CATEGORY_META).map((c) => ({ key: c.key, label: c.label })),
]

function DocumentsContent() {
  const searchParams = useSearchParams()
  const initialCategory = (searchParams.get('category') as DocumentCategory) || 'all'

  const [documents, setDocuments] = useState<TravelDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<DocumentCategory | 'all'>(initialCategory)
  const [activeDoc, setActiveDoc] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/documents?${params}`)
      if (res.status === 401) { window.location.href = '/unlock'; return }
      const data = await res.json()
      setDocuments(Array.isArray(data) ? data : [])
    } catch {
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [category, search])

  useEffect(() => {
    const timer = setTimeout(fetchDocuments, 300)
    return () => clearTimeout(timer)
  }, [fetchDocuments])

  const activeCategories = ALL_CATEGORIES.filter((c) => {
    if (c.key === 'all') return true
    return documents.some((d) => d.category === c.key) || category === c.key
  })

  return (
    <div className="min-h-dvh pb-nav">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-emerald-600/6 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="pt-safe px-4 pt-6 pb-3 sticky top-0 z-10 bg-[#070711]/80 backdrop-blur-xl">
        <h1 className="text-lg font-semibold text-white mb-3">Documents</h1>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full glass rounded-[14px] pl-9 pr-10 py-3 text-sm text-white placeholder-white/25 outline-none focus:bg-white/[0.08] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                category === cat.key
                  ? 'bg-white text-black'
                  : 'glass text-white/50 hover:text-white/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      <div className="px-4 flex flex-col gap-2.5 mt-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="text-white/30 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="glass rounded-[20px] p-8 text-center mt-4">
            <p className="text-sm text-white/40">No documents found</p>
          </div>
        ) : (
          documents.map((doc, i) => (
            <DocumentCard key={doc.id} doc={doc} index={i} onOpen={setActiveDoc} />
          ))
        )}
      </div>

      <BottomNav />
      <DocumentModal documentId={activeDoc} onClose={() => setActiveDoc(null)} />
    </div>
  )
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-dvh">
        <Loader2 size={24} className="text-white/30 animate-spin" />
      </div>
    }>
      <DocumentsContent />
    </Suspense>
  )
}
