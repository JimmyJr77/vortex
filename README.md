# Vortex Athletics Website

A modern, technology-driven website for Vortex Athletics - a premier youth athletic development center opening December 1st, 2024.

## 🚀 Features

- **Modern Design**: Edgy, visually impressive design with black, red, white, and gray color scheme
- **Dynamic Hero Section**: Rotating text showcasing 8 Core Athletic Focuses
- **Contact Collection**: Embedded contact forms throughout the site
- **Opening Popup**: Welcome popup announcing December 1st opening
- **Database Integration**: PostgreSQL backend for storing registrations
- **Admin Dashboard**: View and manage registrations and newsletter subscribers
- **Responsive Design**: Works perfectly on all devices

## 🛠️ Tech Stack

### Frontend
- React 18.2.0
- TypeScript 5.0.0
- Vite 5.0.0
- Tailwind CSS 3.4.17
- Framer Motion (animations)

### Backend
- Node.js with Express
- PostgreSQL 15
- Joi (validation)
- Helmet (security)
- CORS enabled

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- Docker & Docker Compose (optional)

## 🚀 Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd vortex
   ```

2. **Start the database and backend**:
   ```bash
   docker-compose up -d postgres
   ```

3. **Install frontend dependencies**:
   ```bash
   npm install
   ```

4. **Start the frontend**:
   ```bash
   npm run dev
   ```

5. **Start the backend** (in a new terminal):
   ```bash
   cd backend
   npm install
   npm run dev
   ```

### Option 2: Manual Setup

1. **Install PostgreSQL** and create a database:
   ```sql
   CREATE DATABASE vortex_athletics;
   ```

2. **Setup backend**:
   ```bash
   cd backend
   npm install
   cp env.example .env
   # Edit .env with your PostgreSQL credentials
   npm run dev
   ```

3. **Setup frontend**:
   ```bash
   npm install
   npm run dev
   ```

## 📊 Admin Dashboard

Access the admin dashboard at `admin.html` to view:
- Total registrations
- Newsletter subscribers
- Registration details
- Export capabilities

## 🗄️ Database Schema

### Registrations Table
- `id` (SERIAL PRIMARY KEY)
- `first_name` (VARCHAR(50))
- `last_name` (VARCHAR(50))
- `email` (VARCHAR(255) UNIQUE)
- `phone` (VARCHAR(20))
- `athlete_age` (INTEGER, 5-18)
- `interests` (TEXT)
- `message` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Newsletter Subscribers Table
- `id` (SERIAL PRIMARY KEY)
- `email` (VARCHAR(255) UNIQUE)
- `created_at` (TIMESTAMP)

## 🔧 API Endpoints

- `POST /api/registrations` - Submit registration
- `POST /api/newsletter` - Subscribe to newsletter
- `GET /api/admin/registrations` - Get all registrations
- `GET /api/admin/newsletter` - Get all subscribers
- `GET /api/health` - Health check

## 🎨 Customization

### Colors
- Primary Red: `#DC2626`
- Gray: `#6B7280`
- Dark: `#111827`

### Fonts
- Display: Oswald
- Body: Inter

## 📱 Responsive Breakpoints

- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## 🔒 Security Features

- Rate limiting (100 requests per 15 minutes)
- Input validation with Joi
- SQL injection protection
- CORS configuration
- Helmet security headers

## 🚀 Deployment

### Frontend (Vercel/Netlify)
```bash
npm run build
# Deploy dist/ folder
```

### Backend (Railway/Heroku)
```bash
cd backend
# Deploy with PostgreSQL addon
```

## 📈 Performance

- Optimized images and assets
- Lazy loading components
- Efficient database queries
- CDN ready

## 🎥 Video Assets via Cloudflare R2 CDN

Video assets (hero background videos) are hosted on Cloudflare R2 and served via CDN for optimal performance and reduced bandwidth costs.

### Environment Variables

Set the following environment variable in Vercel (or `.env.local` for local development):

- `VITE_CDN_BASE_URL`: Base URL for CDN-hosted videos
  - Example: `https://cdn.example.com/videos`
  - If not set, videos will fall back to the `/public` folder

### Uploading Videos to R2

1. **Install AWS SDK** (required for upload script):
   ```bash
   npm install --save-dev @aws-sdk/client-s3
   ```

2. **Set R2 credentials** in your environment:
   ```bash
   export R2_ACCOUNT_ID="your-account-id"
   export R2_ACCESS_KEY_ID="your-access-key"
   export R2_SECRET_ACCESS_KEY="your-secret-key"
   export R2_BUCKET="your-bucket-name"
   export R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
   export CDN_BASE_URL="https://cdn.example.com/videos"  # Optional, for verification
   ```

3. **Run the upload script**:
   ```bash
   node scripts/upload-videos-to-r2.js
   ```

   The script will upload:
   - `landing_page_hero.mp4` → `videos/landing_page_hero.mp4`
   - `vald_sprints.mp4` → `videos/vald_sprints.mp4`
   - `landing_page_hero.webp` (if exists) → `videos/landing_page_hero.webp`

### Verifying CDN Setup

1. **Check in Browser DevTools**:
   - Open Network tab
   - Filter by "Media" or search for `.mp4`
   - Verify videos load from `cdn.example.com` (not from Vercel)
   - Check `CF-Cache-Status` header:
     - `HIT` = cached at edge (fast)
     - `MISS` = fetched from origin (first request)

2. **Verify Range Requests**:
   - Videos should support HTTP Range requests for seeking/streaming
   - Check `Accept-Ranges: bytes` header in response

3. **Check CORS**:
   - Ensure CORS headers are present
   - Videos should load without CORS errors

### Setup Documentation

- **Quick Start**: See [docs/r2-quick-start.md](./docs/r2-quick-start.md) for step-by-step guide with your R2 credentials
- **Full Setup**: See [docs/r2-cdn-setup.md](./docs/r2-cdn-setup.md) for detailed configuration options
- **Next Steps**: See [R2_SETUP_COMPLETE.md](./R2_SETUP_COMPLETE.md) for a checklist of remaining tasks

### Components

- **`HeroBackgroundVideo`**: Progressive enhancement component for hero background videos
  - Shows poster image immediately (LCP-friendly)
  - Loads video only after client-side gating (reduced motion, network, viewport)
  - Respects `prefers-reduced-motion` and network conditions
  - Uses IntersectionObserver for lazy loading

- **`CdnVideo`**: Lightweight component for CDN-hosted videos with controls
  - IntersectionObserver for lazy loading
  - Optional poster image
  - Configurable video attributes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary to Vortex Athletics.

## 📞 Support

For technical support, contact the development team.

---

**Vortex Athletics** - Where Science Meets Athletic Excellence