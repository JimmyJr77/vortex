/** Shared SEO data for build scripts (keep in sync with src/config/*.ts). */
import { readFileSync } from 'node:fs'

const publicArticles = JSON.parse(readFileSync(new URL('../src/config/publicArticles.json', import.meta.url), 'utf8'))
const guideIndex = JSON.parse(readFileSync(new URL('../src/config/publicGuideIndex.json', import.meta.url), 'utf8'))

export const YOUTH_ATHLETIC_GUIDE_PATH = publicArticles.athleticDevelopment.path
export const BOWIE_YOUTH_SPORTS_GUIDE_PATH = publicArticles.bowieYouthSports.path
export const PRESCHOOL_GYMNASTICS_GUIDE_PATH = publicArticles.preschoolGymnastics.path
export const GYMNASTICS_VS_TUMBLING_GUIDE_PATH = publicArticles.gymnasticsVsTumbling.path
export const RETURNING_TO_GYMNASTICS_GUIDE_PATH = publicArticles.returningToGymnastics.path
export const HUB_ARTICLE_PATHS = Object.values(publicArticles).map(({ path }) => path)
export const HUB_GUIDE_INDEX_PATH = guideIndex.path

/** Canonical hub origin. Production redirects the www host to this apex host. */
export const HUB_ORIGIN = 'https://vortexathletics.com'

export function getIndexNowVerificationKey() {
  const key = process.env.INDEXNOW_KEY?.trim()
  if (key && !/^[a-z0-9-]{8,128}$/i.test(key)) {
    throw new Error('Invalid IndexNow verification key')
  }
  return key || undefined
}

const HUB_PROGRAM_ENTRIES = [
  { path: '/gymnastics', lastmod: '2026-11-17' },
  { path: '/fit-and-flip', lastmod: '2026-11-17' },
  { path: '/adult-gymnastics', lastmod: '2026-11-17' },
]
export const HUB_PROGRAM_PATHS = HUB_PROGRAM_ENTRIES.map(({ path }) => path)

