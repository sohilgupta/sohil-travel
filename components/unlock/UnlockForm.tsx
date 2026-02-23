'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useAnimation } from 'framer-motion'
import { Lock, Eye, EyeOff, Plane } from 'lucide-react'
import { GlassButton } from '@/components/ui/GlassButton'
import { TripData } from '@/lib/types'
import { formatDate } from '@/lib/utils'

interface UnlockFormProps {
  trip: Partial<TripData> | null
}

export function UnlockForm({ trip }: UnlockFormProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const controls = useAnimation()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Build display title from trip data
  const tripName = trip?.trip_name || 'Your Trip'
  const dateRange =
    trip?.start_date && trip?.end_date
      ? `${formatDate(trip.start_date, 'dd MMM')} – ${formatDate(trip.end_date, 'dd MMM yyyy')}`
      : null
  const destinations = trip?.destinations?.join(' · ') || null
  const airline = trip?.primary_airline || null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (res.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError(data.error || 'Incorrect password')
        setPassword('')
        // Shake animation
        await controls.start({
          x: [0, -12, 12, -8, 8, -4, 4, 0],
          transition: { duration: 0.5 },
        })
        inputRef.current?.focus()
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 pt-safe pb-safe relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-blue-600/10 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-sm relative"
      >
        <motion.div animate={controls}>
          <div className="glass-strong rounded-[32px] p-8 glow-purple">
            {/* Header */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-white/10 mb-5"
              >
                <Plane size={28} className="text-white" />
              </motion.div>

              <h1 className="text-2xl font-semibold text-white mb-1">{tripName}</h1>

              {dateRange && (
                <p className="text-sm text-white/50 mb-1">{dateRange}</p>
              )}

              {destinations && (
                <p className="text-xs text-white/35 font-medium tracking-wide uppercase">
                  {destinations}
                </p>
              )}

              {airline && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/8">
                  <Plane size={11} className="text-white/40" />
                  <span className="text-xs text-white/40">{airline}</span>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                  <Lock size={16} />
                </div>
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                  autoComplete="current-password"
                  className="w-full glass rounded-[14px] pl-10 pr-12 py-3.5 text-white placeholder-white/25 text-base outline-none focus:bg-white/[0.08] transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-400 text-center"
                >
                  {error}
                </motion.p>
              )}

              <GlassButton
                type="submit"
                variant="primary"
                fullWidth
                loading={loading}
                disabled={!password.trim()}
              >
                Unlock
              </GlassButton>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
