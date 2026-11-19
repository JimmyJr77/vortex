import {
  BUSINESS_FACILITY_PHOTO,
  BUSINESS_GEO,
  BUSINESS_HOURS,
  BUSINESS_NAP,
  GOOGLE_MAPS_URL,
  NEXTDOOR_LOCATION_URL,
  SOCIAL_PROFILES,
  TEAM_EMAIL,
  YELP_LOCATION_URL,
} from '../config/contact'
import { HOME_FAQS, type Faq } from '../config/faqs'
import { getHubSeoForPath } from '../config/hubSeo'
import { PUBLIC_GUIDES } from '../config/publicGuides'
import guideIndex from '../config/publicGuideIndex.json'
import searchPhotos from '../config/publicSearchPhotos.json'
import trainingVideo from '../config/publicTrainingVideo.json'
import { GYMNASTICS_FAQS } from '../config/gymnasticsFaqs'
import { BEGINNER_GYMNASTICS_FAQS } from '../config/beginnerGymnasticsFaqs'
import { DROP_IN_FAQS, HOMESCHOOL_GYMNASTICS_FAQS } from '../config/localSeoFaqs'
import { SUMMER_CAMP_FAQS } from '../config/summerCampFaqs'
import { YOUTH_TRAINING_FAQS } from '../config/youthTrainingFaqs'
import { GYMNASTICS_ORIGIN } from '../config/gymnasticsSeo'
import { ENROLL_PATH } from '../config/enrollSites'
import { PUBLIC_PROGRAMS } from '../config/publicPrograms'
import { NINJA_PROGRAM_ON_HOLD } from './ninjaProgram'
import { buildCanonical, HUB_ORIGIN, SITE_NAME } from './seo'

/** Any JSON-LD object (loosely typed; serialized into a <script> tag). */
export type JsonLd = Record<string, unknown>

/** Root URL for an origin, matching the canonical/sitemap form (no trailing slash). */
const rootUrl = (origin: string) => buildCanonical(origin, '/')

const locationId = `${HUB_ORIGIN}/#location`
const locationUrl = buildCanonical(HUB_ORIGIN, '/contact')
const localAreaServed = `${BUSINESS_NAP.addressLocality}, ${BUSINESS_NAP.addressRegion}`

const DROP_IN_SERVICE = {
  path: '/drop-in',
  name: 'Drop-In Gymnastics and Fitness Classes',
  serviceType: 'Single-session youth gymnastics, youth fitness, and adult gymnastics',
  description:
    'Book one available youth gymnastics, Fit & Flip youth fitness, or Typhoons adult gymnastics class in Bowie, MD.',
} as const

const postalAddress = () => ({
  '@type': 'PostalAddress',
  streetAddress: BUSINESS_NAP.streetAddress,
  addressLocality: BUSINESS_NAP.addressLocality,
  addressRegion: BUSINESS_NAP.addressRegion,
  postalCode: BUSINESS_NAP.postalCode,
  addressCountry: BUSINESS_NAP.addressCountry,
})

export const webSiteSchema = (origin: string): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${origin}/#website`,
  url: rootUrl(origin),
  name: SITE_NAME,
  publisher: { '@id': locationId },
})

type ServiceDetails = { name: string; serviceType?: string; url: string }

const serviceIdentity = ({ name, serviceType, url }: ServiceDetails) => ({
  '@type': 'Service',
  '@id': `${url}#service`,
  name,
  serviceType: serviceType ?? name,
  url,
  provider: { '@id': locationId },
})

const localServiceCatalog = () => ({
  '@type': 'OfferCatalog',
  name: 'Athletics and gymnastics programs',
  itemListElement: [...Object.values(PUBLIC_PROGRAMS), DROP_IN_SERVICE].map(({ name, path, serviceType }) => ({
    '@type': 'Offer',
    itemOffered: serviceIdentity({ name, serviceType, url: buildCanonical(HUB_ORIGIN, path) }),
  })),
})