// Use the date of the last known substantive update to each page's content or
// metadata. Omit lastmod when that date cannot be confirmed.
export const HUB_SITEMAP_ENTRIES = [
  { path: '/', priority: '1.0', changefreq: 'weekly', lastmod: '2026-11-17' },
  ...HUB_PROGRAM_ENTRIES.map((entry) => ({ ...entry, priority: '0.8', changefreq: 'monthly' })),
  { path: '/read-board', priority: '0.8', changefreq: 'daily', lastmod: '2026-11-17' },
  { path: '/enroll', priority: '0.8', changefreq: 'weekly', lastmod: '2026-11-16' },
  { path: '/drop-in', priority: '0.8', changefreq: 'daily', lastmod: '2026-11-17' },
  { path: '/contact', priority: '0.7', changefreq: 'monthly', lastmod: '2026-11-17' },
  { path: '/support', priority: '0.5', changefreq: 'monthly' },
  { path: '/store', priority: '0.5', changefreq: 'weekly' },
  { path: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms-of-service', priority: '0.3', changefreq: 'yearly' },
  { path: HUB_GUIDE_INDEX_PATH, priority: '0.6', changefreq: 'monthly', lastmod: guideIndex.dateModified },
  ...Object.values(publicArticles).map(({ path, dateModified }) => ({
    path, priority: '0.6', changefreq: 'monthly', lastmod: dateModified,
  })),
]

export const HUB_NOINDEX_PRERENDER_PATHS = ['/ninja']

// Published by the previous build as <path>/index.html. The current public
// landing redirects supply their canonical destinations.
export const RETIRED_LANDING_SNAPSHOT_PATHS = [
  '/vortex-athletics', '/summer-athletic-training', '/value',
  '/beginner-gymnastics', '/homeschool-gymnastics', '/artistic-gymnastics-early',
  '/artistic-gymnastics-6-12', '/artistic-gymnastics-13-18', '/summer-camp-26',
  '/acro-gymnastics', '/artistic-gymnastics', '/rhythmic-gymnastics',
  '/trampoline-tumbling', '/aerobic-gymnastics',
]

export const RETIRED_GYMNASTICS_HOST_SNAPSHOT_REDIRECTS = {
  '/_gym/index.html': '/',
  '/_gym/read-board.html': '/read-board',
  '/_gym/drop-in.html': '/drop-in',
}

export const SPA_SHELL_PATH = '/_seo/spa.html'
export const SPA_ONLY_PATHS = [
  '/employee/payroll',
  '/employee/payroll/preparer',
  '/copy',
  '/signup/family',
  '/signup/invite',
  '/signup/lead',
  '/verify-email',
  '/registration/receipt',
  '/waivers-memberships',
  '/camp_interest',
  '/camp_interest/thank-you',
]

export const HUB_PRERENDER_PATHS = [
  ...HUB_SITEMAP_ENTRIES.map((entry) => entry.path),
  // Directly reachable but intentionally excluded from search while on hold.
  ...HUB_NOINDEX_PRERENDER_PATHS,
]

export const DEFAULT_OG_IMAGE = `${HUB_ORIGIN}/vortex-athletics-og.jpg`
export const SITE_NAME = 'Vortex Athletics'

/** Retired domain retained only to verify redirects to the unified website. */
export const GYMNASTICS_ORIGIN = 'https://www.vortex-gymnastics.com'

/** Coming-soon sport domains only (not vortex-gymnastics.com) */
/** @type {{ host: string, title: string, description: string, canonical: string, robots: string }[]} */
export const STUB_SEO_ENTRIES = [
  {
    host: 'vortex-lacross.com',
    title: 'Vortex Lacrosse | Coming Soon',
    description:
      'Vortex Lacrosse is coming soon. Development-focused training, top coaches, and resources that help athletes grow when championships matter most.',
    canonical: 'https://vortex-lacross.com/',
    robots: 'noindex, follow',
  },
  {
    host: 'vortex-conditioning.com',
    title: 'Vortex Conditioning | Coming Soon',
    description:
      'Vortex Conditioning is coming soon. Build fitness and athleticism with level-appropriate programs, expert coaching, and training resources that teach.',
    canonical: 'https://vortex-conditioning.com/',
    robots: 'noindex, follow',
  },
  {
    host: 'vortex-football.com',
    title: 'Vortex Football | Coming Soon',
    description:
      'Vortex Football is coming soon. Development-first football training with expert coaches, video resources, and facilities built for athletic excellence.',
    canonical: 'https://vortex-football.com/',
    robots: 'noindex, follow',
  },
  {
    host: 'vortex-basketball.com',
    title: 'Vortex Basketball | Coming Soon',
    description:
      'Vortex Basketball is coming soon. Level-appropriate skill development, elite coaching, and training packages designed for long-term player growth.',
    canonical: 'https://vortex-basketball.com/',
    robots: 'noindex, follow',
  },
  {
    host: 'vortex-track.com',
    title: 'Vortex Track & Field | Coming Soon',
    description:
      'Vortex Track & Field is coming soon. Development-focused training, expert coaches, and facilities built to help athletes excel when it counts.',
    canonical: 'https://vortex-track.com/',
    robots: 'noindex, follow',
  },
  {
    host: 'vortex-fit.com',
    title: 'Vortex Fit | Coming Soon',
    description:
      'Vortex Fit is coming soon. Strength, conditioning, and athletic development with expert coaches and resources that support real learning.',
    canonical: 'https://vortex-fit.com/',
    robots: 'noindex, follow',
  },
  {
    host: 'vortex-athlete.com',
    title: 'Vortex Athlete | Coming Soon',
    description:
      'Vortex Athlete development is coming soon. Complete athlete training with level-appropriate programs, top coaches, and facilities built to excel.',
    canonical: 'https://vortex-athlete.com/',
    robots: 'noindex, follow',
  },
  {
    host: 'vortex-soccer.com',
    title: 'Vortex Soccer | Coming Soon',
    description:
      'Vortex Soccer is coming soon. Development-first soccer training with expert coaches, video resources, and programs built for lasting growth.',
    canonical: 'https://vortex-soccer.com/',
    robots: 'noindex, follow',
  },
  {
    host: 'vortex-reps.com',
    title: 'Vortex Reps | Coming Soon',
    description:
      'Vortex Reps is coming soon. Repetition-based skill development with expert coaching, training resources, and facilities built for athleticism.',
    canonical: 'https://vortex-reps.com/',
    robots: 'noindex, follow',
  },
]
