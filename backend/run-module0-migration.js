import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load environment variables (same as server.js)
// Try multiple .env file locations
const envPaths = [
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), 'backend', '.env.local'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'backend', '.env')
]

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
    console.log(`Loaded env from: ${envPath}`)
    break
  }
}

// Also try default dotenv behavior
dotenv.config()

const { Pool } = pg
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Use same connection logic as server.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vortex_athletics',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function runModule0Migration() {
  const client = await pool.connect()
  try {
    console.log('\n📄 Running Module 0 Migration: Identity, Roles, Facility Settings\n')
    
    await client.query('BEGIN')
    
    // Create user_role enum
    console.log('Creating user_role enum...')
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('OWNER_ADMIN', 'COACH', 'PARENT_GUARDIAN', 'ATHLETE_VIEWER');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `)
    console.log('✅ user_role enum created')
    
    // Create facility table
    console.log('Creating facility table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS facility (
        id                  BIGSERIAL PRIMARY KEY,
        name                TEXT NOT NULL,
        timezone            TEXT NOT NULL DEFAULT 'America/New_York',
        logo_url            TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_facility_id ON facility(id)`)
    console.log('✅ facility table created')
    
    // Seed default facility
    console.log('Seeding default facility...')
    await client.query(`
      INSERT INTO facility (name, timezone)
      SELECT 'Vortex Athletics', 'America/New_York'
      WHERE NOT EXISTS (SELECT 1 FROM facility)
    `)
    console.log('✅ Default facility seeded')
    
    // Create app_user table
    console.log('Creating app_user table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_user (
        id                  BIGSERIAL PRIMARY KEY,
        facility_id         BIGINT NOT NULL REFERENCES facility(id) ON DELETE CASCADE,
        role                user_role NOT NULL,
        email               TEXT NOT NULL,
        phone               TEXT,
        full_name           TEXT NOT NULL,
        password_hash       TEXT,
        is_active           BOOLEAN NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (facility_id, email)
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_user_facility_role ON app_user(facility_id, role)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_user_email ON app_user(email)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_app_user_active ON app_user(is_active)`)
    console.log('✅ app_user table created')
    
    // Migrate existing admins
    console.log('Migrating existing admins to app_user...')
    const adminResult = await client.query(`
      INSERT INTO app_user (
        facility_id,
        role,
        email,
        phone,
        full_name,
        password_hash,
        is_active,
        created_at,
        updated_at
      )
      SELECT 
        (SELECT id FROM facility LIMIT 1) as facility_id,
        'OWNER_ADMIN'::user_role as role,
        email,
        phone,
        COALESCE(first_name || ' ' || last_name, 'Admin User') as full_name,
        password_hash,
        TRUE as is_active,
        created_at,
        updated_at
      FROM admins
      WHERE NOT EXISTS (
        SELECT 1 FROM app_user 
        WHERE app_user.email = admins.email
      )
      RETURNING id
    `)
    console.log(`✅ Migrated ${adminResult.rows.length} admin(s) to app_user`)
    
    // Migrate existing members
    console.log('Migrating existing members to app_user...')
    const memberResult = await client.query(`
      INSERT INTO app_user (
        facility_id,
        role,
        email,
        phone,
        full_name,
        password_hash,
        is_active,
        created_at,
        updated_at
      )
      SELECT 
        (SELECT id FROM facility LIMIT 1) as facility_id,
        'PARENT_GUARDIAN'::user_role as role,
        email,
        phone,
        COALESCE(first_name || ' ' || last_name, 'Member') as full_name,
        password_hash,
        CASE 
          WHEN account_status = 'active' THEN TRUE 
          ELSE FALSE 
        END as is_active,
        created_at,
        updated_at
      FROM members
      WHERE NOT EXISTS (
        SELECT 1 FROM app_user 
        WHERE app_user.email = members.email
      )
      RETURNING id
    `)
    console.log(`✅ Migrated ${memberResult.rows.length} member(s) to app_user`)
    
    await client.query('COMMIT')
    console.log('\n✅ Module 0 migration completed successfully!\n')
    
    // Show summary
    const facilityCount = await client.query('SELECT COUNT(*) FROM facility')
    const userCount = await client.query('SELECT COUNT(*), role FROM app_user GROUP BY role')
    
    console.log('📊 Migration Summary:')
    console.log(`   Facilities: ${facilityCount.rows[0].count}`)
    userCount.rows.forEach(row => {
      console.log(`   ${row.role}: ${row.count} user(s)`)
    })
    console.log('')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('\n❌ Migration failed!')
    console.error('Error:', error.message)
    if (error.code) {
      console.error('Error code:', error.code)
    }
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

runModule0Migration().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

