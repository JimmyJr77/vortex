import pg from 'pg'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const { Pool } = pg
dotenv.config({ path: '.env.local' })

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'vortex_athletics',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'vortex2024',
  ssl: process.env.DATABASE_URL || process.env.DB_URL ? { rejectUnauthorized: false } : false
})

async function runMigration() {
  const client = await pool.connect()
  try {
    console.log('🔄 Running migration: Add archived column to registrations table...\n')
    
    // Check if column already exists
    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'registrations' AND column_name = 'archived'
    `)
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ archived column already exists in registrations table')
      return
    }
    
    // Add the column
    await client.query(`
      ALTER TABLE registrations ADD COLUMN archived BOOLEAN DEFAULT FALSE
    `)
    
    console.log('✅ Successfully added archived column to registrations table')
    console.log('   Default value: FALSE')
    console.log('   All existing rows have been set to archived = FALSE\n')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration().catch(console.error)

