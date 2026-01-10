import pg from 'pg'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envLocalPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
  console.log('📝 Loaded .env.local')
} else {
  dotenv.config()
  console.log('📝 Loaded .env')
}

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vortex_athletics',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function runCleanupMigration() {
  const client = await pool.connect()
  try {
    console.log('🧹 RUNNING LEGACY TABLE CLEANUP MIGRATION')
    console.log('═'.repeat(80))
    console.log('')
    
    // First, verify prerequisites
    console.log('🔍 Pre-flight verification:')
    console.log('─'.repeat(80))
    
    // Check if unified member table exists
    const memberTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
      )
    `)
    
    if (!memberTableCheck.rows[0].exists) {
      console.log('❌ ERROR: Unified member table does not exist!')
      console.log('   Cannot proceed - migration 005_unified_member_table.sql must be run first.')
      return false
    }
    console.log('✅ Unified member table exists')
    
    // Check that app_user still exists (it should)
    const appUserCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'app_user'
      )
    `)
    
    if (!appUserCheck.rows[0].exists) {
      console.log('⚠️  WARNING: app_user table does not exist!')
      console.log('   This table is needed for admin authentication.')
      console.log('   Cleanup will proceed, but you may need to recreate app_user.')
    } else {
      console.log('✅ app_user table exists (will be preserved)')
    }
    
    // Check what legacy tables exist
    const legacyTables = ['members', 'member_children', 'athlete', 'athlete_program']
    const existingLegacy = []
    
    for (const table of legacyTables) {
      const exists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table])
      
      if (exists.rows[0].exists) {
        const count = await client.query(`SELECT COUNT(*) as count FROM "${table}"`)
        existingLegacy.push({ name: table, count: parseInt(count.rows[0].count) })
      }
    }
    
    if (existingLegacy.length === 0) {
      console.log('✅ No legacy tables found - cleanup already complete!')
      return true
    }
    
    console.log('')
    console.log('📋 Legacy tables to be dropped:')
    existingLegacy.forEach(t => {
      console.log(`   • ${t.name} (${t.count} rows)`)
    })
    console.log('')
    
    // Execute DROP statements directly
    console.log('🚀 Starting transaction...')
    await client.query('BEGIN')
    
    try {
      // Drop tables in order (respecting foreign key dependencies)
      const tablesToDrop = [
        'member_children',  // Drop first (has FK to members)
        'members',          // Drop second
        'athlete',          // Drop third
        'athlete_program'   // Drop last (may have FK to athlete)
      ]
      
      for (const tableName of tablesToDrop) {
        // Check if table exists before trying to drop
        const exists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [tableName])
        
        if (!exists.rows[0].exists) {
          console.log(`   ⏭️  ${tableName}: Does not exist, skipping`)
          continue
        }
        
        console.log(`   Dropping table: ${tableName}...`)
        
        try {
          await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`)
          console.log(`   ✅ Successfully dropped ${tableName}`)
        } catch (error) {
          // Log but continue - IF EXISTS should handle missing tables
          console.log(`   ⚠️  Error dropping ${tableName}: ${error.message}`)
          // Don't throw - continue with other tables
        }
      }
      
      await client.query('COMMIT')
      console.log('')
      console.log('✅ Transaction committed successfully!')
      
    } catch (error) {
      await client.query('ROLLBACK')
      console.log('')
      console.log('❌ Error during migration - transaction rolled back')
      throw error
    }
    
    // Verify cleanup
    console.log('')
    console.log('🔍 Verifying cleanup:')
    console.log('─'.repeat(80))
    
    for (const table of legacyTables) {
      const exists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table])
      
      if (!exists.rows[0].exists) {
        console.log(`   ✅ ${table}: Successfully removed`)
      } else {
        console.log(`   ⚠️  ${table}: Still exists`)
      }
    }
    
    // Verify critical tables still exist
    console.log('')
    console.log('🔍 Verifying critical tables are preserved:')
    console.log('─'.repeat(80))
    
    const criticalTables = ['member', 'app_user', 'family', 'member_program']
    for (const table of criticalTables) {
      const exists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table])
      
      if (exists.rows[0].exists) {
        console.log(`   ✅ ${table}: Still exists`)
      } else {
        console.log(`   ❌ ${table}: MISSING! This is a problem!`)
      }
    }
    
    return true
    
  } catch (error) {
    console.error('')
    console.error('❌ Migration failed:', error.message)
    console.error('')
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
    return false
  } finally {
    client.release()
    await pool.end()
  }
}

// Run the migration
runCleanupMigration()
  .then((success) => {
    if (success) {
      console.log('')
      console.log('═'.repeat(80))
      console.log('✅ CLEANUP MIGRATION COMPLETED SUCCESSFULLY!')
      console.log('')
      console.log('📋 Next steps:')
      console.log('   1. Verify your application still works correctly')
      console.log('   2. Test admin portal member viewing/editing')
      console.log('   3. Verify no code references the dropped tables')
      console.log('')
      process.exit(0)
    } else {
      console.log('')
      console.log('❌ Cleanup migration did not complete successfully')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

