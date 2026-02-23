'use client'

import { motion } from 'framer-motion'
import { Plane, Building2, Car, MapPin, Clock } from 'lucide-react'
import { TimelineEvent, DocumentCategory } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { CATEGORY_ICON_COLORS } from '@/lib/utils'

const TYPE_ICONS: Record<DocumentCategory, React.ElementType> = {
  flights: Plane,
  hotels: Building2,
  car_rental: Car,
  activities: MapPin,
  insurance: MapPin,
  misc: MapPin,
}

const TYPE_LABELS: Record<DocumentCategory, string> = {
  flights: 'Flight',
  hotels: 'Hotel',
  car_rental: 'Car Rental',
  activities: 'Activity',
  insurance: 'Insurance',
  misc: 'Document',
}

interface TimelineViewProps {
  timeline: TimelineEvent[]
  onDocumentOpen: (id: string) => void
}

export function TimelineView({ timeline, onDocumentOpen }: TimelineViewProps) {
  if (timeline.length === 0) {
    return (
      <div className="glass rounded-[24px] p-8 text-center">
        <p className="text-white/40">No timeline events found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {timeline.map((day, dayIdx) => (
        <motion.div
          key={day.date}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: dayIdx * 0.05 }}
        >
          {/* Date header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="glass-subtle rounded-[12px] px-3 py-1.5">
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                {formatDate(day.date, 'EEE dd MMM')}
              </span>
            </div>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Events for this day */}
          <div className="flex flex-col gap-2 ml-2 relative">
            {/* Vertical line */}
            {day.events.length > 1 && (
              <div className="absolute left-4 top-8 bottom-8 w-px bg-white/5" />
            )}

            {day.events.map((event, eventIdx) => {
              const Icon = TYPE_ICONS[event.type] || MapPin
              const iconColor = CATEGORY_ICON_COLORS[event.type]

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: dayIdx * 0.05 + eventIdx * 0.04 }}
                  onClick={() => onDocumentOpen(event.document_id)}
                  className="flex items-start gap-3 p-4 glass rounded-[18px] cursor-pointer active:scale-[0.98] transition-transform duration-150"
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-[10px] bg-white/8 flex items-center justify-center mt-0.5">
                    <Icon size={14} className={iconColor} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white leading-snug truncate">
                        {event.title || TYPE_LABELS[event.type]}
                      </p>
                      {event.time && (
                        <span className="flex-shrink-0 flex items-center gap-1 text-[11px] text-white/35">
                          <Clock size={10} />
                          {event.time}
                        </span>
                      )}
                    </div>
                    {event.subtitle && (
                      <p className="text-xs text-white/40 mt-0.5 truncate">
                        {event.subtitle}
                      </p>
                    )}
                    <span className="inline-block mt-1.5 text-[10px] text-white/25 uppercase tracking-wide font-medium">
                      {TYPE_LABELS[event.type]}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
