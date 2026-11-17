import publicArticles from '../config/publicArticles.json'

const paths = new Set([
  '/', '/404', '/contact', '/enroll', '/drop-in', '/read-board', '/store', '/ninja',
  '/support', '/privacy-policy', '/terms-of-service', '/camp_interest',
  ...Object.values(publicArticles).map(({ path }) => path),
  '/camp_interest/thank-you', '/signup/family', '/signup/lead', '/signup/invite',
  '/verify-email', '/registration/receipt', '/waivers-memberships', '/copy',
  '/gymnastics', '/adult-gymnastics', '/fit-and-flip', '/vortex-athletics', '/summer-athletic-training',
  '/artistic-gymnastics', '/artistic-gymnastics-early', '/artistic-gymnastics-6-12',
  '/artistic-gymnastics-13-18', '/beginner-gymnastics', '/homeschool-gymnastics',
  '/summer-camp-26', '/acro-gymnastics', '/rhythmic-gymnastics', '/trampoline-tumbling',
  '/aerobic-gymnastics',
])

// Keep only known route names. Do not send arbitrary slugs, queries, hashes, or tokens.
export function publicAnalyticsPath(path: string): string {
  const normalized = path.split(/[?#]/, 1)[0].toLowerCase().replace(/\/+$/, '') || '/'
  return paths.has(normalized) ? normalized : '/404'
}

export function analyticsReferrer(): string | undefined {
  try {
    const url = new URL(document.referrer)
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === window.location.origin) return
    return url.origin
  } catch {
    return undefined
  }
}
