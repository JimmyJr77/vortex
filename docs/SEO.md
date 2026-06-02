# SEO setup

## Runtime meta (all environments)

- **Hub** (`vortexathletics.com`): per-route title, description, canonical, and Open Graph tags via `HubSeo` + `src/config/hubSeo.ts`.
- **Sport stubs** (`vortex-football.com`, etc.): per-domain meta via `SeoHead` + `src/config/stubSites.ts`.
- **Vortex Gymnastics** (`vortex-gymnastics.com`): full gymnastics site in `src/apps/gymnastics/` with `GymnasticsHeader`, copied pages, and `src/config/gymnasticsSeo.ts`. Read board uses the same API as the hub (`getApiUrl()` → `/api/events`).
- **Summer Camp 2026** (`/summer-camp-26`): camp landing with route-specific OG image (flyer), Event + FAQ JSON-LD, and entry in `sitemap-gymnastics.xml`. Hub URLs redirect to the gymnastics domain via `vercel.json`.
- **Preview URLs** (`?sport=football` on localhost or the hub): `noindex, nofollow` so they are not indexed alongside real sport domains.

## Static files

- `public/robots.txt` — allows crawlers, disallows `/admin.html`, points to the sitemap.
- `public/sitemap.xml` — regenerated on every `npm run build` via `scripts/generate-sitemap.mjs` (hub routes + all 10 stub homepages).

## Optional prerender (production builds)

Set `PRERENDER=true` before build to:

1. Write `dist/_seo/<host>.html` with sport-specific `<head>` meta (used by Vercel host rewrites in `vercel.json`).
2. Snapshot hub routes into `dist/<path>/index.html` using Playwright (requires `playwright` devDependency and browser install).

```bash
npm i -D playwright
npx playwright install chromium
PRERENDER=true npm run build
```

On Vercel, add environment variable `PRERENDER=true` to the project if you want prerender on deploy. Stub `_seo` HTML is only useful when host rewrites are active and files exist in `dist/_seo/`.

## Local testing

| URL | Expected |
|-----|----------|
| `http://localhost:5173/` | Full hub site + hub SEO |
| `http://localhost:5173/gymnastics` | Gymnastics page + route SEO |
| `http://localhost:5173/?sport=football` | Football stub + `noindex` |
| View page source / DevTools → Elements → `<head>` | Meta, canonical, `og:*` tags |

## Post-deploy checklist

1. Add **vortexathletics.com** and each **vortex-&lt;sport&gt;.com** domain as custom domains on the same Vercel project.
2. Register each domain in **Google Search Console**.
3. Submit `https://www.vortexathletics.com/sitemap.xml` and `https://vortex-gymnastics.com/sitemap-gymnastics.xml`.
4. Request indexing for new gymnastics routes (e.g. `/summer-camp-26`) on the **gymnastics** Search Console property.
5. Validate sharing with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — confirm `/summer-camp-26` uses the camp flyer as `og:image`.
6. Keep `scripts/seo-config.mjs` in sync when adding routes or stub domains (also update `src/config/gymnasticsSeo.ts`, `src/config/hubSeo.ts`, and `src/config/stubSites.ts`).
7. Set **`PRERENDER=true`** on Vercel so gymnastics routes (including `/summer-camp-26`) ship prerendered HTML with correct `<title>` and meta.
