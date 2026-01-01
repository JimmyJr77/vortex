import pkg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const { Pool } = pkg
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vortex_athletics',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function seedEvents() {
  try {
    console.log('🌱 Seeding events...')
    
    // Check if events already exist
    const existingCount = await pool.query('SELECT COUNT(*) FROM events')
    if (parseInt(existingCount.rows[0].count) > 0) {
      console.log(`⚠️  Found ${existingCount.rows[0].count} existing events. Skipping seed.`)
      console.log('   To re-seed, delete existing events first or use --force flag.')
      await pool.end()
      return
    }
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'seed_events.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    // Remove ON CONFLICT clauses since we're checking first
    const cleanedSql = sql.replace(/ ON CONFLICT DO NOTHING;/g, ';')
    
    // Execute the SQL
    await pool.query(cleanedSql)
    
    console.log('✅ Events seeded successfully!')
    
    // Verify by counting events
    const result = await pool.query('SELECT COUNT(*) FROM events')
    console.log(`📊 Total events in database: ${result.rows[0].count}`)
    
  } catch (error) {
    console.error('❌ Error seeding events:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seedEvents()

