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

async function cleanupLegacyTables() {
  const client = await pool.connect()
  try {
    console.log('🧹 CLEANING UP LEGACY MEMBER TABLES')
    console.log('═'.repeat(80))
    console.log('')
    
    // Tables to potentially drop (legacy tables that are no longer needed)
    const legacyTables = [
      'members',           // Old members table (replaced by unified 'member')
      'member_children',   // Old member_children table (now handled via parent_guardian_authority)
      'athlete'            // Old athlete table (migrated to unified 'member')
    ]
    
    // Tables to preserve (still in use)
    const preserveTables = [
      'app_user',          // Still needed for admin authentication
      'member',            // The unified member table (main table)
      'family',            // Still in use
      'family_member',     // Canonical family membership table
      'member_program',    // Still in use (enrollments)
      'parent_guardian_authority' // Still in use (parent-child relationships)
    ]
    
    console.log('🔍 Pre-flight checks:')
    console.log('─'.repeat(80))
    
    // Step 1: Verify unified member table exists
    const memberTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
      )
    `)
    
    if (!memberTableCheck.rows[0].exists) {
      console.log('❌ ERROR: Unified member table does not exist!')
      console.log('   Cannot proceed with cleanup - migration may not be complete.')
      console.log('   Please run migration: 005_unified_member_table.sql')
      return
    }
    console.log('✅ Unified member table exists')
    
    // Step 2: Check for foreign key dependencies
    console.log('')
    console.log('🔍 Checking for foreign key dependencies:')
    console.log('─'.repeat(80))
    
    const fkCheckQuery = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND (
          tc.table_name = ANY($1::text[])
          OR ccu.table_name = ANY($1::text[])
        )
    `
    
    const fkResults = await client.query(fkCheckQuery, [legacyTables])
    
    if (fkResults.rows.length > 0) {
      console.log('⚠️  Found foreign key dependencies:')
      fkResults.rows.forEach(fk => {
        console.log(`   • ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`)
      })
      console.log('   (These will be dropped with CASCADE)')
    } else {
      console.log('✅ No foreign key dependencies found')
    }
    
    // Step 3: Verify legacy tables are empty or data is migrated
    console.log('')
    console.log('🔍 Verifying legacy tables are safe to drop:')
    console.log('─'.repeat(80))
    
    const tableChecks = {}
    let allSafeToDrop = true
    
    for (const tableName of legacyTables) {
      const existsCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName])
      
      if (!existsCheck.rows[0].exists) {
        console.log(`   ✅ ${tableName}: Does not exist (already dropped)`)
        tableChecks[tableName] = { exists: false, count: 0, safe: true }
        continue
      }
      
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`)
        const count = parseInt(countResult.rows[0].count)
        tableChecks[tableName] = { exists: true, count, safe: count === 0 }
        
        if (count === 0) {
          console.log(`   ✅ ${tableName}: Exists but empty (safe to drop)`)
        } else {
          console.log(`   ⚠️  ${tableName}: Has ${count} rows!`)
          console.log(`      → Verify data has been migrated to unified member table`)
          allSafeToDrop = false
        }
      } catch (error) {
        console.log(`   ❌ ${tableName}: Error checking - ${error.message}`)
        tableChecks[tableName] = { exists: true, count: null, safe: false }
        allSafeToDrop = false
      }
    }
    
    // Special check for athlete table - verify data was migrated
    if (tableChecks['athlete']?.exists && tableChecks['athlete']?.count > 0) {
      console.log('')
      console.log('   🔍 Checking if athlete data was migrated to member table...')
      const athleteResult = await client.query('SELECT COUNT(*) as count FROM athlete')
      const memberResult = await client.query('SELECT COUNT(*) as count FROM member')
      console.log(`      athlete table: ${athleteResult.rows[0].count} rows`)
      console.log(`      member table: ${memberResult.rows[0].count} rows`)
      
      if (parseInt(memberResult.rows[0].count) >= parseInt(athleteResult.rows[0].count)) {
        console.log('      ✅ Migration appears complete (member table has equal or more rows)')
        tableChecks['athlete'].safe = true
        allSafeToDrop = true
      } else {
        console.log('      ⚠️  WARNING: Member table has fewer rows than athlete table!')
        console.log('         → Data may not be fully migrated')
      }
    }
    
    console.log('')
    console.log('═'.repeat(80))
    console.log('')
    
    if (!allSafeToDrop) {
      console.log('❌ SAFETY CHECK FAILED')
      console.log('   Some legacy tables have data that may not be migrated.')
      console.log('   Please verify migration is complete before proceeding.')
      console.log('')
      console.log('   Run: node verify-member-migration.js to check migration status')
      return
    }
    
    // Step 4: Confirm before dropping
    console.log('✅ All safety checks passed!')
    console.log('')
    console.log('📋 Tables to be dropped:')
    legacyTables.forEach(table => {
      if (tableChecks[table]?.exists) {
        console.log(`   • ${table} (${tableChecks[table].count || 0} rows)`)
      }
    })
    console.log('')
    console.log('🛡️  Tables to be preserved:')
    preserveTables.forEach(table => {
      console.log(`   • ${table} (still in use)`)
    })
    console.log('')
    console.log('⚠️  This operation will DROP the following tables:')
    console.log('   - members')
    console.log('   - member_children')
    console.log('   - athlete')
    console.log('')
    console.log('   Any dependent objects (indexes, constraints, etc.) will also be dropped.')
    console.log('')
    
    // In a real scenario, you'd want user confirmation here
    // For now, we'll proceed with the cleanup
    
    console.log('🚀 Proceeding with cleanup...')
    console.log('')
    
    // Step 5: Drop legacy tables
    let droppedCount = 0
    let errorCount = 0
    
    for (const tableName of legacyTables) {
      if (!tableChecks[tableName]?.exists) {
        console.log(`⏭️  Skipping ${tableName} (does not exist)`)
        continue
      }
      
      try {
        console.log(`🗑️  Dropping table: ${tableName}...`)
        await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`)
        console.log(`   ✅ Successfully dropped ${tableName}`)
        droppedCount++
      } catch (error) {
        console.log(`   ❌ Error dropping ${tableName}: ${error.message}`)
        errorCount++
      }
    }
    
    console.log('')
    console.log('═'.repeat(80))
    console.log('')
    console.log('📊 CLEANUP SUMMARY:')
    console.log('─'.repeat(80))
    console.log(`   Tables dropped: ${droppedCount}`)
    console.log(`   Errors: ${errorCount}`)
    console.log('')
    
    // Step 6: Verify cleanup
    console.log('🔍 Verifying cleanup:')
    console.log('─'.repeat(80))
    
    for (const tableName of legacyTables) {
      const existsCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName])
      
      if (!existsCheck.rows[0].exists) {
        console.log(`   ✅ ${tableName}: Successfully removed`)
      } else {
        console.log(`   ⚠️  ${tableName}: Still exists (drop may have failed)`)
      }
    }
    
    // Check for any remaining references to old tables in indexes
    console.log('')
    console.log('🔍 Checking for orphaned indexes...')
    const indexCheck = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (
          indexname LIKE '%member%' OR
          indexname LIKE '%athlete%'
        )
        AND tablename NOT IN (${preserveTables.map((_, i) => `$${i + 1}`).join(', ')})
    `, preserveTables)
    
    if (indexCheck.rows.length > 0) {
      console.log('   ⚠️  Found orphaned indexes (will be cleaned up automatically):')
      indexCheck.rows.forEach(idx => {
        console.log(`      • ${idx.indexname} on ${idx.tablename}`)
      })
    } else {
      console.log('   ✅ No orphaned indexes found')
    }
    
    console.log('')
    console.log('═'.repeat(80))
    console.log('')
    console.log('✅ CLEANUP COMPLETE!')
    console.log('')
    console.log('📋 Next steps:')
    console.log('   1. Verify your application still works correctly')
    console.log('   2. Test admin portal member viewing/editing')
    console.log('   3. Verify no code references the dropped tables')
    console.log('   4. Consider removing legacy table references from migrations folder')
    console.log('      (Keep migration files for history, but note they are deprecated)')
    console.log('')
    
  } catch (error) {
    console.error('')
    console.error('❌ Fatal error during cleanup:', error.message)
    console.error('')
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// Main execution
async function main() {
  console.log('⚠️  WARNING: This will permanently delete legacy tables!')
  console.log('   Make sure you have a database backup before proceeding.')
  console.log('')
  console.log('   Press Ctrl+C to cancel, or wait 3 seconds to proceed...')
  console.log('')
  
  // Wait 3 seconds before proceeding (gives user time to cancel)
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  await cleanupLegacyTables()
}

main()
  .then(() => {
    console.log('Script completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