/** One stable local entity for the unified site, matching the Google profile. */
const sportsActivityLocationSchema = ({ includeCatalog = false, includeHours = false } = {}): JsonLd => ({
  '@context': 'https://schema.org',
  '@type': 'SportsActivityLocation',
  '@id': locationId,
  name: BUSINESS_NAP.name,
  legalName: 'Vortex Athletics, LLC',
  alternateName: [SITE_NAME, 'Vortex Gymnastics'],
  url: locationUrl,
  mainEntityOfPage: locationUrl,
  logo: `${HUB_ORIGIN}/red_vortex.png`,
  description:
    'Youth and adult gymnastics plus Fit & Flip athletic development at Vortex Athletics and Gymnastics in Bowie, Maryland.',
  image: `${HUB_ORIGIN}${BUSINESS_FACILITY_PHOTO.src}`,
  telephone: BUSINESS_NAP.phone,
  email: TEAM_EMAIL,
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: BUSINESS_NAP.phone,
    email: TEAM_EMAIL,
    contactType: 'customer service',
    areaServed: 'US-MD',
    availableLanguage: 'English',
  },
  address: postalAddress(),
  geo: {
    '@type': 'GeoCoordinates',
    latitude: BUSINESS_GEO.latitude,
    longitude: BUSINESS_GEO.longitude,
  },
  hasMap: GOOGLE_MAPS_URL,
  ...(includeHours ? {
    openingHoursSpecification: BUSINESS_HOURS.map((slot) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: slot.days.map((day) => `https://schema.org/${day}`),
      opens: slot.opens,
      closes: slot.closes,
    })),
  } : {}),
  areaServed: localAreaServed,
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
  ...(includeCatalog ? { hasOfferCatalog: localServiceCatalog() } : {}),
  sameAs: [...SOCIAL_PROFILES, GOOGLE_MAPS_URL, NEXTDOOR_LOCATION_URL, YELP_LOCATION_URL],
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
    '@id': locationId,
    name: BUSINESS_NAP.name,
    url: locationUrl,
  },
})

