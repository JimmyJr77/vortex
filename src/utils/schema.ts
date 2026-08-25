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
import { BEGINNER_GYMNASTICS_FAQS } from '../config/beginnerGymnasticsFaqs'
import { DROP_IN_FAQS, HOMESCHOOL_GYMNASTICS_FAQS } from '../config/localSeoFaqs'
import { SUMMER_CAMP_FAQS } from '../config/summerCampFaqs'
import { YOUTH_TRAINING_FAQS } from '../config/youthTrainingFaqs'
import { GYMNASTICS_ORIGIN } from '../config/gymnasticsSeo'
import { ENROLL_PATH } from '../config/enrollSites'
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
  legalName: 'Vortex Athletics, LLC',
  alternateName: ['Vortex Athletics and Gymnastics', 'Vortex Gymnastics'],
  url: rootUrl(HUB_ORIGIN),
  logo: DEFAULT_OG_IMAGE,
  address: postalAddress(),
  email: TEAM_EMAIL,
  telephone: phoneE164,
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: phoneE164,
    email: TEAM_EMAIL,
    contactType: 'customer service',
    areaServed: 'US-MD',
    availableLanguage: 'English',
  },
  location: { '@id': `${HUB_ORIGIN}/#location` },
  sameAs: [...SOCIAL_PROFILES, GOOGLE_MAPS_URL],
})

export const webSiteSchema = (origin: string): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${origin}/#website`,
  url: rootUrl(origin),
  name: origin === GYMNASTICS_ORIGIN ? 'Vortex Gymnastics' : SITE_NAME,
  publisher: { '@id': `${HUB_ORIGIN}/#organization` },
})

const localServiceCatalog = () => ({
  '@type': 'OfferCatalog',
  name: 'Youth athletics and gymnastics programs',
  itemListElement: [
    'Youth Sports Performance Training',
    'Gymnastics Classes',
    'Beginner Gymnastics',
    'Artistic Gymnastics',
    'Rhythmic Gymnastics',
    'Acrobatic Gymnastics',
    'Trampoline and Tumbling',
    'Fit & Flip Athletic Training',
    'Homeschool Gymnastics and PE',
    'Drop-In Youth Classes',
  ].map((name) => ({
    '@type': 'Offer',
    itemOffered: { '@type': 'Service', name },
  })),
})

