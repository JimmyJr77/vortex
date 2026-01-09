# Deploying Class Iterations Feature to Production

## Problem
The `class_iteration` table doesn't exist in production, causing 500 errors when accessing iteration endpoints.

## Solution Options

### Option 1: Restart Backend Server (Recommended)
The `initDatabase()` function automatically creates the `class_iteration` table on server startup.

**Steps:**
1. Deploy the updated `backend/server.js` to your production server (Render/Railway/etc.)
2. Restart the backend server
3. The `initDatabase()` function will run and create the table automatically

**Verify:**
```bash
curl https://vortex-backend-qybl.onrender.com/api/admin/programs/1/iterations
```

### Option 2: Run Migration Script Manually
If you can't restart the server immediately, run the migration script:

**On your production server:**
```bash
cd backend
node run-class-iteration-migration.js
```

Or using the SQL file directly:
```bash
psql $DATABASE_URL -f migrations/add_class_iteration_table.sql
```

## What Gets Created

The migration creates:
- `class_iteration` table with all required fields
- Indexes for performance
- Foreign key constraint to `program` table

## Verification

After deployment, test the endpoints:
```bash
# Get iterations for a program
curl https://vortex-backend-qybl.onrender.com/api/admin/programs/13/iterations

# Should return: {"success":true,"data":[]} (empty array if no iterations)
```

## Troubleshooting

If you still get 500 errors:
1. Check backend server logs for the exact error
2. Verify the table exists: `SELECT * FROM class_iteration LIMIT 1;`
3. Ensure the backend code is deployed with the iteration endpoints
4. Check that `initDatabase()` is being called on server startup

