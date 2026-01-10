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
} else {
  dotenv.config()
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

async function verifyMigration() {
  const client = await pool.connect()
  try {
    console.log('🔍 VERIFYING MEMBER DATA MIGRATION')
    console.log('═'.repeat(80))
    console.log('')
    
    // Check app_user table
    const appUserResult = await client.query('SELECT id, email, full_name, is_active, facility_id FROM app_user')
    console.log(`📊 app_user table: ${appUserResult.rows.length} rows`)
    
    // Check member table
    const memberResult = await client.query('SELECT id, email, first_name, last_name, is_active, facility_id FROM member')
    console.log(`📊 member table: ${memberResult.rows.length} rows`)
    
    console.log('')
    console.log('🔍 Checking if app_user data is in member table:')
    console.log('─'.repeat(80))
    
    for (const appUser of appUserResult.rows) {
      // Try to find by ID first
      const byId = memberResult.rows.find(m => m.id === appUser.id)
      
      // Try to find by email
      const byEmail = memberResult.rows.find(m => m.email === appUser.email)
      
      // Try to find by name (split full_name)
      const nameParts = appUser.full_name.split(' ')
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ')
      const byName = memberResult.rows.find(m => 
        m.first_name === firstName && m.last_name === lastName
      )
      
      console.log(`\n  app_user ID ${appUser.id}: ${appUser.full_name} (${appUser.email})`)
      console.log(`    Found by ID in member table: ${byId ? 'YES ✅' : 'NO ❌'}`)
      console.log(`    Found by email in member table: ${byEmail ? 'YES ✅' : 'NO ❌'}`)
      console.log(`    Found by name in member table: ${byName ? 'YES ✅' : 'NO ❌'}`)
      
      if (!byId && !byEmail && !byName) {
        console.log(`    ⚠️  WARNING: This app_user record is NOT in member table!`)
        console.log(`       → Should be migrated!`)
      } else if (byId) {
        console.log(`    ✅ Already migrated (same ID: ${byId.id})`)
      }
    }
    
    // Check athlete table
    const athleteResult = await client.query('SELECT id, first_name, last_name, date_of_birth, family_id, user_id FROM athlete')
    console.log('')
    console.log(`📊 athlete table: ${athleteResult.rows.length} rows`)
    
    if (athleteResult.rows.length > 0) {
      console.log('\n🔍 Checking if athlete data is in member table:')
      console.log('─'.repeat(80))
      
      for (const athlete of athleteResult.rows) {
        // Check by user_id (if linked to app_user/member)
        let found = null
        if (athlete.user_id) {
          found = memberResult.rows.find(m => m.id === athlete.user_id)
          if (found) {
            console.log(`\n  athlete ID ${athlete.id}: ${athlete.first_name} ${athlete.last_name}`)
            console.log(`    Found in member table via user_id=${athlete.user_id}: YES ✅`)
            continue
          }
        }
        
        // Check by name + DOB + family_id
        found = memberResult.rows.find(m => 
          m.first_name === athlete.first_name &&
          m.last_name === athlete.last_name &&
          (m.date_of_birth ? new Date(m.date_of_birth).getTime() === new Date(athlete.date_of_birth).getTime() : false) &&
          (m.family_id === athlete.family_id || (m.family_id === null && athlete.family_id === null))
        )
        
        console.log(`\n  athlete ID ${athlete.id}: ${athlete.first_name} ${athlete.last_name}`)
        console.log(`    Found in member table: ${found ? 'YES ✅' : 'NO ❌'}`)
        
        if (!found) {
          console.log(`    ⚠️  WARNING: This athlete record is NOT in member table!`)
          console.log(`       → Should be migrated!`)
        }
      }
    }
    
    // Check old members table
    const oldMembersResult = await client.query('SELECT COUNT(*) as count FROM members')
    const oldMembersCount = parseInt(oldMembersResult.rows[0].count)
    
    if (oldMembersCount > 0) {
      console.log('')
      console.log(`⚠️  WARNING: Old 'members' table has ${oldMembersCount} rows!`)
      console.log('   → These should be migrated to the unified member table!')
    } else {
      console.log('')
      console.log(`✅ Old 'members' table is empty (can be safely dropped)`)
    }
    
    // Summary
    console.log('')
    console.log('═'.repeat(80))
    console.log('')
    console.log('📋 MIGRATION STATUS SUMMARY:')
    console.log('─'.repeat(80))
    
    const allMigrated = 
      appUserResult.rows.every(au => 
        memberResult.rows.some(m => m.id === au.id || m.email === au.email)
      ) &&
      athleteResult.rows.every(a => 
        a.user_id ? memberResult.rows.some(m => m.id === a.user_id) :
        memberResult.rows.some(m => 
          m.first_name === a.first_name &&
          m.last_name === a.last_name
        )
      ) &&
      oldMembersCount === 0
    
    if (allMigrated) {
      console.log('  ✅ All data appears to be migrated to unified member table!')
      console.log('  ✅ Legacy tables can be safely dropped (after verification)')
    } else {
      console.log('  ⚠️  Some data may not be fully migrated!')
      console.log('  → Review the details above')
      console.log('  → Consider re-running migration: 005_unified_member_table.sql')
    }
    
    console.log('')
    console.log('📋 RECOMMENDED ACTIONS:')
    console.log('─'.repeat(80))
    console.log('  1. Verify all app_user records are in member table (check above)')
    console.log('  2. Verify all athlete records are in member table (check above)')
    console.log('  3. Verify old members table is empty')
    console.log('  4. If all data is migrated, drop legacy tables:')
    console.log('     - DROP TABLE IF EXISTS member_children CASCADE;')
    console.log('     - DROP TABLE IF EXISTS members CASCADE;')
    console.log('     - DROP TABLE IF EXISTS athlete CASCADE;')
    console.log('     - DROP TABLE IF EXISTS app_user CASCADE; (CAUTION: verify first!)')
    console.log('')
    console.log('  ⚠️  IMPORTANT: Backup database before dropping tables!')
    
  } catch (error) {
    console.error('')
    console.error('❌ Error:', error.message)
    console.error('')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

verifyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })


