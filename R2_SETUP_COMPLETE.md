# R2 CDN Setup - Next Steps

Your R2 credentials have been configured. Here's what you need to do to complete the setup:

## ✅ What's Already Done

1. ✅ R2 components created (`HeroBackgroundVideo`, `CdnVideo`)
2. ✅ Upload script created (`scripts/upload-videos-to-r2.js`)
3. ✅ Setup script created (`scripts/setup-r2-env.sh`)
4. ✅ Documentation created (`docs/r2-cdn-setup.md`, `docs/r2-quick-start.md`)
5. ✅ Components integrated into `Hero.tsx` and `AthleticismAccelerator.tsx`

## 📋 What You Need to Do

### 1. Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **R2**
2. Click **Create bucket**
3. Name it: `videos` (this is your bucket name)
4. Choose location
5. Click **Create bucket**

**Note**: Files will be organized with a `videos/` prefix inside the bucket for CDN URL structure

### 2. Set Up Environment Variables

**Option A: Use the setup script** (recommended):
```bash
./scripts/setup-r2-env.sh
```

**Option B: Create `.env.local` manually**:
```bash
# Copy from docs/r2-quick-start.md and fill in:
# - R2_BUCKET=videos (your bucket name)
# - CDN_BASE_URL (your custom domain, e.g., https://cdn.yourdomain.com/videos)
```

### 3. Install Dependencies

```bash
npm install --save-dev @aws-sdk/client-s3
```

Optional (for automatic .env loading):
```bash
npm install --save-dev dotenv
```

### 4. Configure Custom Domain (CDN)

1. In your R2 bucket → **Settings** → **Public Access**
2. Click **Connect Domain**
3. Enter subdomain (e.g., `cdn.yourdomain.com`)
4. Add CNAME record to your domain's DNS
5. Wait for DNS propagation (1-5 minutes)

### 5. Configure CORS

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

### 6. Upload Videos

```bash
node scripts/upload-videos-to-r2.js
```

This uploads:
- `landing_page_hero.mp4` → `videos/landing_page_hero.mp4`
- `vald_sprints.mp4` → `videos/vald_sprints.mp4`
- `landing_page_hero.webp` (if exists) → `videos/landing_page_hero.webp`

### 7. Configure Vercel

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add:
   - **Name**: `VITE_CDN_BASE_URL`
   - **Value**: `https://cdn.yourdomain.com/videos` (your actual CDN URL)
   - **Environment**: Production, Preview, Development
3. Redeploy your site

### 8. Verify Setup

1. **Test CDN URL**: Open `https://cdn.yourdomain.com/videos/landing_page_hero.mp4` in browser
2. **Check in DevTools**: 
   - Network tab → Filter by "Media"
   - Verify videos load from `cdn.yourdomain.com`
   - Check `CF-Cache-Status` header
3. **Test Range Requests**:
   ```bash
   curl -I -H "Range: bytes=0-1023" https://cdn.yourdomain.com/videos/landing_page_hero.mp4
   ```
   Should return `206 Partial Content`

## 🔐 Security Note

⚠️ **IMPORTANT**: The R2 credentials you shared should be rotated after setup:

1. Go to Cloudflare Dashboard → **My Profile** → **API Tokens**
2. Revoke the current token
3. Create a new token with same permissions
4. Update `.env.local` and Vercel environment variables

## 📚 Documentation

- **Quick Start**: See `docs/r2-quick-start.md` for step-by-step guide with your credentials
- **Full Setup**: See `docs/r2-cdn-setup.md` for detailed configuration options
- **README**: See `README.md` for general CDN information

## 🆘 Troubleshooting

### Videos not loading
- Check CORS configuration includes your domain
- Verify DNS propagation for custom domain
- Check browser console for CORS errors

### Upload script fails
- Verify bucket name matches exactly
- Check credentials are correct in `.env.local`
- Ensure AWS SDK is installed: `npm install --save-dev @aws-sdk/client-s3`

### CDN not working
- Verify custom domain is connected in R2 bucket settings
- Check DNS CNAME record is correct
- Wait for DNS propagation (can take up to 24 hours, usually 1-5 minutes)

## 🎯 Your R2 Information

- **Account ID**: `2ba521e445c47efaa275b65fc9d1a196`
- **S3 Endpoint**: `https://2ba521e445c47efaa275b65fc9d1a196.r2.cloudflarestorage.com`
- **Access Key ID**: `d7bae3a9f7b2dfc5ba2726ba68049bac`
- **Secret Access Key**: `fcaebaa6c223aba359176cdc3c8504916a855aea4339a030bcb7673c9c00fa12`

⚠️ Remember to rotate these credentials after setup!

