import pg from 'pg'
import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables - try .env.local first, then .env
const envLocalPath = join(__dirname, '.env.local')
if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
  console.log('📝 Loaded .env.local')
} else {
  dotenv.config()
  console.log('📝 Loaded .env')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vortex_athletics',
  password: process.env.DB_PASSWORD || 'vortex2024',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DATABASE_URL || process.env.DB_URL ? { rejectUnauthorized: false } : false
})

async function checkProductionRegistrations() {
  const client = await pool.connect()
  try {
    console.log('🔍 Checking registrations in database...\n')
    
    // Show which database we're connecting to
    const hasDatabaseUrl = process.env.DATABASE_URL || process.env.DB_URL
    if (hasDatabaseUrl) {
      const url = new URL(hasDatabaseUrl.replace('postgresql://', 'https://'))
      console.log(`📍 Database: ${url.hostname} (Production via DATABASE_URL)`)
    } else {
      console.log(`📍 Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`)
      console.log(`   Database Name: ${process.env.DB_NAME || 'vortex_athletics'}`)
    }
    console.log('')
    
    // Check if archived column exists
    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'registrations' AND column_name = 'archived'
    `)
    
    const hasArchivedColumn = columnCheck.rows.length > 0
    console.log(`📊 Archived column exists: ${hasArchivedColumn ? '✅ Yes' : '❌ No'}\n`)
    
    // Get total count
    const countResult = await client.query('SELECT COUNT(*) as total FROM registrations')
    const total = parseInt(countResult.rows[0].total)
    console.log(`📈 Total registrations: ${total}\n`)
    
    if (total === 0) {
      console.log('❌ No registrations found in database\n')
      return
    }
    
    // Get all registrations
    const query = hasArchivedColumn
      ? `SELECT id, first_name, last_name, email, phone, athlete_age, interests, interests_array, class_types, child_ages, message, created_at, archived FROM registrations ORDER BY created_at DESC`
      : `SELECT id, first_name, last_name, email, phone, athlete_age, interests, interests_array, class_types, child_ages, message, created_at FROM registrations ORDER BY created_at DESC`
    
    const result = await client.query(query)
    
    console.log(`✅ Found ${result.rows.length} registration(s):\n`)
    console.log('='.repeat(100))
    
    result.rows.forEach((reg, idx) => {
      console.log(`\n${idx + 1}. ID: ${reg.id}`)
      console.log(`   Name: ${reg.first_name} ${reg.last_name}`)
      console.log(`   Email: ${reg.email}`)
      console.log(`   Phone: ${reg.phone || 'N/A'}`)
      console.log(`   Age: ${reg.athlete_age || 'N/A'}`)
      if (reg.interests_array && reg.interests_array.length > 0) {
        console.log(`   Interests: ${reg.interests_array.join(', ')}`)
      } else if (reg.interests) {
        console.log(`   Interests: ${reg.interests}`)
      }
      if (reg.class_types && reg.class_types.length > 0) {
        console.log(`   Class Types: ${reg.class_types.join(', ')}`)
      }
      if (reg.child_ages && reg.child_ages.length > 0) {
        console.log(`   Child Ages: ${reg.child_ages.join(', ')}`)
      }
      if (reg.message) {
        console.log(`   Message: ${reg.message.substring(0, 100)}${reg.message.length > 100 ? '...' : ''}`)
      }
      console.log(`   Created: ${reg.created_at}`)
      if (hasArchivedColumn) {
        console.log(`   Archived: ${reg.archived ? 'Yes' : 'No'}`)
      }
      console.log('-'.repeat(100))
    })
    
    // Show registrations after Dec 31, 2025
    console.log('\n📅 Registrations after Dec 31, 2025:')
    const recentResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM registrations 
      WHERE created_at > '2025-12-31'
    `)
    console.log(`   Count: ${recentResult.rows[0].count}`)
    
    if (parseInt(recentResult.rows[0].count) > 0) {
      const recentRegs = await client.query(`
        SELECT id, first_name, last_name, email, created_at 
        FROM registrations 
        WHERE created_at > '2025-12-31'
        ORDER BY created_at DESC
      `)
      recentRegs.rows.forEach(reg => {
        console.log(`   - ${reg.first_name} ${reg.last_name} (${reg.email}) - ${reg.created_at}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  } finally {
    client.release()
    await pool.end()
  }
}

checkProductionRegistrations().catch(console.error)

