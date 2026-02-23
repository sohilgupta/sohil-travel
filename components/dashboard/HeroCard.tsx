'use client'

import { motion } from 'framer-motion'
import { Plane, Calendar, MapPin, Users } from 'lucide-react'
import { TripData } from '@/lib/types'
import { formatDate } from '@/lib/utils'

interface HeroCardProps {
  trip: Partial<TripData>
}

export function HeroCard({ trip }: HeroCardProps) {
  const {
    trip_name,
    start_date,
    end_date,
    destinations = [],
    passengers = [],
    duration_days,
    primary_airline,
  } = trip

  const routeSummary =
    destinations.length >= 2
      ? `${destinations[0]} → ${destinations[destinations.length - 1]}`
      : destinations[0] || 'Your Trip'

  const passengerDisplay =
    passengers.length > 0 ? passengers.join(' & ') : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative rounded-[28px] overflow-hidden p-6"
      style={{
        background:
          'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(59,130,246,0.15) 50%, rgba(16,185,129,0.1) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        boxShadow: '0 20px 80px rgba(139,92,246,0.2), 0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      {/* Background orb */}
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

      {/* Airline badge */}
      {primary_airline && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 mb-4">
          <Plane size={11} className="text-white/60" />
          <span className="text-xs text-white/60 font-medium">{primary_airline}</span>
        </div>
      )}

      {/* Main title */}
      <h2 className="text-2xl font-semibold text-white mb-1 leading-tight">
        {trip_name || routeSummary}
      </h2>

      {passengerDisplay && (
        <p className="text-sm text-white/50 mb-5 flex items-center gap-1.5">
          <Users size={13} className="text-white/30" />
          {passengerDisplay}
        </p>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {start_date && end_date && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-white/35 uppercase tracking-wider font-medium">
              Dates
            </span>
            <span className="text-xs font-medium text-white/80">
              {formatDate(start_date, 'dd MMM')} –{' '}
              {formatDate(end_date, 'dd MMM')}
            </span>
          </div>
        )}

        {duration_days && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-white/35 uppercase tracking-wider font-medium">
              Duration
            </span>
            <span className="text-xs font-medium text-white/80">
              {duration_days} days
            </span>
          </div>
        )}

        {destinations.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-white/35 uppercase tracking-wider font-medium">
              Stops
            </span>
            <span className="text-xs font-medium text-white/80">
              {destinations.length} cities
            </span>
          </div>
        )}
      </div>

      {/* Route chips */}
      {destinations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {destinations.map((d, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/8 border border-white/8"
            >
              <MapPin size={9} className="text-white/30" />
              <span className="text-[11px] text-white/60">{d}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
