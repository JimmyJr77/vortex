# How to Seed Events in Production Database

The production database currently has no events. You need to seed them. Here are two options:

## Option 1: Use the Admin API Endpoint (Recommended)

I've added a new endpoint that you can call to seed events:

```bash
curl -X POST https://vortex-backend-qybl.onrender.com/api/admin/events/seed
```

This will:
- Check if events already exist (won't overwrite if they do)
- Insert all 9 events from the seed file
- Return the count of events created

**Note:** If events already exist, you'll get an error. To force re-seed, you'll need to delete existing events first or use Option 2.

## Option 2: Run Seed Script on Render

1. Go to your Render dashboard
2. Select your backend service
3. Open the "Shell" tab (or use SSH if available)
4. Run:
   ```bash
   cd backend
   npm run seed-events
   ```

## Option 3: Use Render's Database Console

If you have direct database access:

1. Go to your Render dashboard
2. Find your PostgreSQL database
3. Open the "Connect" or "Console" tab
4. Run the SQL from `backend/migrations/seed_events.sql`

## Verify Events Were Seeded

After seeding, verify by calling:
```bash
curl https://vortex-backend-qybl.onrender.com/api/events
```

You should see 9 events in the response.

