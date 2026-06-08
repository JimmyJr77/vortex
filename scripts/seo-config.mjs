/** Shared SEO data for build scripts (keep in sync with src/config/*.ts). */

export const HUB_ORIGIN = 'https://www.vortexathletics.com'

export const HUB_SITEMAP_ENTRIES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/ninja', priority: '0.8', changefreq: 'weekly' },
  { path: '/strength-conditioning', priority: '0.8', changefreq: 'weekly' },
  { path: '/athleticism-accelerator', priority: '0.8', changefreq: 'weekly' },
  { path: '/value', priority: '0.7', changefreq: 'monthly' },
  { path: '/read-board', priority: '0.8', changefreq: 'daily' },
  { path: '/scheduling', priority: '0.8', changefreq: 'weekly' },
]

export const HUB_PRERENDER_PATHS = HUB_SITEMAP_ENTRIES.map((entry) => entry.path)

export const DEFAULT_OG_IMAGE = `${HUB_ORIGIN}/vortex_logo_1.png`
export const SITE_NAME = 'Vortex Athletics'

export const GYMNASTICS_ORIGIN = 'https://vortex-gymnastics.com'

/**
 * Indexable gymnastics routes (vortex-gymnastics.com) for the sitemap.
 * `/gymnastics` (canonical -> `/`) and `/campaigns/*` (noindex duplicates) are
 * intentionally excluded so only canonical URLs are submitted.
 */
export const GYMNASTICS_SITEMAP_ENTRIES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/artistic-gymnastics-early', priority: '0.8', changefreq: 'monthly' },
  { path: '/artistic-gymnastics-6-12', priority: '0.8', changefreq: 'monthly' },
  { path: '/artistic-gymnastics-13-18', priority: '0.8', changefreq: 'monthly' },
  { path: '/read-board', priority: '0.8', changefreq: 'daily' },
  { path: '/summer-camp-26', priority: '0.9', changefreq: 'weekly' },
  { path: '/acro-gymnastics', priority: '0.8', changefreq: 'monthly' },
  { path: '/artistic-gymnastics', priority: '0.8', changefreq: 'monthly' },
  { path: '/rhythmic-gymnastics', priority: '0.8', changefreq: 'monthly' },
  { path: '/trampoline-tumbling', priority: '0.8', changefreq: 'monthly' },
  { path: '/aerobic-gymnastics', priority: '0.8', changefreq: 'monthly' },
]

/**
 * Gymnastics routes to prerender for the vortex-gymnastics.com host.
 * Excludes `/` and `/read-board` because those static files collide with the
 * hub build (same dist output served to both domains); the client corrects
 * those on the gymnastics domain. Excludes `/campaigns/*` (canonicalized /
 * noindex duplicates). Rendered via the `?sport=gymnastics` host override.
 */
export const GYMNASTICS_PRERENDER_PATHS = [
  '/gymnastics',
  '/artistic-gymnastics-early',
  '/artistic-gymnastics-6-12',
  '/artistic-gymnastics-13-18',
  '/summer-camp-26',
  '/acro-gymnastics',
  '/artistic-gymnastics',
  '/rhythmic-gymnastics',
  '/trampoline-tumbling',
  '/aerobic-gymnastics',
]

/**
 * Gymnastics routes whose paths collide with the hub build (`/`, `/read-board`).
 * They are prerendered into dedicated `_gym/*` files and served to the
 * vortex-gymnastics.com host via host-based rules in vercel.json. `outFile` is
 * relative to dist/. Titles/descriptions must mirror src/config/gymnasticsSeo.ts.
 */
export const GYMNASTICS_OG_IMAGE = `${GYMNASTICS_ORIGIN}/vortex_gymnastics_logo.png`

export const GYMNASTICS_HOST_PAGES = [
  {
    path: '/',
    outFile: '_gym/index.html',
    title: 'Gymnastics Classes in Bowie, MD | Vortex Gymnastics',
    description:
      'Gymnastics classes for all ages in Bowie, MD - preschool to competitive, taught by expert coaches. Book a free trial class today.',
    canonical: GYMNASTICS_ORIGIN,
    ogImage: GYMNASTICS_OG_IMAGE,
    ogImageAlt: 'Vortex Gymnastics',
  },
  {
    path: '/read-board',
    outFile: '_gym/read-board.html',
    title: 'Gymnastics Classes, Camps & Events | Bowie, MD',
    description:
      'Upcoming gymnastics classes, camps, and open gyms at Vortex Gymnastics in Bowie, MD. Register your athlete today.',
    canonical: `${GYMNASTICS_ORIGIN}/read-board`,
    ogImage: GYMNASTICS_OG_IMAGE,
    ogImageAlt: 'Vortex Gymnastics',
  },
]

/** Coming-soon sport domains only (not vortex-gymnastics.com) */
/** @type {{ host: string, title: string, description: string, canonical: string }[]} */
export const STUB_SEO_ENTRIES = [
  {
    host: 'vortex-lacross.com',
    title: 'Vortex Lacrosse | Coming Soon',
    description:
      'Vortex Lacrosse is coming soon. Development-focused training, top coaches, and resources that help athletes grow when championships matter most.',
    canonical: 'https://vortex-lacross.com/',
  },
  {
    host: 'vortex-conditioning.com',
    title: 'Vortex Conditioning | Coming Soon',
    description:
      'Vortex Conditioning is coming soon. Build fitness and athleticism with level-appropriate programs, expert coaching, and training resources that teach.',
    canonical: 'https://vortex-conditioning.com/',
  },
  {
    host: 'vortex-football.com',
    title: 'Vortex Football | Coming Soon',
    description:
      'Vortex Football is coming soon. Development-first football training with expert coaches, video resources, and facilities built for athletic excellence.',
    canonical: 'https://vortex-football.com/',
  },
  {
    host: 'vortex-basketball.com',
    title: 'Vortex Basketball | Coming Soon',
    description:
      'Vortex Basketball is coming soon. Level-appropriate skill development, elite coaching, and training packages designed for long-term player growth.',
    canonical: 'https://vortex-basketball.com/',
  },
  {
    host: 'vortex-track.com',
    title: 'Vortex Track & Field | Coming Soon',
    description:
      'Vortex Track & Field is coming soon. Development-focused training, expert coaches, and facilities built to help athletes excel when it counts.',
    canonical: 'https://vortex-track.com/',
  },
  {
    host: 'vortex-fit.com',
    title: 'Vortex Fit | Coming Soon',
    description:
      'Vortex Fit is coming soon. Strength, conditioning, and athletic development with expert coaches and resources that support real learning.',
    canonical: 'https://vortex-fit.com/',
  },
  {
    host: 'vortex-athlete.com',
    title: 'Vortex Athlete | Coming Soon',
    description:
      'Vortex Athlete development is coming soon. Complete athlete training with level-appropriate programs, top coaches, and facilities built to excel.',
    canonical: 'https://vortex-athlete.com/',
  },
  {
    host: 'vortex-soccer.com',
    title: 'Vortex Soccer | Coming Soon',
    description:
      'Vortex Soccer is coming soon. Development-first soccer training with expert coaches, video resources, and programs built for lasting growth.',
    canonical: 'https://vortex-soccer.com/',
  },
  {
    host: 'vortex-reps.com',
    title: 'Vortex Reps | Coming Soon',
    description:
      'Vortex Reps is coming soon. Repetition-based skill development with expert coaching, training resources, and facilities built for athleticism.',
    canonical: 'https://vortex-reps.com/',
  },
]
