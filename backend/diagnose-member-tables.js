import pg from 'pg'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables - try .env.local first, then .env
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

async function diagnoseMemberTables() {
  const client = await pool.connect()
  try {
    console.log('🔍 DIAGNOSING MEMBER-RELATED TABLES IN DATABASE')
    console.log('═'.repeat(80))
    console.log('')
    
    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
    
    const allTables = tablesResult.rows.map(r => r.table_name)
    console.log(`📊 Total tables found: ${allTables.length}`)
    console.log('')
    
    // Identify member-related tables
    const memberRelatedTables = [
      'member', 'members', 'app_user', 'athlete', 'athletes', 'user', 'users',
      'family', 'family_guardian', 'guardian', 'member_children', 'parent_guardian_authority'
    ]
    
    const existingMemberTables = allTables.filter(t => 
      memberRelatedTables.includes(t.toLowerCase()) ||
      t.toLowerCase().includes('member') ||
      t.toLowerCase().includes('athlete') ||
      t.toLowerCase().includes('user') ||
      t.toLowerCase().includes('guardian')
    )
    
    console.log('🔴 MEMBER/USER/ATHLETE/FAMILY RELATED TABLES FOUND:')
    console.log('─'.repeat(80))
    
    if (existingMemberTables.length === 0) {
      console.log('  ⚠️  No member-related tables found!')
    } else {
      for (const tableName of existingMemberTables) {
        console.log(`\n  📋 Table: ${tableName}`)
        console.log('     ' + '─'.repeat(70))
        
        // Get row count
        try {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`)
          const count = parseInt(countResult.rows[0].count)
          console.log(`     Rows: ${count}`)
          
          // Get column info
          const columnsResult = await client.query(`
            SELECT 
              column_name, 
              data_type, 
              is_nullable,
              column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = $1
            ORDER BY ordinal_position
          `, [tableName])
          
          if (columnsResult.rows.length > 0) {
            console.log(`     Columns (${columnsResult.rows.length}):`)
            columnsResult.rows.forEach(col => {
              const nullable = col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'
              console.log(`       • ${col.column_name} (${col.data_type}) ${nullable}`)
            })
          }
          
          // Get sample data
          if (count > 0) {
            try {
              const sampleResult = await client.query(`SELECT * FROM "${tableName}" LIMIT 2`)
              if (sampleResult.rows.length > 0) {
                console.log(`     Sample data (first row):`)
                const firstRow = sampleResult.rows[0]
                Object.keys(firstRow).slice(0, 10).forEach(key => {
                  const value = firstRow[key]
                  const displayValue = value === null ? 'NULL' : 
                                     typeof value === 'object' ? JSON.stringify(value).substring(0, 50) :
                                     String(value).substring(0, 50)
                  console.log(`       ${key}: ${displayValue}`)
                })
                if (Object.keys(firstRow).length > 10) {
                  console.log(`       ... (${Object.keys(firstRow).length - 10} more columns)`)
                }
              }
            } catch (sampleError) {
              console.log(`     ⚠️  Could not fetch sample data: ${sampleError.message}`)
            }
          }
        } catch (error) {
          console.log(`     ❌ Error querying table: ${error.message}`)
        }
      }
    }
    
    console.log('')
    console.log('═'.repeat(80))
    console.log('')
    console.log('🔍 CHECKING FOR THE UNIFIED MEMBER TABLE:')
    console.log('─'.repeat(80))
    
    const hasMemberTable = existingMemberTables.includes('member')
    const hasOldMembersTable = existingMemberTables.includes('members')
    const hasAppUserTable = existingMemberTables.includes('app_user')
    const hasAthleteTable = existingMemberTables.includes('athlete')
    
    console.log(`  ✅ Unified 'member' table exists: ${hasMemberTable ? 'YES' : 'NO'}`)
    console.log(`  ⚠️  Old 'members' table exists: ${hasOldMembersTable ? 'YES (LEGACY - should be dropped)' : 'NO'}`)
    console.log(`  ⚠️  Old 'app_user' table exists: ${hasAppUserTable ? 'YES (LEGACY - should be migrated)' : 'NO'}`)
    console.log(`  ⚠️  Old 'athlete' table exists: ${hasAthleteTable ? 'YES (LEGACY - should be migrated)' : 'NO'}`)
    
    if (hasMemberTable) {
      console.log('')
      console.log('  📊 MEMBER TABLE STATISTICS:')
      try {
        const statsResult = await client.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_active = TRUE) as active,
            COUNT(*) FILTER (WHERE is_active = FALSE) as inactive,
            COUNT(*) FILTER (WHERE family_id IS NOT NULL) as has_family,
            COUNT(*) FILTER (WHERE email IS NOT NULL) as has_email,
            COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL) as has_dob
          FROM member
        `)
        
        const stats = statsResult.rows[0]
        console.log(`     Total members: ${stats.total}`)
        console.log(`     Active: ${stats.active}`)
        console.log(`     Inactive/Archived: ${stats.inactive}`)
        console.log(`     With family: ${stats.has_family}`)
        console.log(`     With email: ${stats.has_email}`)
        console.log(`     With date of birth: ${stats.has_dob}`)
        
        // Check for facility_id requirement
        const facilityCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'member'
            AND column_name = 'facility_id'
          )
        `)
        
        if (facilityCheck.rows[0].exists) {
          const facilityMembersCheck = await client.query(`
            SELECT 
              COUNT(*) FILTER (WHERE facility_id IS NOT NULL) as with_facility,
              COUNT(*) FILTER (WHERE facility_id IS NULL) as without_facility
            FROM member
          `)
          console.log(`     With facility_id: ${facilityMembersCheck.rows[0].with_facility}`)
          console.log(`     Without facility_id: ${facilityMembersCheck.rows[0].without_facility}`)
          
          // Check if there's a facility in the database
          const facilityExists = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'facility'
            )
          `)
          
          if (facilityExists.rows[0].exists) {
            const facilityCount = await client.query('SELECT COUNT(*) as count FROM facility')
            const facilityIdCheck = await client.query('SELECT id FROM facility LIMIT 1')
            
            console.log(`     Facilities in database: ${facilityCount.rows[0].count}`)
            if (facilityIdCheck.rows.length > 0) {
              console.log(`     First facility ID: ${facilityIdCheck.rows[0].id}`)
            }
          }
        }
      } catch (error) {
        console.log(`     ❌ Error getting statistics: ${error.message}`)
      }
    }
    
    // Check for data in old tables
    if (hasOldMembersTable || hasAppUserTable || hasAthleteTable) {
      console.log('')
      console.log('⚠️  LEGACY TABLES WITH DATA:')
      console.log('─'.repeat(80))
      
      if (hasOldMembersTable) {
        try {
          const oldMembersCount = await client.query('SELECT COUNT(*) as count FROM members')
          console.log(`  • 'members' table: ${oldMembersCount.rows[0].count} rows`)
          if (parseInt(oldMembersCount.rows[0].count) > 0) {
            console.log(`    ⚠️  This data should be migrated to 'member' table!`)
          }
        } catch (e) {
          console.log(`  • 'members' table: Error - ${e.message}`)
        }
      }
      
      if (hasAppUserTable) {
        try {
          const appUserCount = await client.query('SELECT COUNT(*) as count FROM app_user')
          console.log(`  • 'app_user' table: ${appUserCount.rows[0].count} rows`)
          if (parseInt(appUserCount.rows[0].count) > 0) {
            console.log(`    ⚠️  This data should be migrated to 'member' table!`)
          }
        } catch (e) {
          console.log(`  • 'app_user' table: Error - ${e.message}`)
        }
      }
      
      if (hasAthleteTable) {
        try {
          const athleteCount = await client.query('SELECT COUNT(*) as count FROM athlete')
          console.log(`  • 'athlete' table: ${athleteCount.rows[0].count} rows`)
          if (parseInt(athleteCount.rows[0].count) > 0) {
            console.log(`    ⚠️  This data should be migrated to 'member' table!`)
          }
        } catch (e) {
          console.log(`  • 'athlete' table: Error - ${e.message}`)
        }
      }
    }
    
    console.log('')
    console.log('═'.repeat(80))
    console.log('')
    console.log('✅ Diagnosis completed!')
    console.log('')
    
    // Summary recommendations
    console.log('📋 RECOMMENDATIONS:')
    console.log('─'.repeat(80))
    
    if (!hasMemberTable) {
      console.log('  ❌ CRITICAL: Unified member table does not exist!')
      console.log('     → Run migration: 005_unified_member_table.sql')
    } else {
      console.log('  ✅ Unified member table exists')
      
      if (hasOldMembersTable || hasAppUserTable || hasAthleteTable) {
        console.log('  ⚠️  Legacy tables still exist - verify migration completed successfully')
        console.log('     → If migration is complete and data is in member table, consider dropping legacy tables')
        console.log('     → Use migration: drop_legacy_members_tables.sql (with caution!)')
      }
      
      // Check if member table is being filtered incorrectly
      try {
        const activeCheck = await client.query('SELECT COUNT(*) as count FROM member WHERE is_active = TRUE')
        const totalCheck = await client.query('SELECT COUNT(*) as count FROM member')
        
        if (parseInt(activeCheck.rows[0].count) === 0 && parseInt(totalCheck.rows[0].count) > 0) {
          console.log('  ⚠️  WARNING: Member table has data but all members are inactive/archived!')
          console.log('     → Check if showArchived=true parameter is needed in admin portal')
        }
      } catch (e) {
        // Ignore
      }
    }
    
  } catch (error) {
    console.error('')
    console.error('❌ Error diagnosing tables:', error.message)
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

diagnoseMemberTables()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })


