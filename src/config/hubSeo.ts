import { buildCanonical, HUB_ORIGIN, type SeoMeta } from '../utils/seo'
import { ATHLETIC_DEVELOPMENT_GUIDE } from './athleticDevelopmentGuide'
import { BOWIE_YOUTH_SPORTS_GUIDE } from './bowieYouthSportsGuide'
import { BUSINESS_NAP, TEAM_EMAIL, TEAM_PHONE } from './contact'
import { PUBLIC_PROGRAMS } from './publicPrograms'

export interface HubRouteSeo {
  path: string
  title: string
  description: string
  ogImage?: string
  ogImageAlt?: string
  robots?: string
}

export const HUB_HOME_SEO: HubRouteSeo = {
  path: '/',
  title: 'Gymnastics & Youth Athletic Training in Bowie, MD | Vortex',
  description:
    'Find youth gymnastics, Fit & Flip athletic development, and adult gymnastics at Vortex in Bowie, MD. Compare programs and find your first class.',
  ogImage: `${HUB_ORIGIN}/vortex-athletics-og.jpg`,
  ogImageAlt: 'Vortex Athletics gymnastics and athletic development in Bowie, Maryland',
}

export const HUB_ROUTES: HubRouteSeo[] = [
  HUB_HOME_SEO,
  ...Object.values(PUBLIC_PROGRAMS).map(({ path, title, description, image, imageAlt }) => ({
    path, title, description,
    ...(image ? { ogImage: new URL(image, HUB_ORIGIN).href, ogImageAlt: imageAlt } : {}),
  })),
  {
    path: '/ninja',
    title: 'Kids Ninja Classes in Bowie, MD | Vortex',
    description:
      'Vortex Ninja classes in Bowie, MD are temporarily on hold. Explore current youth athletic training, gymnastics, and Fit & Flip programs.',
    robots: 'noindex, follow',
  },
  {
    path: '/read-board',
    title: 'Class Schedules, Camps & Events in Bowie, MD | Vortex',
    description:
      'Explore gymnastics and Fit & Flip classes, training schedules, camps, and events at Vortex Athletics in Bowie, MD.',
  },
  {
    path: '/enroll',
    title: 'Enroll in Gymnastics & Fit & Flip in Bowie, MD | Vortex',
    description:
      'Browse gymnastics and Fit & Flip classes in Bowie, MD. Choose a program, review class times and pricing, and enroll with your family account.',
  },
  {
    path: '/drop-in',
    title: 'Drop-In Youth Classes in Bowie, MD | Vortex',
    description:
      'Book a single gymnastics, fitness, or youth athletic training class in Bowie, MD without monthly enrollment. Browse live drop-in openings.',
  },
  {
    path: '/contact',
    title: 'Contact Vortex Athletics | Bowie, MD Gym & Training',
    description:
      `Visit Vortex Athletics at ${BUSINESS_NAP.streetAddress} in Bowie, MD. Call ${TEAM_PHONE} to ask about gymnastics, Fit & Flip, free trials, and enrollment.`,
  },
  ...[ATHLETIC_DEVELOPMENT_GUIDE, BOWIE_YOUTH_SPORTS_GUIDE].map(({ path, title, description, image, imageAlt }) => ({
    path, title, description, ogImage: `${HUB_ORIGIN}${image}`, ogImageAlt: imageAlt,
  })),
  {
    path: '/support',
    title: 'Customer Support | Vortex Athletics',
    description:
      `Contact Vortex Athletics in Bowie, MD for enrollment, billing, and program support. Email ${TEAM_EMAIL} or call ${TEAM_PHONE}.`,
  },
  {
    path: '/store',
    title: 'Vortex Athletics Store | Training Gear in Bowie, MD',
    description:
      'Shop training gear and essentials for Vortex athletes. Order online and pick up at Vortex Athletics and Gymnastics in Bowie, MD.',
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | Vortex Athletics',
    description:
      'How Vortex Athletics collects, uses, discloses, and protects personal information for enrollment, billing, and member services.',
  },
  {
    path: '/terms-of-service',
    title: 'Terms of Service | Vortex Athletics',
    description:
      'Terms governing use of Vortex Athletics websites, enrollment, billing, and program participation in Bowie, MD.',
  },
]

const routeMap = new Map(HUB_ROUTES.map((route) => [route.path, route]))

export const getHubSeoForPath = (pathname: string): SeoMeta => {
  const route = routeMap.get(pathname)
  if (!route) {
    return {
      title: `Vortex Athletics | Bowie, MD`,
      description: HUB_HOME_SEO.description,
      canonical: buildCanonical(HUB_ORIGIN, pathname),
      robots: 'noindex, follow',
    }
  }
  return {
    title: route.title,
    description: route.description,
    canonical: buildCanonical(HUB_ORIGIN, route.path),
    ogImage: route.ogImage,
    ogImageAlt: route.ogImageAlt,
    robots: route.robots,
  }
}
