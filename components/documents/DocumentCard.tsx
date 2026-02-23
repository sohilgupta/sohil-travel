'use client'

import { motion } from 'framer-motion'
import { Plane, Building2, Car, MapPin, Shield, FileText, ExternalLink } from 'lucide-react'
import { TravelDocument, DocumentCategory } from '@/lib/types'
import { formatDate, CATEGORY_ICON_COLORS } from '@/lib/utils'

const ICONS: Record<DocumentCategory, React.ElementType> = {
  flights: Plane,
  hotels: Building2,
  car_rental: Car,
  activities: MapPin,
  insurance: Shield,
  misc: FileText,
}

interface DocumentCardProps {
  doc: TravelDocument
  index: number
  onOpen: (id: string) => void
}

export function DocumentCard({ doc, index, onOpen }: DocumentCardProps) {
  const Icon = ICONS[doc.category] || FileText
  const iconColor = CATEGORY_ICON_COLORS[doc.category]

  const subtitle = (() => {
    const m = doc.metadata
    if (doc.category === 'flights' && m?.departure_airport && m?.arrival_airport) {
      return `${m.departure_airport} → ${m.arrival_airport}${m.flight_number ? ` · ${m.flight_number}` : ''}`
    }
    if (doc.category === 'hotels' && m?.hotel_name) return m.hotel_name as string
    if (doc.category === 'car_rental' && m?.pickup_location) return m.pickup_location as string
    if (doc.category === 'activities' && m?.location) return m.location as string
    return null
  })()

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      onClick={() => onOpen(doc.id)}
      className="glass rounded-[20px] p-4 cursor-pointer active:scale-[0.97] transition-transform duration-150"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-[12px] bg-white/8 flex items-center justify-center">
          <Icon size={18} className={iconColor} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-white leading-snug line-clamp-2">
              {doc.title || doc.filename.replace('.pdf', '')}
            </p>
            <ExternalLink size={13} className="text-white/20 flex-shrink-0 mt-0.5" />
          </div>

          {subtitle && (
            <p className="text-xs text-white/40 mt-0.5 truncate">{subtitle}</p>
          )}

          <div className="flex items-center gap-2 mt-2">
            {doc.event_date && (
              <span className="text-[11px] text-white/30">
                {formatDate(doc.event_date, 'dd MMM yyyy')}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
