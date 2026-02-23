export type DocumentCategory =
  | 'flights'
  | 'hotels'
  | 'car_rental'
  | 'activities'
  | 'insurance'
  | 'misc'

export interface DocumentMetadata {
  // Flights
  flight_number?: string
  departure_airport?: string
  arrival_airport?: string
  departure_time?: string
  arrival_time?: string
  pnr?: string
  passengers?: string[]
  airline?: string
  // Hotels
  hotel_name?: string
  check_in?: string
  check_out?: string
  // Car Rental
  pickup_location?: string
  dropoff_location?: string
  pickup_date?: string
  dropoff_date?: string
  pickup_time?: string
  vehicle?: string
  booking_ref?: string
  // Activities
  activity_name?: string
  start_time?: string
  end_time?: string
  duration?: string
  location?: string
  // General
  [key: string]: unknown
}

export interface TravelDocument {
  id: string
  filename: string
  storage_path: string
  category: DocumentCategory
  title: string | null
  metadata: DocumentMetadata
  event_date: string | null
  created_at: string
}

export interface TripData {
  start_date: string | null
  end_date: string | null
  destinations: string[]
  passengers: string[]
  primary_airline: string | null
  duration_days: number | null
  total_flights: number
  total_activities: number
  total_hotels: number
  trip_name: string | null
}

export interface TimelineEvent {
  date: string
  events: TimelineItem[]
}

export interface TimelineItem {
  id: string
  type: DocumentCategory
  title: string
  time?: string
  subtitle?: string
  document_id: string
}

export interface CategoryInfo {
  key: DocumentCategory
  label: string
  count: number
  icon: string
}
