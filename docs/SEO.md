# Vortex SEO operations

Updated: November 16, 2026

This is the source of truth for the current search architecture. The longer
`SEO-AUDIT-2026.md` is a historical audit; use this document for deployments
and ongoing maintenance.

## Canonical domains

| Site | Canonical origin | Redirected duplicate |
|---|---|---|
| Vortex Athletics | `https://vortexathletics.com` | `https://www.vortexathletics.com/*` |
| Retired Vortex Gymnastics | `https://vortexathletics.com/` | Both `vortex-gymnastics.com` hosts |

Do not mix these host forms in canonicals, Open Graph URLs, schema, sitemaps,
internal links, GBP links, Search Console submissions, or citations.

## Search ownership

- `vortexathletics.com` owns Vortex brand, both youth and adult gymnastics, Fit
  & Flip, enrollment, classes, events, the storefront, and contact intent.
- Use one page for each program and link directly to it in public navigation,
  the class board, and any external profiles where the destination is relevant:

  | Canonical page | Search intent |
  |---|---|
  | `/gymnastics` | Youth gymnastics in Bowie: beginner, developmental, team, and discipline options |
  | `/fit-and-flip` | Youth athleticism development, sports performance training, and youth fitness in Bowie |
  | `/adult-gymnastics` | Adult gymnastics, fitness, and introductory acrobatics in Bowie |
  | `/blog` | Browse the published guides to youth sports, athletic development, and youth and adult gymnastics |

- Legacy gymnastics slugs and retired campaigns redirect permanently to the
  relevant youth gymnastics section. Legacy sports performance and conditioning
  slugs redirect to Fit & Flip. The former summer training link goes to current
  Fit & Flip starting options. The retired gymnastics host transfers equivalent
  paths to the athletics domain. The legacy `/schedule` and `/scheduling` URLs
  redirect to enrollment and preserve booking and campaign parameters.
- The former build's public HTML snapshot URLs redirect to the corresponding
  program pages, sections, or booking pages. Other snapshot paths return 404.
- The adult program page links to recurring Typhoons enrollment and to the
  adult drop-in calendar. Typhoons drop-in registration offers a one-time
  trial when the date and athlete qualify. The homepage trial finder serves
  children and teens.
- Placeholder sport domains remain `noindex, follow` until they have a real
  program, substantive content, and their own search strategy.
- `/ninja` is `noindex, follow` while the program is on hold.
- `/summer-camp-26` redirects to the camp interest form. Index a seasonal
  page once it contains a current offering.
- Account, receipt, verification, payroll, admin, and inquiry utility pages
  receive a noindex directive in the HTTP header or their dedicated app shell.

## Local entity source of truth

- Name: **Vortex Athletics and Gymnastics**
- Address: **4961 Tesla Dr Suite E, Bowie, MD 20715**
- Phone: **+1 (443) 422-4794**
- Google Maps CID: `https://www.google.com/maps?cid=15262285316302188709`
- Coordinates: `38.9564345, -76.7076355`

These values live in `src/config/contact.ts`. Public location links and
`SportsActivityLocation` JSON-LD must reuse that configuration. The facility,
website publisher, and guide author share the business ID
`https://vortexathletics.com/#location`. Include opening hours in the structured
data only on pages that display them.

## Generated search files

`npm run prebuild` writes:

- `public/sitemap.xml` — canonical pages and selected public photos on the
  primary domain. It includes gym photos loaded by the homepage carousel.
  The retired gymnastics sitemap redirects here.
- `public/robots-hub.txt` — served as `/robots.txt` on the athletics host.
- `public/robots-generic.txt` — safe fallback for other attached hosts; it does
  not advertise a cross-host sitemap. Do not create `public/robots.txt` because
  Vercel serves physical files before rewrites, bypassing host-specific routing.

Sport preview URLs such as `?sport=soccer` are crawlable and carry a `noindex`
HTTP response header. Crawlers must fetch a URL to see its `noindex`
directive, so robots.txt allows crawling of these and other noindex pages.

`scripts/seo-config.mjs` owns the sitemap and prerender route inventories.
Set a route's `lastmod` to its most recent substantive content or search
metadata change. Leave it out when the date is unknown. The build preserves
each configured date across deployments.

`src/config/publicSearchPhotos.json` holds the photo URLs shared by the page
components and sitemap. Use one image URL per photo and associate it with
pages that display it. The homepage identifies its training photo as the
preferred search image in `WebPage` JSON-LD.

The production prerender publishes the IndexNow ownership text file from
Vercel's production-only `INDEXNOW_KEY`. Keep the value out of the repository
and deployment logs. After adding the variable, run a new production build and
look for `Generated the IndexNow ownership file` in the log. With the key
available in your environment, `npm run test:seo-live` checks the public file
on the canonical domain. Submit changed canonical URLs in OpenSEO after that
check passes. IndexNow notifies participating search engines such as Bing.

## Metadata, content, and structured data

- `src/config/hubSeo.ts` owns unified site titles, descriptions, canonicals, and
  route-level robots directives.
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

Prerender blocks network requests to the production API. Mark live catalog,
account state, and loading UI with `data-prerender-dynamic` so the build
excludes them from raw HTML. Keep a useful heading and intro on each browser
snapshot. Client-only routes use `/_seo/spa.html` for the app entry point.

