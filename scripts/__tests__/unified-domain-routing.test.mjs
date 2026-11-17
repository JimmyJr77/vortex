import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
const landingRedirects = JSON.parse(readFileSync(new URL('../../src/config/publicLandingRedirects.json', import.meta.url), 'utf8'))
const primary = 'https://vortexathletics.com'
const aliases = ['www.vortexathletics.com', 'vortex-gymnastics.com', 'www.vortex-gymnastics.com']

// Resolve the source/host subset used by this configuration, preserving incoming
// query parameters as Vercel's source-controlled redirects do. These tests check
// routing intent and ordering; live response verification is a release check.
function nextLocation(input) {
  const url = new URL(input)
  const path = url.pathname
  if (config.trailingSlash === false && path !== '/' && path.endsWith('/')) {
    url.pathname = path.slice(0, -1)
    return url.href
  }
  const rule = config.redirects.find(candidate => {
    if (candidate.source !== '/:path*' && candidate.source !== path) return false
    return (candidate.has ?? []).every(condition => {
      assert.equal(condition.type, 'host', 'This routing test must model any new condition type explicitly')
      return new RegExp(`^(?:${condition.value})$`, 'i').test(url.hostname)
    })
  })
  if (!rule) return null
  assert.equal(rule.permanent, true)
  const target = new URL(rule.destination.replace(':path*', url.pathname.slice(1)), url)
  assert.equal(target.search, '', 'Do not replace login, enrollment, or campaign query parameters')
  target.search = url.search
  if (!target.hash) target.hash = url.hash
  return target.href
}

function resolve(input) {
  let location = input
  const visited = new Set()
  for (let hop = 0; hop < 5; hop++) {
    assert(!visited.has(location), `Redirect loop at ${location}`)
    visited.add(location)
    const next = nextLocation(location)
    if (!next) return location
    location = next
  }
  assert.fail(`Too many redirect hops for ${input}`)
}

test('both gymnastics domains and athletics www resolve to the primary homepage', () => {
  // Explicit roots are required: the deployed platform does not consistently
  // apply /:path* to the empty root path when a static index exists.
  for (const host of ['vortex-gymnastics.com', 'www.vortex-gymnastics.com']) {
    const index = config.redirects.findIndex(rule => rule.source === '/'
      && rule.has?.some(condition => condition.type === 'host' && condition.value === host))
    assert(index >= 0, `${host} needs an explicit root redirect`)
    assert.equal(config.redirects[index].destination, `${primary}/`)
    assert.equal(config.redirects[index].permanent, true)
    const wildcardIndex = config.redirects.findIndex(rule => rule.source === '/:path*'
      && rule.has?.some(condition => condition.type === 'host' && condition.value === host))
    assert(index < wildcardIndex, 'Root redirects must precede wildcard redirects')
  }
  for (const host of aliases) assert.equal(nextLocation(`https://${host}/`), `${primary}/`)
  assert.equal(nextLocation(`${primary}/`), null)
})

test('operational links keep their path, query and fragment on the primary domain', () => {
  const paths = [
    '/?login=1', '/?billing=success&session_id=test-session',
    '/enroll?form=42&offering=3', '/signup/family?dropIn=7',
    '/signup/invite?token=test-invite', '/signup/lead?token=test-lead&session=test-session',
    '/verify-email?token=test-verification', '/registration/receipt?registration=42',
    '/waivers-memberships?member=4', '/read-board', '/drop-in?class=12',
    '/store?item=5', '/support', '/privacy-policy', '/terms-of-service',
    '/camp_interest/thank-you', '/employee/payroll/preparer?token=test-preparer',
    '/admin', '/admin.html', '/?login=1#member',
  ]
  for (const path of paths) {
    assert.equal(nextLocation(`${primary}${path}`), null)
    for (const host of aliases) assert.equal(nextLocation(`https://${host}${path}`), `${primary}${path}`)
  }
})

