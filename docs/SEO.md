# Vortex SEO operations

Updated: August 17, 2026

This is the source of truth for the current search architecture. The longer
`SEO-AUDIT-2026.md` is a historical audit; use this document for deployments
and ongoing maintenance.

## Canonical domains

| Site | Canonical origin | Redirected duplicate |
|---|---|---|
| Vortex Athletics | `https://vortexathletics.com` | `https://www.vortexathletics.com/*` |
| Vortex Gymnastics | `https://www.vortex-gymnastics.com` | `https://vortex-gymnastics.com/*` |

Do not mix these host forms in canonicals, Open Graph URLs, schema, sitemaps,
internal links, GBP links, Search Console submissions, or citations.

## Search ownership

- `vortexathletics.com` owns Vortex brand, youth sports performance, athletic
  development, Fit & Flip, enrollment, classes/events, and contact intent.
- `www.vortex-gymnastics.com` owns gymnastics program and age-group intent.
- `/gymnastics`, `/campaigns/*`, legacy program slugs, and noncanonical hosts
  permanently redirect to the relevant canonical page.
- Placeholder sport domains remain `noindex, follow` until they have a real
  program, substantive content, and their own search strategy.
- `/ninja` is `noindex, follow` while the program is on hold.
- `/summer-camp-26` is `noindex, follow` because the final 2026 session ended
  July 31, 2026. Replace it with a current seasonal page before indexing again.
- Account, receipt, verification, admin, and inquiry utility routes receive an
  `X-Robots-Tag` noindex directive at the HTTP layer.

## Local entity source of truth

- Name: **Vortex Athletics and Gymnastics**
- Address: **4961 Tesla Dr Suite E, Bowie, MD 20715**
- Phone: **+1 (443) 422-4794**
- Google Maps CID: `https://www.google.com/maps?cid=15262285316302188709`
- Coordinates: `38.9564345, -76.7076355`

These values live in `src/config/contact.ts`. Public location links and
`SportsActivityLocation` JSON-LD must reuse that configuration. The location
schema has the stable ID `https://vortexathletics.com/#location` on both sites.

## Generated search files

`npm run prebuild` writes:

- `public/sitemap.xml` — athletics URLs only.
- `public/sitemap-gymnastics.xml` — gymnastics URLs only.
- `public/robots-hub.txt` — served as `/robots.txt` on the athletics host.
- `public/robots-gymnastics.txt` — served as `/robots.txt` on the gymnastics host.
- `public/robots-generic.txt` — safe fallback for other attached hosts; it does
  not advertise a cross-host sitemap. Do not create `public/robots.txt` because
  Vercel serves physical files before rewrites, bypassing host-specific routing.

Preview URLs such as `?sport=gymnastics` are crawlable but carry `noindex` and
a canonical. Do not block them in robots.txt: crawlers must fetch a URL to see
its `noindex` directive.

`scripts/seo-config.mjs` owns the sitemap and prerender route inventories.
`SEO_CONTENT_LASTMOD` changes only when indexable content or search metadata
meaningfully changes; do not rewrite `<lastmod>` to the build date on every
deployment.

## Metadata, content, and structured data

- `src/config/hubSeo.ts` owns athletics titles, descriptions, canonicals, and
  route-level robots directives.
- `src/config/gymnasticsSeo.ts` owns the gymnastics equivalents.
- `src/components/SeoHead.tsx` renders canonical, robots, Open Graph, Twitter,
  and JSON-LD tags.
- `src/utils/schema.ts` renders the shared Organization, WebSite, stable local
  business, BreadcrumbList, Service, Course, and visible FAQ schemas.
- Each indexable route must have one descriptive H1, one unique title, one
  unique meta description, a self-referencing canonical, and useful visible
  content that matches its search intent.
- FAQPage schema may only contain questions and answers visibly rendered on the
  same page.
- Do not add review/rating schema unless the reviews are first-party, visible,
  eligible under Google policy, and technically valid.

## Production prerender and release gate

Vercel runs:

```bash
npm run vercel-build
```

That command builds the app, browser-prerenders every configured route, and
runs `scripts/verify-seo-release.mjs`. The deployment must fail if an indexable
page has host drift, duplicate or missing search tags, an invalid canonical,
noindex, missing/duplicate H1, malformed JSON-LD, a wrong-host sitemap URL, or
if an intentionally excluded page loses its noindex directive. The gate also
protects the exact Google Business Profile NAP/map entity, consent-gated
analytics, self-hosted fonts, permanent canonical-host redirects, real 404s,
and cache policy for built assets and fonts.

Local verification:

```bash
npm run vercel-build
npm run test:seo-release
```

After deployment, verify the live hosts and redirect destinations:

