import {
  BUSINESS_GEO,
  BUSINESS_HOURS,
  BUSINESS_NAP,
  GOOGLE_MAPS_URL,
  SERVICE_AREAS,
  SOCIAL_PROFILES,
  TEAM_EMAIL,
} from '../config/contact'
import { HOME_FAQS, type Faq } from '../config/faqs'
import { GYMNASTICS_FAQS } from '../config/gymnasticsFaqs'
import { SUMMER_CAMP_2026_WEEKS } from '../apps/gymnastics/data/summerCamp2026'
import { SUMMER_CAMP_FAQS } from '../config/summerCampFaqs'
import { GYMNASTICS_ORIGIN } from '../config/gymnasticsSeo'
import { buildCanonical, DEFAULT_OG_IMAGE, HUB_ORIGIN, SITE_NAME } from './seo'

/** Any JSON-LD object (loosely typed; serialized into a <script> tag). */
export type JsonLd = Record<string, unknown>

/** Root URL for an origin, matching the canonical/sitemap form (no trailing slash). */
const rootUrl = (origin: string) => buildCanonical(origin, '/')

const phoneE164 = '+1-443-422-4794'

const postalAddress = () => ({
  '@type': 'PostalAddress',
  streetAddress: BUSINESS_NAP.streetAddress,
  addressLocality: BUSINESS_NAP.addressLocality,
  addressRegion: BUSINESS_NAP.addressRegion,
  postalCode: BUSINESS_NAP.postalCode,
  addressCountry: BUSINESS_NAP.addressCountry,
})

export const organizationSchema = (): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${HUB_ORIGIN}/#organization`,
  name: SITE_NAME,
  url: rootUrl(HUB_ORIGIN),
  logo: DEFAULT_OG_IMAGE,
  email: TEAM_EMAIL,
  telephone: phoneE164,
  sameAs: [...SOCIAL_PROFILES],
})

export const webSiteSchema = (origin: string): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${origin}/#website`,
  url: rootUrl(origin),
  name: origin === GYMNASTICS_ORIGIN ? 'Vortex Gymnastics' : SITE_NAME,
  publisher: { '@id': `${HUB_ORIGIN}/#organization` },
})

/** SportsActivityLocation (LocalBusiness subtype) with canonical NAP + geo + hours. */
export const sportsActivityLocationSchema = (origin: string): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'SportsActivityLocation',
  '@id': `${origin}/#location`,
  name: SITE_NAME,
  url: rootUrl(origin),
  image: DEFAULT_OG_IMAGE,
  telephone: phoneE164,
  email: TEAM_EMAIL,
  priceRange: '$$',
  address: postalAddress(),
  geo: {
    '@type': 'GeoCoordinates',
    latitude: BUSINESS_GEO.latitude,
    longitude: BUSINESS_GEO.longitude,
  },
  hasMap: GOOGLE_MAPS_URL,
  openingHoursSpecification: BUSINESS_HOURS.map((slot) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: slot.days.map((day) => `https://schema.org/${day}`),
    opens: slot.opens,
    closes: slot.closes,
  })),
  areaServed: SERVICE_AREAS.map((name) => ({ '@type': 'City', name })),
  sameAs: [...SOCIAL_PROFILES],
})

export const breadcrumbSchema = (
  items: { name: string; url: string }[],
): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
})

export const courseSchema = (params: {
  name: string
  description: string
  url: string
  providerOrigin: string
}): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'Course',
  name: params.name,
  description: params.description,
  url: params.url,
  provider: {
    '@type': 'SportsActivityLocation',
    name: SITE_NAME,
    url: rootUrl(params.providerOrigin),
  },
})

export const serviceSchema = (params: {
  name: string
  description: string
  url: string
}): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: params.name,
  name: params.name,
  description: params.description,
  url: params.url,
  areaServed: SERVICE_AREAS.map((name) => ({ '@type': 'City', name })),
  provider: { '@id': `${HUB_ORIGIN}/#organization` },
})

const JACKRABBIT_REGISTRATION_URL =
  'https://app3.jackrabbitclass.com/regv2.asp?id=557920'

export const eventSchema = (params: {
  name: string
  description: string
  startDate: string
  endDate: string
  url: string
  registrationUrl?: string
  providerOrigin: string
}): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'Event',
  name: params.name,
  description: params.description,
  startDate: params.startDate,
  endDate: params.endDate,
  eventStatus: 'https://schema.org/EventScheduled',
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  url: params.url,
  location: {
    '@type': 'Place',
    name: 'Vortex Gymnastics',
    address: postalAddress(),
  },
  organizer: {
    '@type': 'Organization',
    name: 'Vortex Gymnastics',
    url: rootUrl(params.providerOrigin),
  },
  offers: {
    '@type': 'Offer',
    url: params.registrationUrl ?? params.url,
    availability: 'https://schema.org/InStock',
  },
})

export const faqPageSchema = (faqs: Faq[]): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: { '@type': 'Answer', text: faq.answer },
  })),
})

const crumb = (origin: string, name: string, path: string) => ({
  name,
  url: buildCanonical(origin, path),
})

/** JSON-LD for a given hub (vortexathletics.com) route. */
export const getHubSchema = (pathname: string): JsonLd[] => {
  const schema: JsonLd[] = [organizationSchema(), webSiteSchema(HUB_ORIGIN)]

  if (pathname === '/') {
    schema.push(sportsActivityLocationSchema(HUB_ORIGIN))
    schema.push(faqPageSchema(HOME_FAQS))
    return schema
  }

  const url = buildCanonical(HUB_ORIGIN, pathname)
  const breadcrumbName: Record<string, string> = {
    '/ninja': 'Kids Ninja Classes',
    '/strength-conditioning': 'Fit & Flip Adult Fitness',
    '/athleticism-accelerator': 'Athleticism Accelerator',
    '/summer-athletic-training': 'Summer Athletic Training',
    '/value': 'Why Vortex',
    '/read-board': 'Classes & Events',
  }
  const name = breadcrumbName[pathname]
  if (name) {
    schema.push(
      breadcrumbSchema([crumb(HUB_ORIGIN, 'Home', '/'), crumb(HUB_ORIGIN, name, pathname)]),
    )
  }

  if (pathname === '/ninja') {
    schema.push(
      courseSchema({
        name: 'Kids Ninja Classes',
        description:
          'Ninja obstacle classes for kids in Bowie, MD. Build strength, agility, and confidence on warped walls and obstacle courses.',
        url,
        providerOrigin: HUB_ORIGIN,
      }),
    )
  }
  if (pathname === '/athleticism-accelerator') {
    schema.push(
      serviceSchema({
        name: 'Youth Athletic Training (Athleticism Accelerator)',
        description:
          'Sports-performance training for young athletes in Bowie, MD across eight tenets of athleticism: speed, power, coordination, and injury-resistant movement.',
        url,
      }),
    )
  }
  if (pathname === '/summer-athletic-training') {
    schema.push(
      serviceSchema({
        name: 'Middle & High School Summer Athletic Training (Athleticism Accelerator)',
        description:
          'Summer athletic development program for middle and high school athletes in Bowie, MD. Speed, strength, agility, mobility, conditioning, and performance testing. Free sessions available for students from select schools.',
        url,
      }),
    )
  }
  if (pathname === '/strength-conditioning') {
    schema.push(
      serviceSchema({
        name: 'Fit & Flip Adult Fitness & Acrobatics',
        description:
          'Adult fitness, conditioning, and acrobatics in Bowie, MD. Functional strength and mobility for adults and athletes.',
        url,
      }),
    )
  }

  return schema
}