/** One stable local entity shared by both sites, matching the Google profile. */
export const sportsActivityLocationSchema = (pageOrigin: string): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'SportsActivityLocation',
  '@id': `${HUB_ORIGIN}/#location`,
  name: BUSINESS_NAP.name,
  alternateName: [SITE_NAME, 'Vortex Gymnastics'],
  url: rootUrl(HUB_ORIGIN),
  mainEntityOfPage: rootUrl(pageOrigin),
  description:
    'Youth sports performance training and gymnastics classes for children and teens in Bowie, Maryland, including speed, agility, strength, conditioning, tumbling, and competitive gymnastics.',
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
  sport: ['Gymnastics', 'Youth sports', 'Strength and conditioning', 'Tumbling'],
  knowsAbout: [
    'Youth athletic development',
    'Sports performance training',
    'Speed and agility training',
    'Strength and conditioning',
    'Artistic gymnastics',
    'Rhythmic gymnastics',
    'Acrobatic gymnastics',
    'Trampoline and tumbling',
  ],
  parentOrganization: { '@id': `${HUB_ORIGIN}/#organization` },
  hasOfferCatalog: localServiceCatalog(),
  sameAs: [...SOCIAL_PROFILES, GOOGLE_MAPS_URL, rootUrl(GYMNASTICS_ORIGIN)],
  potentialAction: {
    '@type': 'ReserveAction',
    target: `${HUB_ORIGIN}${ENROLL_PATH}`,
    result: { '@type': 'Reservation', name: 'Vortex class enrollment' },
  },
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
  inLanguage: 'en-US',
  courseMode: 'onsite',
  provider: {
    '@type': 'SportsActivityLocation',
    '@id': `${HUB_ORIGIN}/#location`,
    name: BUSINESS_NAP.name,
    url: rootUrl(HUB_ORIGIN),
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
  provider: { '@id': `${HUB_ORIGIN}/#location` },
})

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
    '@id': `${HUB_ORIGIN}/#location`,
    name: BUSINESS_NAP.name,
    address: postalAddress(),
  },
  organizer: {
    '@type': 'Organization',
    '@id': `${HUB_ORIGIN}/#organization`,
    name: SITE_NAME,
    url: rootUrl(HUB_ORIGIN),
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
    '/fit-and-flip': 'Fit & Flip Athletic Training',
    '/vortex-athletics': 'Vortex Athletics',
    '/summer-athletic-training': 'Summer Athletic Training',
    '/value': 'Why Vortex',
    '/read-board': 'Classes & Events',
    '/drop-in': 'Drop-In Classes',
    '/contact': 'Contact & Location',
    '/support': 'Customer Support',
    '/privacy-policy': 'Privacy Policy',
    '/terms-of-service': 'Terms of Service',
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
  if (pathname === '/vortex-athletics') {
    schema.push(sportsActivityLocationSchema(HUB_ORIGIN))
    schema.push(faqPageSchema(YOUTH_TRAINING_FAQS))
    schema.push(
      serviceSchema({
        name: 'Youth Sports Performance Training',
        description:
          'Youth sports performance training in Bowie, MD focused on speed, agility, strength, explosiveness, conditioning, coordination, and body control.',
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
  if (pathname === '/fit-and-flip') {
    schema.push(
      serviceSchema({
        name: 'Fit & Flip Foundational Athletic Training',
        description:
          'Foundational athletics training combining advanced athletic development with tumbling, coordination, and body control in 1.5-hour blocks.',
        url,
      }),
    )
  }
  if (pathname === '/drop-in') {
    schema.push(sportsActivityLocationSchema(HUB_ORIGIN))
    schema.push(faqPageSchema(DROP_IN_FAQS))
    schema.push(
      serviceSchema({
        name: 'Single-Day Drop-In Youth Classes',
        description:
          'Single-day gymnastics, fitness, and youth athletic training classes in Bowie, MD without a monthly enrollment.',
        url,
      }),
    )
  }
  if (pathname === '/contact') {
    schema.push(sportsActivityLocationSchema(HUB_ORIGIN))
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

  if (pathname === '/drop-in') {
    schema.push(
      breadcrumbSchema([
        crumb(origin, 'Home', '/'),
        crumb(origin, 'Gymnastics Drop-In Classes', pathname),
      ]),
    )
    schema.push(sportsActivityLocationSchema(origin))
    schema.push(faqPageSchema(DROP_IN_FAQS))
    schema.push(
      courseSchema({
        name: 'Gymnastics Drop-In Classes',
        description:
          'Book a single available gymnastics class in Bowie, MD without starting a monthly enrollment.',
        url,
        providerOrigin: origin,
      }),
    )
    return schema
  }

  if (pathname === '/summer-camp-26') {
    schema.push(
      breadcrumbSchema([
        crumb(origin, 'Home', '/'),
        crumb(origin, 'Summer Camp 2026', pathname),
      ]),
    )
    schema.push(faqPageSchema(SUMMER_CAMP_FAQS))
    return schema
  }

  const programs: Record<string, { name: string; description: string }> = {
    '/homeschool-gymnastics': {
      name: 'Homeschool Gymnastics & Physical Education',
      description:
        'Daytime homeschool gymnastics and physical education in Bowie, MD focused on strength, coordination, confidence, and social movement.',
    },
    '/beginner-gymnastics': {
      name: 'Beginner Gymnastics Classes for Kids',
      description:
        'Beginner gymnastics classes for kids in Bowie, MD. No experience needed; athletes build balance, coordination, strength, confidence, and safe movement foundations.',
    },
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
    if (pathname === '/beginner-gymnastics') {
      schema.push(faqPageSchema(BEGINNER_GYMNASTICS_FAQS))
      schema.push(sportsActivityLocationSchema(origin))
    }
    if (pathname === '/homeschool-gymnastics') {
      schema.push(faqPageSchema(HOMESCHOOL_GYMNASTICS_FAQS))
      schema.push(sportsActivityLocationSchema(origin))
    }
  }

  return schema
}