```bash
npm run test:seo-live
```

## Page quality and performance guardrails

- Public search pages use a real `<main>` landmark and a single descriptive
  H1. Header links must not contain nested buttons, and icon-only controls need
  accessible names and at least a 24-by-24-pixel target.
- High-resolution photography is retained as source material, but public cards
  and heroes use responsive WebP derivatives. Do not point a carousel, card, or
  LCP image back at the multi-megabyte originals.
- The public gymnastics hero is deliberately stable rather than an autoplaying
  image strip. Autoplay caused each incoming photograph to become a new LCP
  candidate and produced misleadingly late lab results.
- Inter and Oswald are self-hosted in `public/fonts`; do not restore a
  render-blocking Google Fonts `@import`.
- Hashed Vite assets and self-hosted font files use one-year immutable caching.
  Public pages and mutable root-level media use Vercel's default revalidation;
  never apply `no-store` globally to public static content.
- Google Analytics and Tag Manager load only after analytics or marketing
  consent. Keep the consent defaults in `index.html` ahead of the optional tag
  loader.
- The homepage YouTube player is click-to-load. A `loading="lazy"` iframe alone
  is not sufficient to prevent YouTube's JavaScript from joining startup work.

Fresh mobile Lighthouse runs against the local production build on August 17,
2026 measured the athletics hub at **78 performance / 100 accessibility / 96
best practices / 100 SEO**, and the gymnastics preview at **78 performance /
100 accessibility / 96 best practices**. Observed (unthrottled) LCP was below
0.5 seconds on both pages, total blocking time was 0 ms, and CLS was 0. The
gymnastics preview intentionally reports a lower SEO score because the
`?sport=gymnastics` preview is `noindex`; the canonical production host is
indexable. Local CORS failures against the production API account for the
remaining best-practices deduction and must be rechecked on the deployed hosts.
These are lab results, not a substitute for Search Console Core Web Vitals
field data.

## Required Google owner actions after deployment

These actions require access to Google and cannot be completed by a code build.

### Google Search Console

1. Verify both domain properties.
2. Submit exactly:
   - `https://vortexathletics.com/sitemap.xml`
   - `https://www.vortex-gymnastics.com/sitemap-gymnastics.xml`
3. Remove or stop using submissions with the old host forms.
4. Inspect and request indexing for:
   - `https://vortexathletics.com/`
   - `https://vortexathletics.com/vortex-athletics`
   - `https://www.vortex-gymnastics.com/`
   - `https://www.vortex-gymnastics.com/beginner-gymnastics`
5. Confirm Google-selected canonical equals the declared canonical after the
   next crawl. Monitor Page Indexing, Core Web Vitals, and non-brand queries.

### Google Business Profile

1. Keep the public name exactly **Vortex Athletics and Gymnastics**; do not add
   search keywords to the name unless they are part of real-world signage and
   branding.
2. Keep **Gymnastics center** as the primary category while gymnastics remains
   the core offering. Add accurate secondary categories such as **Sports
   school** and **Physical fitness program** if those choices are available in
   the profile. Do not choose an inaccurate category solely for rankings.
3. Add complete services with natural descriptions: youth sports performance
   training, speed and agility training, youth strength and conditioning, Fit
   & Flip, beginner/preschool/teen gymnastics, artistic/rhythmic/acro
   gymnastics, trampoline and tumbling, homeschool gymnastics/PE, and drop-ins.
4. Confirm the website, appointment/enrollment link, exact NAP, coordinates,
   hours, holiday hours, and service areas.
5. Add current exterior/signage, interior, class, coach, and program photos.
   Publish useful updates when schedules or programs change.
6. Build an ethical, always-on review process after trials and milestones. Ask
   every eligible family without incentives or review gating, and respond to
   every review naturally. The profile had only three public reviews during the
   August 2026 audit, while prominent nearby competitors had many more; this is
   the largest remaining local-prominence gap.

### Citations and measurement

- Mirror the exact NAP and canonical website on Bing Places, Apple Business
  Connect, Facebook, Yelp, relevant gymnastics/youth directories, and local
  Bowie/Prince George's/Anne Arundel listings.
- Connect GA4 and Search Console. Report calls, directions, inquiries, trials,
  and enrollments—not rankings alone.
- Review Search Console queries monthly. Improve pages based on real impressions
  and conversions instead of creating thin city or keyword-variant pages.

## Expectations

Technical SEO makes the site eligible, understandable, and easier to crawl; it
does not guarantee a fixed “near me” position. Google also weighs searcher
distance, Business Profile relevance, and prominence. Expect recrawling and
ranking changes to take time after deployment, sitemap submission, profile
updates, and sustained review growth.