/** JSON-LD for a given gymnastics (vortex-gymnastics.com) route. */
export const getGymnasticsSchema = (pathname: string): JsonLd[] => {
  const origin = GYMNASTICS_ORIGIN
  const schema: JsonLd[] = [organizationSchema(), webSiteSchema(origin)]

  if (pathname === '/' || pathname === '/gymnastics') {
    schema.push(sportsActivityLocationSchema(origin))
    schema.push(faqPageSchema(GYMNASTICS_FAQS))
    if (pathname === '/gymnastics') {
      schema.push(
        breadcrumbSchema([
          crumb(origin, 'Home', '/'),
          crumb(origin, 'Gymnastics Programs', '/gymnastics'),
        ]),
      )
    }
    return schema
  }

  const url = buildCanonical(origin, pathname)

  if (pathname === '/summer-camp-26') {
    schema.push(
      breadcrumbSchema([
        crumb(origin, 'Home', '/'),
        crumb(origin, 'Summer Camp 2026', pathname),
      ]),
    )
    schema.push(faqPageSchema(SUMMER_CAMP_FAQS))
    for (const week of SUMMER_CAMP_2026_WEEKS) {
      const [start, end] = week.dateRange.split('/')
      schema.push(
        eventSchema({
          name: `Vortex Gymnastics Summer Camp 2026 — Week ${week.week}`,
          description: `${week.dates}: ${week.activities.join(', ')}. Ages 6–14.`,
          startDate: start,
          endDate: end,
          url,
          registrationUrl: JACKRABBIT_REGISTRATION_URL,
          providerOrigin: origin,
        }),
      )
    }
    return schema
  }

  const programs: Record<string, { name: string; description: string }> = {
    '/artistic-gymnastics-early': {
      name: 'Preschool Gymnastics (Ages 2-5)',
      description:
        'Preschool and toddler gymnastics in Bowie, MD for ages 2-5. Build coordination, balance, and confidence through play.',
    },
    '/artistic-gymnastics-6-12': {
      name: 'Kids Gymnastics Classes (Ages 6-12)',
      description:
        'Gymnastics classes for kids ages 6-12 in Bowie, MD. Beginner to advanced with safe technique and progression.',
    },
    '/artistic-gymnastics-13-18': {
      name: 'Teen & Competitive Gymnastics (Ages 13-18)',
      description:
        'Advanced and competitive gymnastics for ages 13-18 in Bowie, MD. Strength, skills, and performance readiness.',
    },
    '/acro-gymnastics': {
      name: 'Acrobatic Gymnastics (Acro)',
      description:
        'Partner and group acrobatic gymnastics in Bowie, MD. Balances, lifts, dynamic skills, and teamwork for developing and competitive athletes.',
    },
    '/artistic-gymnastics': {
      name: 'Artistic Gymnastics',
      description:
        'Artistic gymnastics in Bowie, MD — vault, bars, beam, and floor with progressive training for all ages.',
    },
    '/rhythmic-gymnastics': {
      name: 'Rhythmic Gymnastics',
      description:
        'Rhythmic gymnastics in Bowie, MD. Apparatus work, choreography, flexibility, and performance training.',
    },
    '/trampoline-tumbling': {
      name: 'Trampoline & Tumbling',
      description:
        'Trampoline and tumbling in Bowie, MD. Air awareness, safe progressions, and routine development.',
    },
    '/aerobic-gymnastics': {
      name: 'Aerobic Gymnastics',
      description:
        'Aerobic gymnastics in Bowie, MD. High-energy routines, dynamic strength, and performance training.',
    },
  }
  const program = programs[pathname]
  if (program) {
    schema.push(
      breadcrumbSchema([
        crumb(origin, 'Home', '/'),
        crumb(origin, program.name, pathname),
      ]),
    )
    schema.push(
      courseSchema({
        name: program.name,
        description: program.description,
        url,
        providerOrigin: origin,
      }),
    )
  }

  return schema
}
