import pg from 'pg'
import dotenv from 'dotenv'
const { Pool } = pg
dotenv.config({ path: '.env.local' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'vortex_athletics',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'vortex2024',
  ssl: process.env.DATABASE_URL || process.env.DB_URL ? { rejectUnauthorized: false } : false
})

async function checkRegistrations() {
  const client = await pool.connect()
  try {
    console.log('🔍 Checking registrations table...\n')
    
    // Check if archived column exists
    const columnCheck = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'registrations' AND column_name = 'archived'
    `)
    
    if (columnCheck.rows.length === 0) {
      console.log('⚠️  WARNING: archived column does NOT exist in registrations table!')
      console.log('   This could cause the admin portal to not show registrations.\n')
    } else {
      console.log('✅ archived column exists')
      console.log(`   Type: ${columnCheck.rows[0].data_type}`)
      console.log(`   Default: ${columnCheck.rows[0].column_default}\n`)
    }
    
    // Get all columns in registrations table
    const allColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'registrations'
      ORDER BY ordinal_position
    `)
    console.log('📋 Registrations table columns:')
    allColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`)
    })
    console.log('')
    
    // Search for registrations with "bib" in email or name
    console.log('🔎 Searching for registrations with "bib" in email or name...\n')
    const bibSearch = await client.query(`
      SELECT 
        id,
        first_name,
        last_name,
        email,
        phone,
        created_at,
        archived
      FROM registrations
      WHERE 
        LOWER(email) LIKE '%bib%' 
        OR LOWER(first_name) LIKE '%bib%'
        OR LOWER(last_name) LIKE '%bib%'
      ORDER BY created_at DESC
    `)
    
    if (bibSearch.rows.length === 0) {
      console.log('❌ No registrations found with "bib" in email or name\n')
    } else {
      console.log(`✅ Found ${bibSearch.rows.length} registration(s):\n`)
      bibSearch.rows.forEach((reg, idx) => {
        console.log(`${idx + 1}. ID: ${reg.id}`)
        console.log(`   Name: ${reg.first_name} ${reg.last_name}`)
        console.log(`   Email: ${reg.email}`)
        console.log(`   Phone: ${reg.phone || 'N/A'}`)
        console.log(`   Created: ${reg.created_at}`)
        console.log(`   Archived: ${reg.archived !== null ? reg.archived : 'NULL (column may not exist)'}`)
        console.log('')
      })
    }
    
    // Get all recent registrations
    console.log('📊 Recent registrations (last 10):\n')
    const recentRegs = await client.query(`
      SELECT 
        id,
        first_name,
        last_name,
        email,
        phone,
        created_at,
        archived
      FROM registrations
      ORDER BY created_at DESC
      LIMIT 10
    `)
    
    if (recentRegs.rows.length === 0) {
      console.log('❌ No registrations found in database\n')
    } else {
      recentRegs.rows.forEach((reg, idx) => {
        console.log(`${idx + 1}. ${reg.first_name} ${reg.last_name} (${reg.email})`)
        console.log(`   Created: ${reg.created_at}`)
        console.log(`   Archived: ${reg.archived !== null ? reg.archived : 'NULL'}`)
        console.log('')
      })
    }
    
    // Test the exact query used by admin portal
    console.log('🧪 Testing admin portal query (WHERE archived IS NOT true):\n')
    try {
      const adminQuery = await client.query(`
        SELECT * FROM registrations 
        WHERE archived IS NOT true
        ORDER BY created_at DESC
      `)
      console.log(`✅ Query succeeded: Found ${adminQuery.rows.length} registration(s)`)
      if (adminQuery.rows.length > 0) {
        console.log('   Sample:')
        adminQuery.rows.slice(0, 3).forEach(reg => {
          console.log(`   - ${reg.first_name} ${reg.last_name} (${reg.email})`)
        })
      }
    } catch (queryError) {
      console.log(`❌ Query failed: ${queryError.message}`)
      console.log('   This is why registrations are not showing in admin portal!')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  } finally {
    client.release()
    await pool.end()
  }
}

checkRegistrations()

