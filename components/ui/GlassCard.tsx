'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  animate?: boolean
  delay?: number
  glow?: boolean
}

export function GlassCard({
  children,
  className,
  onClick,
  animate = true,
  delay = 0,
  glow = false,
}: GlassCardProps) {
  const content = (
    <div
      onClick={onClick}
      className={cn(
        'glass rounded-[24px] overflow-hidden',
        glow && 'glow-purple',
        onClick && 'cursor-pointer active:scale-[0.98] transition-transform duration-150',
        className
      )}
    >
      {children}
    </div>
  )

  if (!animate) return content

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onClick}
      className={cn(
        'glass rounded-[24px] overflow-hidden',
        glow && 'glow-purple',
        onClick && 'cursor-pointer active:scale-[0.98] transition-transform duration-150',
        className
      )}
    >
      {children}
    </motion.div>
  )
}
