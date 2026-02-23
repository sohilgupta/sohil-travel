'use client'

import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, icon, rightIcon, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-white/50 uppercase tracking-wider pl-1">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-4 text-white/40">{icon}</span>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full glass rounded-[14px] px-4 py-3.5 text-white placeholder-white/30',
              'text-base outline-none focus:border-white/20 transition-all duration-200',
              'focus:bg-white/[0.08]',
              icon ? 'pl-11' : undefined,
              rightIcon ? 'pr-11' : undefined,
              error ? 'border-red-500/50' : undefined,
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-4 text-white/40">{rightIcon}</span>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-400 pl-1">{error}</p>
        )}
      </div>
    )
  }
)

GlassInput.displayName = 'GlassInput'
