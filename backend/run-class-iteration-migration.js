import dotenv from 'dotenv'
import pkg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

async function runMigration() {
  const client = await pool.connect()
  
  try {
    console.log('🔄 Running class_iteration table migration...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_class_iteration_table.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    await client.query('BEGIN')
    
    // Execute the migration
    await client.query(migrationSQL)
    
    await client.query('COMMIT')
    
    console.log('✅ Migration completed successfully!')
    console.log('✅ class_iteration table created')
    
    // Verify the table exists
    const checkResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'class_iteration'
    `)
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Verified: class_iteration table exists')
    } else {
      console.error('❌ Warning: Table verification failed')
    }
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration()
  .then(() => {
    console.log('✅ Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error)
    process.exit(1)
  })

