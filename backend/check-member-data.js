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

async function checkMemberData() {
  const client = await pool.connect()
  try {
    console.log('🔍 Checking member table data in detail...')
    console.log('')
    
    // Get all members with all columns
    const membersResult = await client.query('SELECT * FROM member')
    
    console.log(`📊 Total members: ${membersResult.rows.length}`)
    console.log('')
    
    if (membersResult.rows.length > 0) {
      console.log('Member details:')
      console.log('─'.repeat(80))
      
      membersResult.rows.forEach((member, index) => {
        console.log(`\n${index + 1}. Member ID: ${member.id}`)
        console.log(`   Name: ${member.first_name} ${member.last_name}`)
        console.log(`   Email: ${member.email || 'NULL'}`)
        console.log(`   Phone: ${member.phone || 'NULL'}`)
        console.log(`   Facility ID: ${member.facility_id}`)
        console.log(`   Family ID: ${member.family_id || 'NULL'}`)
        console.log(`   Status: ${member.status || 'NULL'}`)
        console.log(`   is_active: ${member.is_active} (type: ${typeof member.is_active})`)
        console.log(`   family_is_active: ${member.family_is_active} (type: ${typeof member.family_is_active})`)
        console.log(`   Date of birth: ${member.date_of_birth || 'NULL'}`)
        console.log(`   Username: ${member.username || 'NULL'}`)
        console.log(`   Created: ${member.created_at}`)
      })
      
      // Test the exact query the API uses
      console.log('')
      console.log('🔍 Testing API query logic:')
      console.log('─'.repeat(80))
      
      // Check facility
      const facilityCheck = await client.query('SELECT id FROM facility LIMIT 1')
      const facilityId = facilityCheck.rows.length > 0 ? facilityCheck.rows[0].id : null
      console.log(`Facility ID from database: ${facilityId}`)
      
      // Test query without showArchived filter
      const activeQuery = `
        SELECT 
          m.id,
          m.first_name,
          m.last_name,
          m.email,
          m.is_active,
          m.facility_id,
          m.status
        FROM member m
        WHERE m.facility_id = $1
        AND m.is_active = TRUE
      `
      
      if (facilityId) {
        const activeResult = await client.query(activeQuery, [facilityId])
        console.log(`\nQuery with facility_id=${facilityId} AND is_active=TRUE: ${activeResult.rows.length} results`)
        
        if (activeResult.rows.length > 0) {
          activeResult.rows.forEach(row => {
            console.log(`  → ${row.first_name} ${row.last_name} (ID: ${row.id}, active: ${row.is_active})`)
          })
        } else {
          console.log('  ⚠️  No results! Checking why...')
          
          // Check if facility_id filter is the issue
          const allMembers = await client.query('SELECT id, first_name, last_name, facility_id, is_active FROM member')
          console.log(`\nAll members (no filters):`)
          allMembers.rows.forEach(row => {
            console.log(`  → ${row.first_name} ${row.last_name} (ID: ${row.id}, facility_id: ${row.facility_id}, is_active: ${row.is_active})`)
          })
          
          // Check if is_active is actually TRUE
          const isActiveCheck = await client.query('SELECT id, first_name, last_name, is_active::text as active_text FROM member')
          console.log(`\nis_active values (as text):`)
          isActiveCheck.rows.forEach(row => {
            console.log(`  → ${row.first_name} ${row.last_name}: "${row.active_text}"`)
          })
        }
      } else {
        console.log('  ⚠️  No facility found in database!')
      }
      
      // Test query without facility filter
      const noFacilityQuery = `
        SELECT 
          m.id,
          m.first_name,
          m.last_name,
          m.email,
          m.is_active,
          m.facility_id
        FROM member m
        WHERE m.is_active = TRUE
      `
      
      const noFacilityResult = await client.query(noFacilityQuery)
      console.log(`\nQuery WITHOUT facility_id filter AND is_active=TRUE: ${noFacilityResult.rows.length} results`)
      
      // Test query with showArchived (no is_active filter)
      const archivedQuery = `SELECT id, first_name, last_name, is_active FROM member WHERE facility_id = $1`
      if (facilityId) {
        const archivedResult = await client.query(archivedQuery, [facilityId])
        console.log(`\nQuery with facility_id=${facilityId} (showArchived=true, no is_active filter): ${archivedResult.rows.length} results`)
      }
      
    } else {
      console.log('⚠️  No members found in member table!')
    }
    
    console.log('')
    console.log('─'.repeat(80))
    console.log('')
    console.log('📋 Checking app_user table (legacy):')
    const appUserResult = await client.query('SELECT id, email, full_name, is_active, facility_id FROM app_user')
    console.log(`   Rows: ${appUserResult.rows.length}`)
    appUserResult.rows.forEach(row => {
      console.log(`   → ${row.full_name} (${row.email}) - ID: ${row.id}, Active: ${row.is_active}, Facility: ${row.facility_id}`)
    })
    
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

checkMemberData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })


