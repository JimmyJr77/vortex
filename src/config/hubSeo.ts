import { buildCanonical, HUB_ORIGIN, type SeoMeta } from '../utils/seo'
import { TEAM_PHONE } from './contact'

export interface HubRouteSeo {
  path: string
  title: string
  description: string
  priority?: number
  ogImage?: string
  ogImageAlt?: string
  robots?: string
}

export const HUB_HOME_SEO: HubRouteSeo = {
  path: '/',
  title: 'Gymnastics & Athletic Development in Bowie, MD | Vortex',
  description:
    'Purposeful gymnastics and Fit & Flip athletic training in Bowie, MD. Build strength, explosiveness, and body control. Book a free trial class.',
  priority: 1.0,
  ogImage: `${HUB_ORIGIN}/vortex-athletics-og.jpg`,
  ogImageAlt: 'Vortex Athletics gymnastics and athletic development in Bowie, Maryland',
}

export const HUB_ROUTES: HubRouteSeo[] = [
  HUB_HOME_SEO,
  {
    path: '/ninja',
    title: 'Kids Ninja Classes in Bowie, MD | Vortex',
    description:
      'Vortex Ninja classes in Bowie, MD are temporarily on hold. Explore current youth athletic training, gymnastics, and Fit & Flip programs.',
    priority: 0.8,
    robots: 'noindex, follow',
  },
  {
    path: '/read-board',
    title: 'Classes, Camps & Events | Vortex Athletics Bowie',
    description:
      'See upcoming classes, camps, open gyms, and events at Vortex Athletics in Bowie, MD. Register your athlete today.',
    priority: 0.8,
  },
  {
    path: '/enroll',
    title: 'Enroll | Vortex Athletics Bowie',
    description:
      'Reserve your spot with Vortex Athletics enrollment in Bowie, MD. Choose your category, day, and time.',
    priority: 0.8,
  },
  {
    path: '/drop-in',
    title: 'Drop-In Youth Classes in Bowie, MD | Vortex',
    description:
      'Book a single gymnastics, fitness, or youth athletic training class in Bowie, MD without monthly enrollment. Browse live drop-in openings.',
    priority: 0.8,
  },
  {
    path: '/contact',
    title: 'Contact Vortex Athletics | Bowie, MD Gym & Training',
    description:
      `Visit Vortex Athletics at 4961 Tesla Dr in Bowie, MD. Call ${TEAM_PHONE} or ask about gymnastics, youth training, trials, and enrollment.`,
    priority: 0.7,
  },
  {
    path: '/support',
    title: 'Customer Support | Vortex Athletics',
    description:
      `Contact Vortex Athletics in Bowie, MD for enrollment, billing, and program support. Email team@vortexathletics.com or call ${TEAM_PHONE}.`,
    priority: 0.5,
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | Vortex Athletics',
    description:
      'How Vortex Athletics collects, uses, discloses, and protects personal information for enrollment, billing, and member services.',
    priority: 0.3,
  },
  {
    path: '/terms-of-service',
    title: 'Terms of Service | Vortex Athletics',
    description:
      'Terms governing use of Vortex Athletics websites, enrollment, billing, and program participation in Bowie, MD.',
    priority: 0.3,
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

export const HUB_SITEMAP_PATHS = HUB_ROUTES.map((route) => route.path)
