/** Shared SEO data for build scripts (keep in sync with src/config/*.ts). */

export const HUB_ORIGIN = 'https://www.vortexathletics.com'

export const HUB_SITEMAP_ENTRIES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/ninja', priority: '0.8', changefreq: 'weekly' },
  { path: '/strength-conditioning', priority: '0.8', changefreq: 'weekly' },
  { path: '/athleticism-accelerator', priority: '0.8', changefreq: 'weekly' },
  { path: '/value', priority: '0.7', changefreq: 'monthly' },
  { path: '/read-board', priority: '0.8', changefreq: 'daily' },
]

export const HUB_PRERENDER_PATHS = HUB_SITEMAP_ENTRIES.map((entry) => entry.path)

export const DEFAULT_OG_IMAGE = `${HUB_ORIGIN}/vortex_logo_1.png`
export const SITE_NAME = 'Vortex Athletics'

export const GYMNASTICS_ORIGIN = 'https://vortex-gymnastics.com'

/** Full gymnastics site routes (vortex-gymnastics.com) */
export const GYMNASTICS_SITEMAP_ENTRIES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/gymnastics', priority: '0.9', changefreq: 'weekly' },
  { path: '/artistic-gymnastics-early', priority: '0.8', changefreq: 'monthly' },
  { path: '/artistic-gymnastics-6-12', priority: '0.8', changefreq: 'monthly' },
  { path: '/artistic-gymnastics-13-18', priority: '0.8', changefreq: 'monthly' },
  { path: '/campaigns/artistic-gymnastics-early', priority: '0.7', changefreq: 'monthly' },
  { path: '/campaigns/artistic-gymnastics-6-12', priority: '0.7', changefreq: 'monthly' },
  { path: '/campaigns/artistic-gymnastics-13-18', priority: '0.7', changefreq: 'monthly' },
  { path: '/read-board', priority: '0.8', changefreq: 'daily' },
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