Vite reads the public booking catalog before prerendering the three program
pages. Published summaries include the catalog check date and the class
times and rates the build could verify. Base monthly tuition comes from the
current enrollment options for each youth class. Single-class rates come
from bookable nonmember drop-ins. The existing schedule and booking links
give visitors current prices and availability, including when a build could
only verify part of the catalog.

Local verification:

```bash
npm run vercel-build
npm run test:seo-release
```

After deployment, verify the live hosts and redirect destinations:

```bash
npm run test:seo-live
```

The release checks require clean links on indexable pages. Cross-domain consent
links for returning visitors carry `vcid` in a browser-only fragment. On arrival,
the app restores any section anchor and keeps the rest of the query string.
Legacy query-based `vcid` links to Fit & Flip redirect to the same page
without that parameter. The response keeps existing campaign parameters and
lets the browser carry the section anchor. A valid ID goes into the same
necessary consent cookie the browser already uses. Other legacy consent links
still load with `X-Robots-Tag: noindex` so the browser can apply consent. The
live check verifies that ordinary booking and campaign URLs remain indexable.

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

1. Verify the primary domain property.
2. Submit `https://vortexathletics.com/sitemap.xml` and remove retired sitemap
   submissions.
3. Inspect and request indexing for:
   - `https://vortexathletics.com/gymnastics`
   - `https://vortexathletics.com/fit-and-flip`
   - `https://vortexathletics.com/adult-gymnastics`
   - `https://vortexathletics.com/blog`
   - `https://vortexathletics.com/blog/athletic-development-young-athletes`
   - `https://vortexathletics.com/blog/youth-sports-bowie`
   - `https://vortexathletics.com/blog/preschool-gymnastics-what-toddlers-learn`
   - `https://vortexathletics.com/blog/gymnastics-vs-tumbling`
   - `https://vortexathletics.com/blog/returning-to-gymnastics-as-an-adult`
   - `https://vortexathletics.com/`
4. Confirm Google-selected canonical equals the declared canonical after the
   next crawl. Monitor Page Indexing, Core Web Vitals, and non-brand queries.

#### Retired gymnastics domain

The Vercel project currently forwards `vortex-gymnastics.com` to
`www.vortex-gymnastics.com` with HTTP 307 before the site's permanent
redirects run. Once the destination pages and the site's redirects are live,
assigning the retired apex to the production deployment allows the site's
redirect rules to map each old URL directly to its matching destination.
[Vercel project domains](https://vercel.com/3lisports/vortex/settings/domains)

Run `npm run test:seo-live` to check the homepages and representative legacy
URLs on both retired hosts. The check verifies permanent redirects to the
mapped program URLs, including section anchors and a preserved campaign
parameter. After changing the domain assignment, confirm the retired apex's
first HTTPS redirect goes directly to `vortexathletics.com`.

Check whether the cross-domain move was already filed. If a move still needs
to be filed, use an account that owns the old and new properties, verify each
source host variant, and run Google's validation before submitting. Google's
Change of Address guide calls for a homepage HTTP 301 and describes a check
for HTTP 301 on sample pages.
[Google’s Change of Address guide](https://support.google.com/webmasters/answer/9370220)

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
- On November 17, 2026, the GymnasticsUS listing used “A4 Gymnastic (VORTEX
  ATHLETICS LLC),” and the Zoomies listing left out Suite E and categorized
  Vortex as an open gym. Both pointed to the canonical website. The Nextdoor
  business profile matched the address and phone, with an empty website field.
  [GymnasticsUS listing](https://gymnasticsus.com/gyms/gym-a4-gymnastic-vortex-athletics-llc-bowie-md)
  · [Zoomies listing](https://zoomieskids.com/places/us/md/bowie/vortex-athletics)
  · [Nextdoor profile](https://nextdoor.com/pages/vortex-athletics-gymnastics-bowie-md/)
- Connect GA4 and Search Console. Report calls, directions, inquiries, trials,
  and enrollments—not rankings alone.
- Record a 28-day Search Console baseline before release or as soon as possible
  after release. Save clicks, impressions, click-through rate, and average
  position for non-brand queries. Track the six intent groups separately: youth
  athletics, youth gymnastics, athleticism development, youth sports, youth
  fitness, and adult gymnastics. Group local variants (Bowie, central Maryland,
  or near me) with the relevant intent and compare each group with its program
  page above. Include redirected URLs in the historical comparison.
- Compare with the next full 28-day period after the new pages are indexed.
  Pair search visibility with organic program-page visits and useful actions
  (adult contact clicks and youth class or trial starts). Improve pages based on
  those outcomes and the queries that show up in Search Console.
- Link to the clean URL for public navigation. Keep campaign parameters for
  external campaigns and transfer consent identifiers only across supported
  Vortex domains when needed.

## Expectations

Technical SEO makes the site eligible, understandable, and easier to crawl; it
does not guarantee a fixed “near me” position. Google also weighs searcher
distance, Business Profile relevance, and prominence. Expect recrawling and
ranking changes to take time after deployment, sitemap submission, profile
updates, and sustained review growth.
