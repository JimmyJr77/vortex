/** Public contact email shown in footer, contact form, etc. */
export const TEAM_EMAIL = 'team@vortexathletics.com'

/** Public phone number (display + tel: link). */
export const TEAM_PHONE = '+1 (443) 422-4794'

/** Jackrabbit Parent Portal (member account login). */
export const JACKRABBIT_PARENT_PORTAL_URL =
  'https://app.jackrabbitclass.com/jr4.0/ParentPortal/Login?orgId=557920'

/** Jackrabbit class registration / enrollment portal. */
export const JACKRABBIT_CLASS_REGISTRATION_URL =
  'https://app.jackrabbitclass.com/regv2.asp?id=557920'

/** Canonical NAP (name, address, phone) — keep identical everywhere for local SEO. */
export const BUSINESS_NAP = {
  // Match the public Google Business Profile exactly so search engines can
  // reconcile the website, map listing, and citations as one local entity.
  name: 'Vortex Athletics and Gymnastics',
  streetAddress: '4961 Tesla Dr Suite E',
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

/** Exact pin coordinates from the public Google Business Profile. */
export const BUSINESS_GEO = {
  latitude: 38.9564345,
  longitude: -76.7076355,
} as const

/** Stable CID link for the verified public Google Business Profile. */
export const GOOGLE_MAPS_URL =
  'https://www.google.com/maps?cid=15262285316302188709'

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
