# R2 Quick Start Guide

This guide will help you quickly set up Cloudflare R2 for video hosting using your existing credentials.

## Your R2 Information

⚠️ **IMPORTANT**: Replace the placeholders below with your actual R2 credentials from Cloudflare Dashboard.

- **Account ID**: `YOUR_ACCOUNT_ID` (get from Cloudflare Dashboard → R2)
- **S3 Endpoint**: `https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com`
- **Access Key ID**: `YOUR_ACCESS_KEY_ID` (create API token in Cloudflare)
- **Secret Access Key**: `YOUR_SECRET_ACCESS_KEY` (create API token in Cloudflare)

**To get your credentials:**
1. Go to Cloudflare Dashboard → **My Profile** → **API Tokens**
2. Create a new R2 token with read/write permissions
3. Copy the Access Key ID and Secret Access Key

## Step 1: Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2**
2. Click **Create bucket**
3. Name it: `videos` (this is your bucket name)
4. Choose location (closest to your audience)
5. Click **Create bucket**

**Note**: Files will be organized with a `videos/` prefix inside the bucket for CDN URL structure (e.g., `videos/landing_page_hero.mp4`)

## Step 2: Configure Custom Domain (CDN)

1. In your bucket → **Settings** → **Public Access**
2. Click **Connect Domain** or **Add Custom Domain**
3. Enter subdomain (e.g., `cdn.yourdomain.com`)
4. Add the CNAME record to your domain's DNS
5. Wait for DNS propagation (1-5 minutes)

Your CDN URL will be: `https://cdn.yourdomain.com/videos/`

## Step 3: Set Up Environment Variables

### Option A: Using the Setup Script

```bash
chmod +x scripts/setup-r2-env.sh
./scripts/setup-r2-env.sh
```

The script will prompt you for:
- CDN base URL (e.g., `https://cdn.yourdomain.com/videos`)
- Bucket name is automatically set to `videos`

### Option B: Manual Setup

Create `.env.local` file:

```bash
# R2 Credentials (replace with your actual values)
R2_ACCOUNT_ID=YOUR_ACCOUNT_ID
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
R2_BUCKET=videos

# CDN URL (update with your actual domain)
CDN_BASE_URL=https://cdn.yourdomain.com/videos
VITE_CDN_BASE_URL=https://cdn.yourdomain.com/videos
```

## Step 4: Install AWS SDK

```bash
npm install --save-dev @aws-sdk/client-s3
```

## Step 5: Upload Videos

```bash
node scripts/upload-videos-to-r2.js
```

This will upload:
- `landing_page_hero.mp4` → `videos/landing_page_hero.mp4`
- `vald_sprints.mp4` → `videos/vald_sprints.mp4`
- `landing_page_hero.webp` (if exists) → `videos/landing_page_hero.webp`

## Step 6: Configure Vercel

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add:
   - **Name**: `VITE_CDN_BASE_URL`
   - **Value**: `https://cdn.yourdomain.com/videos`
   - **Environment**: Production, Preview, Development
3. Redeploy your site

## Step 7: Configure CORS

In your R2 bucket → **Settings** → **CORS Policy**, add:

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

Replace `yourdomain.com` with your actual domain.

## Step 8: Verify Setup

1. **Test CDN URL**: Open `https://cdn.yourdomain.com/videos/landing_page_hero.mp4` in browser
2. **Check in DevTools**: 
   - Network tab → Filter by "Media"
   - Verify videos load from `cdn.yourdomain.com`
   - Check `CF-Cache-Status` header (should be `HIT` after first load)
3. **Test Range Requests**:
   ```bash
   curl -I -H "Range: bytes=0-1023" https://cdn.yourdomain.com/videos/landing_page_hero.mp4
   ```
   Should return `206 Partial Content`

## Troubleshooting

### Videos not loading
- Check CORS configuration includes your domain
- Verify DNS propagation for custom domain
- Check browser console for CORS errors

### Upload script fails
- Verify bucket name matches exactly
- Check credentials are correct
- Ensure AWS SDK is installed: `npm install --save-dev @aws-sdk/client-s3`

### CDN not working
- Verify custom domain is connected in R2 bucket settings
- Check DNS CNAME record is correct
- Wait for DNS propagation (can take up to 24 hours, usually 1-5 minutes)

## Security Note

⚠️ **IMPORTANT**: The credentials shared above should be rotated after setup:
1. Go to Cloudflare Dashboard → **My Profile** → **API Tokens**
2. Revoke the current token
3. Create a new token with same permissions
4. Update `.env.local` and Vercel environment variables

