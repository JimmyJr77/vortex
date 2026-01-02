# How to Verify Module 0 Migration

## Method 1: API Endpoint (Easiest) ✅

I've added a verification endpoint you can call:

```bash
# If running locally
curl http://localhost:3001/api/verify/module0

# Or in production
curl https://vortex-backend-qybl.onrender.com/api/verify/module0
```

Or open it in your browser:
- Local: http://localhost:3001/api/verify/module0
- Production: https://vortex-backend-qybl.onrender.com/api/verify/module0

The response will show:
- ✅ Status of each component
- Counts of migrated users
- Sample data
- Overall migration status

## Method 2: Check Server Logs

When you start/restart your backend server, look for these messages:

```
✅ Module 0 (Identity, Roles, Facility) initialized
✅ Database tables initialized successfully
```

If you see these, the migration ran!

## Method 3: Run SQL Queries Directly

Open `backend/quick-verify-module0.sql` in your database client and run the queries, or use:

```bash
psql -h localhost -U postgres -d vortex_athletics -f backend/quick-verify-module0.sql
```

## Expected Results

After successful migration:

1. ✅ `user_role` enum exists with 4 values:
   - OWNER_ADMIN
   - COACH
   - PARENT_GUARDIAN
   - ATHLETE_VIEWER

2. ✅ `facility` table exists with 1 row:
   - Name: "Vortex Athletics"
   - Timezone: "America/New_York"

3. ✅ `app_user` table exists

4. ✅ All existing admins migrated:
   - Count in `app_user` (role = OWNER_ADMIN) should match or exceed count in `admins` table

5. ✅ All existing members migrated:
   - Count in `app_user` (role = PARENT_GUARDIAN) should match or exceed count in `members` table

## Troubleshooting

### If migration didn't run:
1. **Restart your server** - Migration runs in `initDatabase()` on server start
2. Check server logs for errors
3. Verify database connection in `.env.local`

### If counts don't match:
- This is OK if you created new users after migration
- Migration only copies existing data, doesn't sync ongoing changes
- Re-running is safe (idempotent) - it skips duplicates

### If you see errors:
- Check PostgreSQL is running
- Verify database credentials
- Ensure database `vortex_athletics` exists

## Next Steps

Once verified, you can proceed with:
- Module 1: Programs & Classes
- Module 2: Family Accounts & Athlete Profiles
- etc.

