import { buildCanonical, HUB_ORIGIN, type SeoMeta } from '../utils/seo'
import { BUSINESS_FACILITY_PHOTO, BUSINESS_NAP, TEAM_EMAIL, TEAM_PHONE } from './contact'
import guideIndex from './publicGuideIndex.json'
import { PUBLIC_GUIDES } from './publicGuides'
import { PUBLIC_PROGRAMS } from './publicPrograms'
import trainingVideo from './publicTrainingVideo.json'

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
      'See class times and pricing for youth gymnastics, Fit & Flip, and adult gymnastics in Bowie, MD. Find your program and enroll through Vortex.',
  },
  {
    path: '/drop-in',
    title: 'Drop-In Gymnastics & Fitness Classes in Bowie, MD | Vortex',
    description:
      'Book a single youth gymnastics, Fit & Flip, or adult gymnastics class in Bowie, MD. Check drop-in dates and prices for your program.',
  },
  {
    path: '/contact',
    title: 'Contact Vortex Athletics | Bowie, MD Gym & Training',
    description:
      `Get directions to Vortex Athletics at ${BUSINESS_NAP.streetAddress} in Bowie, MD. See gym photos, check hours, and ask about your first class.`,
    ogImage: `${HUB_ORIGIN}${BUSINESS_FACILITY_PHOTO.src}`,
    ogImageAlt: BUSINESS_FACILITY_PHOTO.alt,
  },
  { path: guideIndex.path, title: guideIndex.title, description: guideIndex.description },
  {
    path: trainingVideo.path,
    title: trainingVideo.title,
    description: trainingVideo.description,
    ogImage: new URL(trainingVideo.thumbnail, HUB_ORIGIN).href,
    ogImageAlt: trainingVideo.thumbnailAlt,
  },
  ...PUBLIC_GUIDES.map(({ path, title, description, image, imageAlt }) => ({
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
