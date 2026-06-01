/** Public contact email shown in footer, contact form, etc. */
export const TEAM_EMAIL = 'team@vortexathletics.com'

/** Public phone number (display + tel: link). */
export const TEAM_PHONE = '+1 (443) 422-4794'

/** Canonical NAP (name, address, phone) — keep identical everywhere for local SEO. */
export const BUSINESS_NAP = {
  name: 'Vortex Athletics',
  streetAddress: '4961 Tesla Dr, Ste E',
  addressLocality: 'Bowie',
  addressRegion: 'MD',
  postalCode: '20715',
  addressCountry: 'US',
  phone: TEAM_PHONE,
  email: TEAM_EMAIL,
} as const

/** Areas Vortex serves (used in copy + schema areaServed). */
export const SERVICE_AREAS = [
  'Bowie, MD',
  'Crofton, MD',
  'Mitchellville, MD',
  'Upper Marlboro, MD',
  'Glenn Dale, MD',
  'Annapolis, MD',
  "Prince George's County, MD",
  'Anne Arundel County, MD',
] as const

/** Official social profiles (schema sameAs). */
export const SOCIAL_PROFILES = [
  'https://www.instagram.com/vortexathletics.usa/',
  'https://www.facebook.com/profile.php?id=61585434675018',
  'https://www.youtube.com/@VortexAthleticsUSA',
] as const

/**
 * Approximate geo coordinates for 4961 Tesla Dr (Melford Town Center block).
 * Derived from neighboring Tesla Dr addresses; confirm against Google Business
 * Profile if exact precision is needed.
 */
export const BUSINESS_GEO = {
  latitude: 38.9565,
  longitude: -76.7088,
} as const

/** Google Maps link for the facility (used for hasMap + contact CTA). */
export const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=Vortex+Athletics+4961+Tesla+Dr+Ste+E+Bowie+MD+20715'

/**
 * Hours of operation. `days` use schema.org DayOfWeek names; times are 24h.
 * Sunday is closed and intentionally omitted.
 */
export const BUSINESS_HOURS = [
  {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '16:00',
    closes: '20:30',
    label: 'Mon-Fri: 4:00-8:30 PM',
  },
  {
    days: ['Saturday'],
    opens: '09:00',
    closes: '12:00',
    label: 'Sat: 9:00 AM-12:00 PM',
  },
] as const
