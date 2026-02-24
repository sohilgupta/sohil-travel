'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { X, Download, ExternalLink, Loader2 } from 'lucide-react'

interface DocumentModalProps {
  documentId: string | null
  onClose: () => void
}

export function DocumentModal({ documentId, onClose }: DocumentModalProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId) {
      setUrl(null)
      setFilename('')
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    fetch(`/api/document/${documentId}`)
      .then((r) => {
        if (r.status === 401) { window.location.href = '/unlock'; return null }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        if (data.url) {
          setUrl(data.url)
          setFilename(data.filename || 'document.pdf')
        } else {
          setError('Could not load document.')
        }
      })
      .catch(() => setError('Failed to fetch document.'))
      .finally(() => setLoading(false))
  }, [documentId])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100) onClose()
  }

  const handleDownload = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    a.click()
  }

  return (
    <AnimatePresence>
      {documentId && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 40 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
            style={{ maxHeight: '92dvh' }}
          >
            <div className="glass-strong rounded-t-[32px] flex flex-col overflow-hidden" style={{ maxHeight: '92dvh' }}>
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
                <p className="text-sm font-medium text-white/80 truncate flex-1 mr-3">
                  {filename.replace('.pdf', '') || 'Document'}
                </p>
                <div className="flex items-center gap-2">
                  {url && (
                    <button
                      onClick={handleDownload}
                      className="p-2 rounded-[10px] bg-white/8 hover:bg-white/15 transition-colors"
                    >
                      <Download size={16} className="text-white/60" />
                    </button>
                  )}
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-[10px] bg-white/8 hover:bg-white/15 transition-colors"
                    >
                      <ExternalLink size={16} className="text-white/60" />
                    </a>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-[10px] bg-white/8 hover:bg-white/15 transition-colors"
                  >
                    <X size={16} className="text-white/60" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden min-h-0">
                {loading && (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 size={24} className="text-white/40 animate-spin" />
                  </div>
                )}

                {error && (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-sm text-white/40">{error}</p>
                  </div>
                )}

                {url && !loading && (
                  <iframe
                    src={`${url}#toolbar=0&navpanes=0&scrollbar=1`}
                    className="w-full h-full border-0"
                    style={{ minHeight: '65dvh' }}
                    title={filename}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
