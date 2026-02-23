'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface GlassButtonProps {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'ghost'
  disabled?: boolean
  loading?: boolean
  className?: string
  fullWidth?: boolean
}

export function GlassButton({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  loading = false,
  className,
  fullWidth = false,
}: GlassButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'relative flex items-center justify-center gap-2 rounded-[14px] font-medium text-sm transition-all duration-200',
        'px-6 py-3.5 select-none',
        fullWidth && 'w-full',
        variant === 'primary' &&
          'bg-white text-black hover:bg-white/90 disabled:opacity-40',
        variant === 'ghost' &&
          'glass text-white/80 hover:text-white hover:bg-white/10',
        (disabled || loading) && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading…
        </span>
      ) : (
        children
      )}
    </motion.button>
  )
}
