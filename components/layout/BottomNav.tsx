'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, FolderOpen } from 'lucide-react'
import { motion } from 'framer-motion'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/timeline', icon: Calendar, label: 'Timeline' },
  { href: '/documents', icon: FolderOpen, label: 'Documents' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="mx-4 mb-3">
        <div className="glass-strong rounded-[22px] px-2 py-2 flex items-center justify-around">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center gap-0.5 py-1 relative"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-[16px] bg-white/10"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <Icon
                  size={22}
                  className={`relative transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-white/40'
                  }`}
                />
                <span
                  className={`relative text-[10px] font-medium transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-white/30'
                  }`}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
