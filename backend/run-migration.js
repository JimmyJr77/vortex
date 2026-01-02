import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg
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

async function runMigration(migrationFile) {
  const client = await pool.connect()
  try {
    console.log(`\n📄 Running migration: ${migrationFile}`)
    
    const migrationPath = path.join(__dirname, 'migrations', migrationFile)
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    
    console.log(`✅ Migration completed: ${migrationFile}`)
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(`❌ Migration failed: ${migrationFile}`)
    console.error(error)
    throw error
  } finally {
    client.release()
  }
}

async function main() {
  const migrationFile = process.argv[2]
  
  if (!migrationFile) {
    console.error('Usage: node run-migration.js <migration-file.sql>')
    console.error('Example: node run-migration.js 001_module_0_identity_rbac_facility.sql')
    process.exit(1)
  }
  
  try {
    await runMigration(migrationFile)
    console.log('\n✅ Migration process completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Migration process failed')
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()

