# Running Migration on Production (Render)

## Option 1: Using Render Shell (Recommended)

1. **Go to your Render Dashboard**
   - Navigate to your backend service on Render
   - Click on "Shell" tab (or use the terminal icon)

2. **Run the migration**
   ```bash
   cd backend
   npm run migrate add_categories_levels_tables.sql
   ```

   Or directly:
   ```bash
   node backend/run-migration.js add_categories_levels_tables.sql
   ```

## Option 2: Using Render Database Console

1. **Go to your Render Dashboard**
   - Navigate to your PostgreSQL database service
   - Click on "Connect" or "Info" tab
   - Copy the "Internal Database URL" or connection string

2. **Connect using psql** (if you have psql installed locally):
   ```bash
   psql <your-database-url>
   ```

3. **Run the migration SQL**:
   ```sql
   -- Copy and paste the contents of backend/migrations/add_categories_levels_tables.sql
   ```

## Option 3: Create a Temporary Migration Endpoint (Quick but less secure)

If you need to run it via API, you can temporarily add an endpoint to run migrations. 
**⚠️ Remove this endpoint after running the migration for security!**

Add this to `server.js` temporarily:

```javascript
// TEMPORARY: Remove after migration is run!
app.post('/api/admin/run-migration', async (req, res) => {
  try {
    const { migrationFile } = req.body
    if (migrationFile !== 'add_categories_levels_tables.sql') {
      return res.status(400).json({ success: false, message: 'Invalid migration file' })
    }
    
    const fs = require('fs')
    const path = require('path')
    const migrationPath = path.join(__dirname, 'migrations', migrationFile)
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    await pool.query(sql)
    
    res.json({ success: true, message: 'Migration completed' })
  } catch (error) {
    console.error('Migration error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})
```

Then call it:
```bash
curl -X POST https://vortex-backend-qybl.onrender.com/api/admin/run-migration \
  -H "Content-Type: application/json" \
  -d '{"migrationFile": "add_categories_levels_tables.sql"}'
```

## Option 4: Using Render's Database Web Console

1. Go to your PostgreSQL database on Render
2. Click on "Connect" → "External Connection"
3. Use the provided connection string with a PostgreSQL client
4. Run the migration SQL file contents

## Verification

After running the migration, verify it worked:

```sql
-- Check if tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('program_categories', 'skill_levels');

-- Check if data was migrated
SELECT COUNT(*) FROM program_categories;
SELECT COUNT(*) FROM skill_levels;
```

## Troubleshooting

If you get errors:
- Make sure the `DATABASE_URL` environment variable is set correctly on Render
- Check that the migration file exists in the `backend/migrations/` directory
- Verify the database connection is working
- Check Render logs for detailed error messages