const serviceSchema = (params: ServiceDetails & { description: string }): JsonLd => ({
  '@context': 'https://schema.org',
  ...serviceIdentity(params),
  description: params.description,
  areaServed: localAreaServed,
  availableChannel: {
    '@type': 'ServiceChannel',
    serviceLocation: { '@id': locationId },
  },
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
    '@id': locationId,
    name: BUSINESS_NAP.name,
    address: postalAddress(),
  },
  organizer: {
    '@type': 'SportsActivityLocation',
    '@id': locationId,
    name: BUSINESS_NAP.name,
    url: locationUrl,
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
  const program = Object.values(PUBLIC_PROGRAMS).find(({ path }) => path === pathname)
  const includeHours = Boolean(program) || ['/', '/contact', '/support'].includes(pathname)
  const schema: JsonLd[] = [
    sportsActivityLocationSchema({ includeCatalog: pathname === '/', includeHours }),
    webSiteSchema(HUB_ORIGIN),
  ]

  if (pathname === '/') {
    schema.push(
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${HUB_ORIGIN}/#webpage`,
        url: rootUrl(HUB_ORIGIN),
        about: { '@id': locationId },
        primaryImageOfPage: `${HUB_ORIGIN}${searchPhotos.homepageGallery.strengthTraining.src}`,
      },
      faqPageSchema(HOME_FAQS),
    )
    return schema
  }

  const url = buildCanonical(HUB_ORIGIN, pathname)
  if (pathname === trainingVideo.path) {
    const pageId = `${url}#webpage`
    const videoId = `${url}#video`
    const thumbnail = new URL(trainingVideo.thumbnail, HUB_ORIGIN).href
    return [
      ...schema,
      breadcrumbSchema([crumb(HUB_ORIGIN, 'Home', '/'), crumb(HUB_ORIGIN, trainingVideo.name, pathname)]),
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': pageId,
        url,
        name: trainingVideo.name,
        description: trainingVideo.description,
        isPartOf: { '@id': `${HUB_ORIGIN}/#website` },
        about: { '@id': locationId },
        inLanguage: 'en-US',
        primaryImageOfPage: thumbnail,
        mainEntity: { '@id': videoId },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        '@id': videoId,
        mainEntityOfPage: { '@id': pageId },
        name: trainingVideo.name,
        description: trainingVideo.description,
        thumbnailUrl: [thumbnail],
        uploadDate: trainingVideo.uploadDate,
        duration: `PT${trainingVideo.durationSeconds}S`,
        contentUrl: new URL(trainingVideo.assetPath, HUB_ORIGIN).href,
        publisher: { '@id': locationId },
      },
    ]
  }

  if (program) {
    return [
      ...schema,
      breadcrumbSchema([crumb(HUB_ORIGIN, 'Home', '/'), crumb(HUB_ORIGIN, program.name, pathname)]),
      serviceSchema({ ...program, url }),
      faqPageSchema(program.faqs),
    ]
  }

  const breadcrumbName: Record<string, string> = {
    '/ninja': NINJA_PROGRAM_ON_HOLD ? 'Ninja Program Status' : 'Kids Ninja Classes',
    '/vortex-athletics': 'Vortex Athletics',
    '/summer-athletic-training': 'Summer Athletic Training',
    '/value': 'Why Vortex',
    '/read-board': 'Classes & Events',
    '/enroll': 'Classes & Enrollment',
    '/drop-in': 'Drop-In Classes',
    '/contact': 'Contact & Location',
    '/support': 'Customer Support',
    '/store': 'Vortex Athletics Store',
    '/privacy-policy': 'Privacy Policy',
    '/terms-of-service': 'Terms of Service',
    [guideIndex.path]: guideIndex.label,
  }
  const guide = PUBLIC_GUIDES.find(({ path }) => path === pathname)
  const name = breadcrumbName[pathname] ?? guide?.breadcrumbLabel
  if (name) {
    schema.push(
      breadcrumbSchema([
        crumb(HUB_ORIGIN, 'Home', '/'),
        ...(guide ? [crumb(HUB_ORIGIN, guideIndex.label, guideIndex.path)] : []),
        crumb(HUB_ORIGIN, name, pathname),
      ]),
    )
  }

  if (pathname === '/contact') {
    schema.push({
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      '@id': url,
      url,
      name: 'Contact Vortex Athletics in Bowie, MD',
      isPartOf: { '@id': `${HUB_ORIGIN}/#website` },
      mainEntity: { '@id': locationId },
      primaryImageOfPage: `${HUB_ORIGIN}${BUSINESS_FACILITY_PHOTO.src}`,
      inLanguage: 'en-US',
    })
  }

  if (pathname === guideIndex.path) {
    schema.push({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: guideIndex.heading,
      description: guideIndex.description,
      url,
      inLanguage: 'en-US',
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: PUBLIC_GUIDES.length,
        itemListElement: PUBLIC_GUIDES.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.heading,
          url: buildCanonical(HUB_ORIGIN, item.path),
        })),
      },
    })
  }
  if (pathname === '/ninja' && !NINJA_PROGRAM_ON_HOLD) {
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
  if (pathname === '/drop-in') {
    schema.push(faqPageSchema(DROP_IN_FAQS))
    schema.push(serviceSchema({ ...DROP_IN_SERVICE, url }))
  }
  if (guide) {
    schema.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      mainEntityOfPage: url,
      headline: guide.heading,
      description: guide.description,
      image: getHubSeoForPath(pathname).ogImage ?? `${HUB_ORIGIN}${guide.image}`,
      datePublished: guide.datePublished,
      dateModified: guide.dateModified,
      author: { '@id': locationId },
      publisher: { '@id': locationId },
      inLanguage: 'en-US',
    })
  }

  return schema
}

/** JSON-LD for a given gymnastics (vortex-gymnastics.com) route. */
export const getGymnasticsSchema = (pathname: string): JsonLd[] => {
  const origin = GYMNASTICS_ORIGIN
  const schema: JsonLd[] = [sportsActivityLocationSchema(), webSiteSchema(origin)]

  if (pathname === '/' || pathname === '/gymnastics') {
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
    }
    if (pathname === '/homeschool-gymnastics') {
      schema.push(faqPageSchema(HOMESCHOOL_GYMNASTICS_FAQS))
    }
  }

  return schema
}
