import { buildCanonical, HUB_ORIGIN, type SeoMeta } from '../utils/seo'

export interface HubRouteSeo {
  path: string
  title: string
  description: string
  priority?: number
}

export const HUB_HOME_SEO: HubRouteSeo = {
  path: '/',
  title: 'Vortex Athletics | Youth Sports & Gymnastics, Bowie MD',
  description:
    'Gymnastics, ninja, and athletic training for kids and adults in Bowie, MD. Expert coaching and a modern facility. Book a free trial class.',
  priority: 1.0,
}

export const HUB_ROUTES: HubRouteSeo[] = [
  HUB_HOME_SEO,
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
    path: '/athleticism-accelerator',
    title: 'Youth Athletic Training in Bowie | Vortex Accelerator',
    description:
      'Sports performance training for young athletes in Bowie, MD. Build speed, power, and coordination across 8 tenets. Book an assessment.',
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
    path: '/scheduling',
    title: 'Enroll | Vortex Athletics Bowie',
    description:
      'Reserve your spot with Vortex Athletics enrollment in Bowie, MD. Choose your category, day, and time.',
    priority: 0.8,
  },
]

const routeMap = new Map(HUB_ROUTES.map((route) => [route.path, route]))

export const getHubSeoForPath = (pathname: string): SeoMeta => {
  const route = routeMap.get(pathname) ?? HUB_HOME_SEO
  return {
    title: route.title,
    description: route.description,
    canonical: buildCanonical(HUB_ORIGIN, route.path),
  }
}

export const HUB_SITEMAP_PATHS = HUB_ROUTES.map((route) => route.path)
