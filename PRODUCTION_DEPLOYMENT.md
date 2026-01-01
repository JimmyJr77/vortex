# Production Deployment Guide

## Frontend Configuration

The frontend is now configured to automatically use the correct API URL based on the environment:

- **Development**: Uses `http://localhost:3001` (or `VITE_API_URL` if set in `.env.local`)
- **Production**: Uses `https://vortex-backend-qybl.onrender.com` automatically

### Environment Variables

For local development, create a `.env.local` file:
```bash
VITE_API_URL=http://localhost:3001
```

**Important**: The `.env.local` file is gitignored and will not affect production builds.

For production builds (Vercel), no environment variables are needed - the app will automatically use the production backend URL.

## Backend Requirements

The production backend at `https://vortex-backend-qybl.onrender.com` must have the following endpoints:

### Event Endpoints (Required for Events feature)

1. **GET `/api/events`** - Public endpoint for ReadBoard
   - Returns all events with full details
   - Response format: `{ success: true, data: Event[] }`

2. **GET `/api/admin/events`** - Admin endpoint for Events management
   - Returns all events for admin panel
   - Response format: `{ success: true, data: Event[] }`

3. **POST `/api/admin/events`** - Create new event
   - Body: Event object with all required fields
   - Response format: `{ success: true, data: Event }`

4. **PUT `/api/admin/events/:id`** - Update existing event
   - Body: Event object with updated fields
   - Response format: `{ success: true, data: Event }`

5. **DELETE `/api/admin/events/:id`** - Delete event
   - Response format: `{ success: true, message: string }`

### Database Schema

The backend must have an `events` table with the following structure:
- `id` (primary key)
- `event_name` (text)
- `short_description` (text)
- `long_description` (text)
- `start_date` (date/timestamp)
- `end_date` (date/timestamp, nullable)
- `type` (text: 'camp', 'class', 'event', 'watch-party')
- `address` (text, nullable)
- `dates_and_times` (JSONB array)
- `key_details` (JSONB array)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Deploying Backend Changes

1. Ensure all event routes are in `backend/server.js`
2. Run database migrations to create the `events` table
3. Seed initial events if needed using `backend/seed-events.js`
4. Deploy to Render (or your production backend host)
5. Verify endpoints are accessible:
   ```bash
   curl https://vortex-backend-qybl.onrender.com/api/events
   ```

## Frontend Deployment (Vercel)

1. Push code to your repository
2. Vercel will automatically build and deploy
3. The production build will automatically use `https://vortex-backend-qybl.onrender.com`
4. No environment variables needed in Vercel dashboard

## Testing Production

After deployment, verify:
1. Events load on the Read Board page
2. Events appear in Admin panel Events section
3. Can create, edit, and delete events in Admin panel
4. All API calls go to production backend (check browser Network tab)

