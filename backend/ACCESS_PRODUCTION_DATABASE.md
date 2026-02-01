# How to Access Production Database

Your admin portal shows 35 users because it's connected to the **production database** at `https://vortex-backend-qybl.onrender.com`, not your local Docker database.

## Option 1: Query Production Database Directly (If you have DATABASE_URL)

If you have the production `DATABASE_URL`, you can query it directly:

### Step 1: Set the DATABASE_URL environment variable

```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

### Step 2: Run the check script

```bash
cd backend
node check-production-registrations.js
```

This will show all 35 registrations from production.

## Option 2: Use Docker to Connect to Production Database

If you have the production database connection details, you can connect using psql:

```bash
# If you have DATABASE_URL
psql $DATABASE_URL

# Or with individual parameters
psql -h production-host -U username -d database_name
```

Then run SQL queries:
```sql
SELECT * FROM registrations ORDER BY created_at DESC;
```

## Option 3: Query via Production API

### Get your admin token:
1. Open your admin portal in browser
2. Open browser DevTools (F12)
3. Go to Console tab
4. Run: `localStorage.getItem('adminToken')`
5. Copy the token

### Use the token to query API:

```bash
# Set the token
export ADMIN_TOKEN="your-token-here"

# Run the API check script (if you have node-fetch installed)
cd backend
node check-production-via-api.js
```

Or use curl:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://vortex-backend-qybl.onrender.com/api/admin/registrations
```

## Option 4: View in Browser DevTools

1. Open admin portal
2. Open DevTools (F12)
3. Go to Network tab
4. Refresh the inquiries page
5. Find the request to `/api/admin/registrations`
6. Click on it and view the Response tab
7. You'll see all 35 registrations in JSON format

## Quick Comparison

| Database | Location | Users | How to Access |
|----------|---------|-------|---------------|
| **Local** | Docker (localhost:5432) | 1 (Test User) | `docker exec -it vortex_postgres psql -U postgres -d vortex_athletics` |
| **Production** | Render (vortex-backend-qybl.onrender.com) | 35 (Real users) | Need DATABASE_URL or use API with admin token |

## Finding Your Production DATABASE_URL

The DATABASE_URL is typically stored in:
- Render dashboard (Environment Variables section)
- `.env.local` file (if you have it locally)
- Your deployment platform's environment variables

To check if you have it locally:
```bash
cd backend
cat .env.local | grep DATABASE_URL
```

## Summary

- **Local database** (Docker): Has 1 test user
- **Production database** (Render): Has 35 real users
- Your admin portal connects to **production** by default
- To see the 35 users, you need to either:
  1. Query production database directly (need DATABASE_URL)
  2. Use the production API (need admin token)
  3. View in browser DevTools Network tab

