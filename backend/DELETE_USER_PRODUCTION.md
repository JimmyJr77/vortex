# Delete User from Production Database

The email `jimmyjr.obrien@gmail.com` still exists in the production database. Here are ways to delete it:

## Option 1: Use the API Endpoint (Recommended)

If you have access to make API calls to production, use the cleanup endpoint:

```bash
curl -X DELETE "https://vortex-backend-qybl.onrender.com/api/admin/users/by-email/jimmyjr.obrien%40gmail.com" \
  -H "Content-Type: application/json"
```

## Option 2: Run the Cleanup Script

1. Set your production database credentials as environment variables:
   ```bash
   export DATABASE_URL="your_production_database_url"
   # OR
   export DB_HOST="your_production_host"
   export DB_PORT="5432"
   export DB_NAME="vortex_athletics"
   export DB_USER="your_production_user"
   export DB_PASSWORD="your_production_password"
   export NODE_ENV="production"
   ```

2. Run the cleanup script:
   ```bash
   cd backend
   node delete-user-production.js
   ```

## Option 3: Direct Database Access

If you have direct access to the production PostgreSQL database:

```sql
-- Find the user
SELECT id, email, full_name, facility_id FROM app_user WHERE email = 'jimmyjr.obrien@gmail.com';

-- Get associated families
SELECT DISTINCT family_id as id FROM family_guardian WHERE user_id = (SELECT id FROM app_user WHERE email = 'jimmyjr.obrien@gmail.com')
UNION
SELECT id FROM family WHERE primary_user_id = (SELECT id FROM app_user WHERE email = 'jimmyjr.obrien@gmail.com');

-- Delete athletes in those families (replace FAMILY_IDS with actual IDs)
DELETE FROM athlete WHERE family_id IN (FAMILY_IDS);

-- Delete families
DELETE FROM family WHERE id IN (FAMILY_IDS);

-- Delete the user
DELETE FROM app_user WHERE email = 'jimmyjr.obrien@gmail.com';

-- Also check old members table (if it exists)
DELETE FROM members WHERE email = 'jimmyjr.obrien@gmail.com';
```

## Option 4: Use Railway/Render Dashboard

If your production database is on Railway or Render:
1. Go to your database dashboard
2. Open the database console/query editor
3. Run the SQL commands from Option 3

## Verification

After deletion, verify the email is gone:

```sql
SELECT email FROM app_user WHERE email = 'jimmyjr.obrien@gmail.com';
-- Should return 0 rows
```

