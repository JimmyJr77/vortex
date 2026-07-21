import { buildCanonical, HUB_ORIGIN, type SeoMeta } from '../utils/seo'

export interface HubRouteSeo {
  path: string
  title: string
  description: string
  priority?: number
  ogImage?: string
  ogImageAlt?: string
}

export const HUB_HOME_SEO: HubRouteSeo = {
  path: '/',
  title: 'Youth Sports Training in Bowie, MD | Vortex Athletics',
  description:
    'Explore youth sports training in Bowie, MD, including sports conditioning, speed and agility, strength, Fit & Flip, and gymnastics programs.',
  priority: 1.0,
  ogImage: `${HUB_ORIGIN}/multisport.jpeg`,
  ogImageAlt: 'Young athletes training at Vortex Athletics in Bowie, Maryland',
}

export const HUB_ROUTES: HubRouteSeo[] = [
  HUB_HOME_SEO,
  {
    path: '/vortex-athletics',
    title: 'Youth Sports Performance Training in Bowie, MD | Vortex',
    description:
      'Youth sports performance training in Bowie, MD. Build speed, agility, strength, explosiveness, conditioning, coordination, and body control.',
    priority: 0.9,
    ogImage: `${HUB_ORIGIN}/speed.jpeg`,
    ogImageAlt: 'Athlete completing speed training at Vortex Athletics in Bowie, Maryland',
  },
  {
    path: '/ninja',
    title: 'Kids Ninja Classes in Bowie, MD | Vortex',
    description:
      'Ninja obstacle classes for kids in Bowie, MD. Build strength, agility, and confidence on warped walls and courses. Book a free trial.',
    priority: 0.8,
  },
  {
    path: '/strength-conditioning',
    title: 'Fit & Flip | Adult Fitness & Acrobatics, Bowie MD',
    description:
      'Adult fitness, conditioning, and acrobatics in Bowie, MD. Functional strength and mobility for all levels. Try a class today.',
    priority: 0.8,
  },
  {
    path: '/summer-athletic-training',
    title: 'Middle & High School Summer Athletic Training | Vortex Athletics',
    description:
      "Join Vortex Athletics' Athleticism Accelerator summer training program for middle and high school athletes. Build speed, strength, agility, mobility, conditioning, and confidence. Free sessions available for students from select schools.",
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
  }
}

export const HUB_SITEMAP_PATHS = HUB_ROUTES.map((route) => route.path)
