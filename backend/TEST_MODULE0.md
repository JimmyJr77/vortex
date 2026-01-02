# Testing Module 0 Migration

## Quick Test Methods

### Method 1: Check Server Logs (Easiest)

When you restart your server, look for these log messages:

```
✅ Module 0 (Identity, Roles, Facility) initialized
✅ Database tables initialized successfully
```

If you see these messages, the migration ran successfully!

### Method 2: Run SQL Verification Queries

Execute the verification SQL file using your database client:

```bash
# Using psql
psql -d vortex_athletics -f backend/migrations/verify_module0.sql

# Or copy/paste the queries from backend/migrations/verify_module0.sql
# into your database client (pgAdmin, DBeaver, etc.)
```

### Method 3: Quick Manual Checks

Run these queries in your database:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('facility', 'app_user');

-- Check facility
SELECT * FROM facility;

-- Check user counts by role
SELECT role, COUNT(*) 
FROM app_user 
GROUP BY role;

-- Check if admins were migrated
SELECT COUNT(*) FROM admins;
SELECT COUNT(*) FROM app_user WHERE role = 'OWNER_ADMIN';
-- These counts should match (or app_user should have more if new admins were created)

-- Check if members were migrated
SELECT COUNT(*) FROM members;
SELECT COUNT(*) FROM app_user WHERE role = 'PARENT_GUARDIAN';
-- These counts should match (or app_user should have more if new members were created)
```

## Expected Results

After successful migration, you should see:

1. ✅ `user_role` enum exists with 4 values
2. ✅ `facility` table exists with 1 row (Vortex Athletics)
3. ✅ `app_user` table exists
4. ✅ All existing admins migrated to `app_user` with role `OWNER_ADMIN`
5. ✅ All existing members migrated to `app_user` with role `PARENT_GUARDIAN`

## Troubleshooting

### If migration didn't run:

1. **Restart your server** - The migration runs in `initDatabase()` when the server starts
2. **Check server logs** for any error messages
3. **Verify database connection** - Make sure your `.env.local` has correct credentials

### If counts don't match:

- This is OK if you created new admins/members after the migration
- The migration only copies existing data, it doesn't sync ongoing changes
- You can re-run the migration (it's idempotent) - it will skip duplicates

### If you see errors:

- Check that PostgreSQL is running
- Verify database credentials in `.env.local`
- Make sure the database `vortex_athletics` exists

## Next Steps

Once Module 0 is verified, you can proceed with:
- Module 1: Programs & Classes
- Module 2: Family Accounts & Athlete Profiles
- etc.

