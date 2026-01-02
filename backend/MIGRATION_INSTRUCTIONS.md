# Module 0 Migration Instructions

## Status

The Module 0 migration (Identity, Roles, Facility Settings) has been **integrated into `server.js`**. It will run automatically when the server starts.

## Option 1: Automatic Migration (Recommended)

Simply **restart your backend server**. The migration will run automatically as part of the `initDatabase()` function.

```bash
# Stop your current server (Ctrl+C)
# Then restart it:
cd backend
npm start
# or
npm run dev
```

You should see in the logs:
```
✅ Module 0 (Identity, Roles, Facility) initialized
✅ Database tables initialized successfully
```

## Option 2: Manual Migration via SQL File

If you prefer to run it manually, you can execute the SQL file directly:

```bash
# Using psql
psql -d vortex_athletics -f backend/migrations/001_module_0_identity_rbac_facility.sql

# Or using your database client (pgAdmin, DBeaver, etc.)
# Just open and execute: backend/migrations/001_module_0_identity_rbac_facility.sql
```

## What the Migration Does

1. **Creates `user_role` enum** with values:
   - `OWNER_ADMIN`
   - `COACH`
   - `PARENT_GUARDIAN`
   - `ATHLETE_VIEWER`

2. **Creates `facility` table** and seeds default "Vortex Athletics" facility

3. **Creates `app_user` table** (new unified user table)

4. **Migrates existing data**:
   - All `admins` → `app_user` with role `OWNER_ADMIN`
   - All `members` → `app_user` with role `PARENT_GUARDIAN`

## Verification

After the migration runs, verify it worked:

```sql
-- Check facility
SELECT * FROM facility;

-- Check migrated admins
SELECT id, email, full_name, role FROM app_user WHERE role = 'OWNER_ADMIN';

-- Check migrated members
SELECT id, email, full_name, role FROM app_user WHERE role = 'PARENT_GUARDIAN';
```

## Important Notes

- ✅ **Backward Compatible**: Your existing `admins` and `members` tables remain untouched
- ✅ **Idempotent**: Safe to run multiple times (uses `IF NOT EXISTS` and `WHERE NOT EXISTS`)
- ✅ **Non-Destructive**: No data is deleted, only new tables created and data copied

## Troubleshooting

If you see connection errors, make sure:
1. Your `.env.local` file has the correct database credentials
2. Your PostgreSQL server is running
3. The database `vortex_athletics` exists

