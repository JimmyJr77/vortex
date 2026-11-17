import searchPhotos from './publicSearchPhotos.json'

/** Public contact email shown in footer, contact form, etc. */
export const TEAM_EMAIL = 'team@vortexathletics.com'

/** Public phone number and international dialing value. */
export const TEAM_PHONE = '443-422-4794'
export const TEAM_PHONE_E164 = `+1${TEAM_PHONE.replaceAll('-', '')}`

export const CONTACT_INQUIRY_ID = 'inquiry'
export const CONTACT_INQUIRY_PATH = `/contact#${CONTACT_INQUIRY_ID}`

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
  phone: TEAM_PHONE_E164,
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

export const FACEBOOK_PROFILE_URL = 'https://www.facebook.com/VortexAthleticsUSA/'

/** Official social profiles (schema sameAs). */
export const SOCIAL_PROFILES = [
  'https://www.instagram.com/vortexathletics.usa/',
  FACEBOOK_PROFILE_URL,
  'https://www.youtube.com/@VortexAthleticsUSA',
] as const

/** Exact pin coordinates from the public Google Business Profile. */
export const BUSINESS_GEO = {
  latitude: 38.9564345,
  longitude: -76.7076355,
} as const

export const BUSINESS_FACILITY_PHOTO = {
  src: searchPhotos.facility,
  srcSet: '/gym-DSC02636-768.webp 768w, /gym-DSC02636-1080.webp 1080w, /gym-DSC02636-1600.webp 1600w',
  width: 1600,
  height: 1066,
  alt: 'Gymnastics equipment inside Vortex Athletics and Gymnastics in Bowie, Maryland',
} as const

export const INSIDE_THE_GYM_ID = 'inside-the-gym'
export const INSIDE_THE_GYM_PATH = `/contact#${INSIDE_THE_GYM_ID}`

/** Stable CID link for the verified public Google Business Profile. */
export const GOOGLE_MAPS_URL =
  'https://www.google.com/maps?cid=15262285316302188709'

export const NEXTDOOR_LOCATION_URL = 'https://nextdoor.com/pages/vortex-athletics-gymnastics-bowie-md/'

const googlePlaceId = 'ChIJZ4XjEwDtt4kRpTDa0qGHztM'

export const GOOGLE_DIRECTIONS_URL = `https://www.google.com/maps/dir/?${new URLSearchParams({
  api: '1',
  destination: `${BUSINESS_NAP.streetAddress}, ${BUSINESS_NAP.addressLocality}, ${BUSINESS_NAP.addressRegion} ${BUSINESS_NAP.postalCode}`,
  destination_place_id: googlePlaceId,
})}`

/** Review form for the same verified Google Business Profile. */
export const GOOGLE_REVIEW_URL =
  `https://search.google.com/local/writereview?placeid=${googlePlaceId}`

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
