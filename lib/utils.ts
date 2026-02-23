import { format, parseISO, differenceInDays } from 'date-fns'
import { DocumentCategory, CategoryInfo } from './types'

export function formatDate(dateStr: string | null, fmt = 'dd MMM yyyy'): string {
  if (!dateStr) return ''
  try {
    return format(parseISO(dateStr), fmt)
  } catch {
    return dateStr
  }
}

export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return ''
  return timeStr
}

export function tripDuration(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  try {
    return differenceInDays(parseISO(end), parseISO(start)) + 1
  } catch {
    return null
  }
}

export const CATEGORY_META: Record<DocumentCategory, Omit<CategoryInfo, 'count'>> = {
  flights: { key: 'flights', label: 'Flights', icon: 'Plane' },
  hotels: { key: 'hotels', label: 'Hotels', icon: 'Building2' },
  car_rental: { key: 'car_rental', label: 'Car Rental', icon: 'Car' },
  activities: { key: 'activities', label: 'Activities', icon: 'MapPin' },
  insurance: { key: 'insurance', label: 'Insurance', icon: 'Shield' },
  misc: { key: 'misc', label: 'Other Docs', icon: 'FileText' },
}

export const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  flights: 'from-blue-500/20 to-cyan-500/20 border-blue-500/20',
  hotels: 'from-purple-500/20 to-pink-500/20 border-purple-500/20',
  car_rental: 'from-amber-500/20 to-orange-500/20 border-amber-500/20',
  activities: 'from-green-500/20 to-emerald-500/20 border-green-500/20',
  insurance: 'from-slate-500/20 to-zinc-500/20 border-slate-500/20',
  misc: 'from-rose-500/20 to-red-500/20 border-rose-500/20',
}

export const CATEGORY_ICON_COLORS: Record<DocumentCategory, string> = {
  flights: 'text-blue-400',
  hotels: 'text-purple-400',
  car_rental: 'text-amber-400',
  activities: 'text-green-400',
  insurance: 'text-slate-400',
  misc: 'text-rose-400',
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
