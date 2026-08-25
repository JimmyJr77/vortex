import { buildCanonical, HUB_ORIGIN, type SeoMeta } from '../utils/seo'

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
  title: 'Youth Sports & Athletic Training in Bowie, MD | Vortex',
  description:
    'Youth sports performance and athletic training for kids and teens in Bowie, MD. Build speed, agility, strength, conditioning, and body control.',
  priority: 1.0,
  ogImage: `${HUB_ORIGIN}/vortex-athletics-og.jpg`,
  ogImageAlt: 'Vortex Athletics youth sports performance training in Bowie, Maryland',
}

export const HUB_ROUTES: HubRouteSeo[] = [
  HUB_HOME_SEO,
  {
    path: '/vortex-athletics',
    title: 'Youth Sports Performance Training in Bowie, MD | Vortex',
    description:
      'Youth sports performance training in Bowie, MD. Build speed, agility, strength, explosiveness, conditioning, coordination, and body control.',
    priority: 0.9,
    ogImage: `${HUB_ORIGIN}/vortex-athletics-og.jpg`,
    ogImageAlt: 'Vortex Athletics youth sports performance training in Bowie, Maryland',
  },
  {
    path: '/ninja',
    title: 'Kids Ninja Classes in Bowie, MD | Vortex',
    description:
      'Vortex Ninja classes in Bowie, MD are temporarily on hold. Explore current youth athletic training, gymnastics, and Fit & Flip programs.',
    priority: 0.8,
    robots: 'noindex, follow',
  },
  {
    path: '/fit-and-flip',
    title: 'Youth Strength, Conditioning & Tumbling | Bowie, MD',
    description:
      'Fit & Flip youth athletic training in Bowie combines strength, conditioning, speed, tumbling, coordination, and body control. Find a class.',
    priority: 0.8,
  },
  {
    path: '/summer-athletic-training',
    title: 'Middle & High School Summer Athletic Training | Vortex Athletics',
    description:
      'Summer athletic training for middle and high school athletes in Bowie, MD. Build speed, strength, agility, mobility, conditioning, and confidence.',
    priority: 0.9,
  },
  {
    path: '/value',
    title: 'Why Vortex Athletics | Development-First Coaching',
    description:
      'See what makes Vortex different: development-first training, expert coaches, and modern technology for athletes in Bowie, MD.',
    priority: 0.7,
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
      'Visit Vortex Athletics at 4961 Tesla Dr in Bowie, MD. Call (443) 422-4794 or ask about gymnastics, youth training, trials, and enrollment.',
    priority: 0.7,
  },
  {
    path: '/support',
    title: 'Customer Support | Vortex Athletics',
    description:
      'Contact Vortex Athletics in Bowie, MD for enrollment, billing, and program support. Email team@vortexathletics.com or call (443) 422-4794.',
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
