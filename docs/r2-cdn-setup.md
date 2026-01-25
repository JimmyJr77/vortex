# Cloudflare R2 + CDN Setup Guide

This guide walks through setting up Cloudflare R2 for hosting video assets and serving them via Cloudflare's CDN with a custom domain.

## Overview

We host video assets (MP4 files) in Cloudflare R2 and serve them via Cloudflare's CDN using a custom domain (`cdn.example.com`). This setup:
- Reduces bandwidth costs on Vercel
- Improves global load times via CDN edge caching
- Supports HTTP Range requests for video streaming/seeking
- Provides better performance for large video files

## Prerequisites

- Cloudflare account
- Access to your domain's DNS settings
- R2 bucket created in Cloudflare dashboard

## Step 1: Create R2 Bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** in the sidebar
3. Click **Create bucket**
4. Name it (e.g., `vortex-videos` or `vortex-assets`)
5. Choose a location (select closest to your primary audience)
6. Click **Create bucket**

**Note**: By default, R2 buckets are private. We'll configure public access via the custom domain.

## Step 2: Configure Custom Domain (CDN)

1. In your R2 bucket, go to **Settings** → **Public Access**
2. Click **Connect Domain** or **Add Custom Domain**
3. Enter your subdomain (e.g., `cdn.example.com`)
   - This will be your CDN base URL: `https://cdn.example.com`
4. Cloudflare will provide DNS records to add:
   - Add the CNAME record to your domain's DNS settings
   - Wait for DNS propagation (usually 1-5 minutes)
5. Once connected, your bucket will be accessible at:
   - `https://cdn.example.com/videos/landing_page_hero.mp4`
   - `https://cdn.example.com/videos/vald_sprints.mp4`

## Step 3: Configure Cache Rules

1. In Cloudflare Dashboard, go to **Rules** → **Cache Rules**
2. Create a new cache rule:
   - **Rule name**: `R2 Videos Cache`
   - **When incoming requests match**: `Hostname equals cdn.example.com AND URI Path starts with /videos/`
   - **Then**: Set cache status to `Cache Everything`
   - **Edge TTL**: `1 year` (31536000 seconds) - only if using versioned filenames
   - **Browser TTL**: `1 year` (31536000 seconds) - only if using versioned filenames

   **Alternative for non-versioned files**:
   - **Edge TTL**: `1 day` (86400 seconds) - allows faster cache invalidation
   - **Browser TTL**: `1 day` (86400 seconds)

3. Save the rule

## Step 4: Configure CORS

1. In your R2 bucket, go to **Settings** → **CORS Policy**
2. Add the following CORS configuration:

```json
[
  {
    "AllowedOrigins": [
      "https://yourdomain.com",
      "https://www.yourdomain.com",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "Content-Type"],
    "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

**Important**:
- Replace `yourdomain.com` with your actual domain
- Include `localhost` origins for local development
- `Range` header is required for video seeking/streaming
- `ExposeHeaders` allows browsers to handle range requests properly

## Step 5: Verify Content-Type Headers

R2 should automatically set correct Content-Type headers:
- `.mp4` → `video/mp4`
- `.webp` → `image/webp`
- `.jpg` / `.jpeg` → `image/jpeg`
- `.png` → `image/png`

If you need to set custom headers, you can do so via:
1. R2 bucket → **Settings** → **Metadata**
2. Or via the upload script (see `scripts/upload-videos-to-r2.js`)

## Step 6: Verify HTTP Range Request Support

HTTP Range requests are essential for video streaming. Cloudflare CDN supports Range requests by default when:
- The origin (R2) supports Range requests (it does)
- CORS is configured correctly (see Step 4)

**Test Range Request**:
```bash
curl -I -H "Range: bytes=0-1023" https://cdn.example.com/videos/landing_page_hero.mp4
```

Expected response:
```
HTTP/2 206 Partial Content
Content-Range: bytes 0-1023/12345678
Accept-Ranges: bytes
```

## Step 7: Security Headers (Optional but Recommended)

Configure security headers via Cloudflare **Transform Rules** or **Page Rules**:

1. Go to **Rules** → **Transform Rules** → **Response Headers**
2. Create a rule for `cdn.example.com`:
   - Add header: `X-Content-Type-Options: nosniff`
   - Add header: `X-Frame-Options: DENY` (if not embedding videos in iframes)
   - Add header: `Referrer-Policy: strict-origin-when-cross-origin`

**Note**: Do NOT set `Content-Security-Policy` that blocks video loading.

## Step 8: Upload Files to R2

Use the provided upload script:

```bash
cd scripts
node upload-videos-to-r2.js
```

Or use the Cloudflare dashboard:
1. Go to your R2 bucket
2. Click **Upload**
3. Upload files to the `videos/` folder:
   - `videos/landing_page_hero.mp4`
   - `videos/vald_sprints.mp4`
   - `videos/landing_page_hero.webp` (optional poster image)

## Step 9: Environment Variables

Set the following environment variable in Vercel:

- `VITE_CDN_BASE_URL`: `https://cdn.example.com/videos`

**For local development**, create a `.env.local` file:
```
VITE_CDN_BASE_URL=https://cdn.example.com/videos
```

## Step 10: Verify Setup

1. **Check DNS**: Verify `cdn.example.com` resolves correctly
   ```bash
   dig cdn.example.com
   ```

2. **Test CDN URL**: Open in browser:
   ```
   https://cdn.example.com/videos/landing_page_hero.mp4
   ```

3. **Check Headers**: Use browser DevTools → Network tab:
   - Verify `Content-Type: video/mp4`
   - Verify `Accept-Ranges: bytes`
   - Verify CORS headers are present

4. **Test Range Request**: Use curl (see Step 6)

5. **Verify Cache**: Check `CF-Cache-Status` header:
   - `HIT` = cached at edge
   - `MISS` = fetched from origin
   - `DYNAMIC` = not cacheable

## Troubleshooting

### Videos not loading
- Check CORS configuration includes your domain
- Verify DNS propagation for custom domain
- Check browser console for CORS errors

### Range requests failing
- Ensure CORS exposes `Content-Range` and `Accept-Ranges` headers
- Verify R2 bucket allows Range requests (default behavior)

### Cache not working
- Check Cache Rules are applied to the correct path
- Verify `Cache-Control` headers are set correctly
- Check `CF-Cache-Status` in response headers

### Slow initial load
- First request will be slower (cache miss)
- Subsequent requests should be fast (cache hit)
- Consider pre-warming cache by requesting files after upload

## Cost Considerations

- **R2 Storage**: ~$0.015 per GB/month
- **R2 Egress**: Free (unlimited egress via custom domain)
- **CDN**: Included with Cloudflare plan (free tier available)

## Versioning Strategy

For immutable caching (1 year TTL), use one of these approaches:

1. **Filename versioning**: `landing_page_hero.v2.mp4`
2. **Query string versioning**: `landing_page_hero.mp4?v=2`
3. **Folder versioning**: `videos/v2/landing_page_hero.mp4`

Update the CDN base URL in environment variables when versioning.

## References

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare CDN Documentation](https://developers.cloudflare.com/cache/)
- [HTTP Range Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)

