'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Plane,
  Building2,
  Car,
  MapPin,
  Shield,
  FileText,
  ChevronRight,
} from 'lucide-react'
import { DocumentCategory, CategoryInfo } from '@/lib/types'
import { CATEGORY_COLORS, CATEGORY_ICON_COLORS } from '@/lib/utils'

const ICONS: Record<DocumentCategory, React.ElementType> = {
  flights: Plane,
  hotels: Building2,
  car_rental: Car,
  activities: MapPin,
  insurance: Shield,
  misc: FileText,
}

interface CategoryTilesProps {
  categories: CategoryInfo[]
}

export function CategoryTiles({ categories }: CategoryTilesProps) {
  if (categories.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3 px-1">
        Documents
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat, i) => {
          const Icon = ICONS[cat.key]
          const colors = CATEGORY_COLORS[cat.key]
          const iconColor = CATEGORY_ICON_COLORS[cat.key]

          return (
            <motion.div
              key={cat.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: 0.1 + i * 0.06,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              <Link
                href={`/documents?category=${cat.key}`}
                className="block"
              >
                <div
                  className={`rounded-[20px] p-4 bg-gradient-to-br ${colors} border active:scale-[0.97] transition-transform duration-150`}
                  style={{
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-[10px] bg-black/20">
                      <Icon size={18} className={iconColor} />
                    </div>
                    <ChevronRight size={14} className="text-white/20 mt-1" />
                  </div>
                  <p className="text-sm font-semibold text-white">{cat.label}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {cat.count} {cat.count === 1 ? 'doc' : 'docs'}
                  </p>
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
