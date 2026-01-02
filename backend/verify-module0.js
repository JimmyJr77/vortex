// Verification script for Module 0 migration
import pg from 'pg'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Load environment variables
const envPaths = [
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), 'backend', '.env.local'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'backend', '.env')
]

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
    break
  }
}
dotenv.config()

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

async function verifyModule0() {
  const client = await pool.connect()
  try {
    console.log('\n🔍 Verifying Module 0 Migration...\n')
    
    const results = {
      userRoleEnum: false,
      facilityTable: false,
      facilityData: false,
      appUserTable: false,
      migratedAdmins: false,
      migratedMembers: false
    }
    
    // Check user_role enum
    try {
      const enumCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'user_role'
        )
      `)
      results.userRoleEnum = enumCheck.rows[0].exists
      console.log(`${results.userRoleEnum ? '✅' : '❌'} user_role enum exists`)
    } catch (error) {
      console.log(`❌ Error checking user_role enum: ${error.message}`)
    }
    
    // Check facility table
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'facility'
        )
      `)
      results.facilityTable = tableCheck.rows[0].exists
      console.log(`${results.facilityTable ? '✅' : '❌'} facility table exists`)
    } catch (error) {
      console.log(`❌ Error checking facility table: ${error.message}`)
    }
    
    // Check facility data
    if (results.facilityTable) {
      try {
        const facilityData = await client.query('SELECT * FROM facility')
        results.facilityData = facilityData.rows.length > 0
        console.log(`${results.facilityData ? '✅' : '❌'} Facility data exists (${facilityData.rows.length} facility/ies)`)
        if (facilityData.rows.length > 0) {
          facilityData.rows.forEach(f => {
            console.log(`   - ${f.name} (ID: ${f.id}, Timezone: ${f.timezone})`)
          })
        }
      } catch (error) {
        console.log(`❌ Error checking facility data: ${error.message}`)
      }
    }
    
    // Check app_user table
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'app_user'
        )
      `)
      results.appUserTable = tableCheck.rows[0].exists
      console.log(`${results.appUserTable ? '✅' : '❌'} app_user table exists`)
    } catch (error) {
      console.log(`❌ Error checking app_user table: ${error.message}`)
    }
    
    // Check migrated admins
    if (results.appUserTable) {
      try {
        const adminCheck = await client.query(`
          SELECT COUNT(*) as count FROM app_user WHERE role = 'OWNER_ADMIN'
        `)
        const adminCount = parseInt(adminCheck.rows[0].count)
        results.migratedAdmins = adminCount > 0
        console.log(`${results.migratedAdmins ? '✅' : '⚠️ '} Migrated admins: ${adminCount}`)
        
        if (adminCount > 0) {
          const admins = await client.query(`
            SELECT id, email, full_name, role, is_active 
            FROM app_user 
            WHERE role = 'OWNER_ADMIN' 
            LIMIT 5
          `)
          admins.rows.forEach(admin => {
            console.log(`   - ${admin.full_name} (${admin.email}) - ${admin.is_active ? 'Active' : 'Inactive'}`)
          })
        }
      } catch (error) {
        console.log(`❌ Error checking migrated admins: ${error.message}`)
      }
    }
    
    // Check migrated members
    if (results.appUserTable) {
      try {
        const memberCheck = await client.query(`
          SELECT COUNT(*) as count FROM app_user WHERE role = 'PARENT_GUARDIAN'
        `)
        const memberCount = parseInt(memberCheck.rows[0].count)
        results.migratedMembers = memberCount > 0
        console.log(`${results.migratedMembers ? '✅' : '⚠️ '} Migrated members: ${memberCount}`)
        
        if (memberCount > 0) {
          const members = await client.query(`
            SELECT id, email, full_name, role, is_active 
            FROM app_user 
            WHERE role = 'PARENT_GUARDIAN' 
            LIMIT 5
          `)
          members.rows.forEach(member => {
            console.log(`   - ${member.full_name} (${member.email}) - ${member.is_active ? 'Active' : 'Inactive'}`)
          })
        }
      } catch (error) {
        console.log(`❌ Error checking migrated members: ${error.message}`)
      }
    }
    
    // Summary
    console.log('\n📊 Verification Summary:')
    const allPassed = Object.values(results).every(r => r === true)
    const criticalPassed = results.userRoleEnum && results.facilityTable && results.appUserTable
    
    if (allPassed) {
      console.log('✅ All checks passed! Module 0 migration is complete.')
    } else if (criticalPassed) {
      console.log('⚠️  Core tables created, but some data migration may be incomplete.')
      console.log('   This is OK if you have no existing admins/members to migrate.')
    } else {
      console.log('❌ Module 0 migration appears incomplete.')
      console.log('   Please restart your server to run the migration.')
    }
    
    console.log('')
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message)
    if (error.code) {
      console.error('Error code:', error.code)
    }
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

verifyModule0().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