test('legacy marketing pages resolve directly to the corresponding unified section', () => {
  const expected = {
    '/newpage': '/', '/sports': '/#programs',
    '/artistic-gymnastics-early': '/gymnastics#preschool', '/artistic-gymnastics-6-12': '/gymnastics#youth',
    '/artistic-gymnastics-13-18': '/gymnastics#teen', '/campaigns/artistic-gymnastics-early': '/gymnastics#preschool',
    '/campaigns/artistic-gymnastics-6-12': '/gymnastics#youth', '/campaigns/artistic-gymnastics-13-18': '/gymnastics#teen',
    '/acro-gymnastics': '/gymnastics#acro', '/artistic-gymnastics': '/gymnastics#artistic',
    '/rhythmic-gymnastics': '/gymnastics#rhythmic', '/trampoline-tumbling': '/gymnastics#trampoline-tumbling',
    '/aerobic-gymnastics': '/gymnastics#aerobic', '/beginner-gymnastics': '/gymnastics#beginner',
    '/homeschool-gymnastics': '/gymnastics#homeschool', '/vortex-athletics': '/fit-and-flip',
    '/athleticism-accelerator': '/fit-and-flip#athleticism-development',
    '/strength-conditioning': '/fit-and-flip#strength', '/summer-athletic-training': '/fit-and-flip#choose-a-class',
    '/value': '/#approach', '/summer-camp-26': '/camp_interest',
  }
  assert.deepEqual(landingRedirects, expected, 'Client-side navigation must use the same retired marketing paths and destinations')
  for (const host of ['vortexathletics.com', ...aliases]) {
    for (const [path, destination] of Object.entries(expected)) {
      const target = new URL(`${primary}${destination}`)
      target.search = '?utm_source=legacy'
      assert.equal(nextLocation(`https://${host}${path}?utm_source=legacy`), target.href)
      assert.equal(resolve(`https://${host}${path}/?utm_source=legacy`), target.href)
    }
  }
})

test('public program and guide paths use one canonical form across hosts', () => {
  const paths = [
    '/gymnastics',
    '/fit-and-flip',
    '/adult-gymnastics',
    '/blog/athletic-development-young-athletes',
    '/blog/youth-sports-bowie',
    '/blog/preschool-gymnastics-what-toddlers-learn',
  ]
  for (const path of paths) {
    assert.equal(nextLocation(`${primary}${path}`), null)
    for (const host of ['vortexathletics.com', ...aliases]) {
      assert.equal(
        resolve(`https://${host}${path}/?utm_source=legacy#details`),
        `${primary}${path}?utm_source=legacy#details`,
      )
    }
  }
})

test('sitemaps and robots converge on the primary site without old gymnastics rewrites', () => {
  for (const host of ['vortexathletics.com', ...aliases]) {
    assert.equal(resolve(`https://${host}/sitemap-gymnastics.xml`), `${primary}/sitemap.xml`)
    assert.equal(resolve(`https://${host}/sitemap.xml`), `${primary}/sitemap.xml`)
    assert.equal(resolve(`https://${host}/robots.txt`), `${primary}/robots.txt`)
  }
  assert(!config.rewrites.some(rule => rule.destination.startsWith('/_gym/') || rule.destination === '/robots-gymnastics.txt'))
  assert(!config.redirects.some(rule => /https:\/\/(?:www\.)?vortex-gymnastics\.com/.test(rule.destination)))
})

test('other sport domains retain their existing homepage rewrites and do not redirect to the unified site', () => {
  const hosts = ['vortex-lacross.com', 'vortex-conditioning.com', 'vortex-football.com', 'vortex-basketball.com',
    'vortex-track.com', 'vortex-fit.com', 'vortex-athlete.com', 'vortex-soccer.com', 'vortex-reps.com']
  for (const host of hosts) {
    for (const variant of [host, `www.${host}`]) {
      assert.equal(nextLocation(`https://${variant}/`), null)
      assert.equal(nextLocation(`https://${variant}/gymnastics`), null)
      assert(config.rewrites.some(rule => rule.source === '/' && rule.destination === `/_seo/${host}.html`
        && rule.has.some(condition => new RegExp(`^(?:${condition.value})$`).test(variant))))
    }
  }
  assert.equal(nextLocation('https://vortexathletics.com.example.org/gymnastics'), null)
  assert.equal(nextLocation('https://www.vortex-gymnastics.com.example.org/gymnastics'), null)
})
