import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '.env') })
dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') })
dotenv.config({ path: path.join(process.cwd(), 'backend', '.env.local') })

const { Pool } = pg
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const migrationsDir = path.join(__dirname, 'migrations')

const EXCLUDED_FROM_ALL = new Set([
  'verify_module0.sql',
  'seed_events.sql',
  'add_members_tables.sql',
])

const INSERTED_AFTER = {
  '002_module_1_programs_classes.sql': ['add_class_iteration_table.sql'],
  '004_add_user_id_to_athlete.sql': ['add_athlete_program_table.sql'],
}

const ADDON_MIGRATION_ORDER = [
  'add_categories_levels_tables.sql',
  'add_programs_is_active.sql',
  'add_archived_column.sql',
  'add_scheduling_tables.sql',
  'unify_programs_scheduling.sql',
  'refactor_scheduling_v2.sql',
  'add_scheduling_form_deleted_at.sql',
  'add_slot_groups.sql',
  'add_scheduling_offerings.sql',
  'add_scheduling_waitlist.sql',
  'add_scheduling_orphaned_signups.sql',
  'add_scheduling_signup_archived.sql',
  'add_scheduling_enroll_sites.sql',
  'add_scheduling_member_pricing.sql',
  'allow_null_signup_time_slot.sql',
  'add_program_pricing_defaults.sql',
  'add_program_pricing_promo_codes.sql',
  'add_discipline_tags.sql',
  'add_primary_discipline_tag.sql',
  'add_discount_engine.sql',
  'add_discount_tier_eligibility.sql',
  'add_spend_volume_discount_type.sql',
  'patch_discount_rule_legacy_columns.sql',
  'remove_baked_system_discount_rules.sql',
  'add_free_passes.sql',
  'add_free_pass_specific_date.sql',
  'add_pricing_benefit_selection.sql',
  'add_additional_fees.sql',
  'add_analytics_tables.sql',
  'add_db_queries_schools_notes.sql',
  'add_highlights_table.sql',
  'add_highlight_modal_height.sql',
  'add_event_tags.sql',
  'add_archived_to_events.sql',
  'add_event_scheduling_form.sql',
  'add_event_edit_log.sql',
  'add_inquiry_fields.sql',
  'add_inquiry_campers.sql',
  'add_inquiry_follow_up.sql',
  'add_inquiry_submitter_source.sql',
  'add_mandate_waiver.sql',
  'add_member_must_change_password.sql',
  'drop_legacy_members_tables.sql',
]

function resolveSsl(connectionString) {
  if (process.env.DATABASE_SSL === 'false') return false
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false }
  if (process.env.NODE_ENV === 'production') return { rejectUnauthorized: false }

  const value = String(connectionString || '')
  if (/render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(value)) {
    return { rejectUnauthorized: false }
  }
  return false
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vortex_athletics',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: resolveSsl(process.env.DATABASE_URL || process.env.DB_URL),
})

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      checksum TEXT,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

function checksumFor(text) {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return String(hash)
}

async function ensureFreshDbPrerequisites(client) {
  console.log('\n🧱 Ensuring fresh DB prerequisites...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(50) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_master BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(50) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      address TEXT,
      password_hash VARCHAR(255) NOT NULL,
      account_status VARCHAR(20) DEFAULT 'active',
      program VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  console.log('✅ Fresh DB prerequisites ready')
}

async function ensureRuntimeBaseTables(client) {
  console.log('\n🧩 Ensuring runtime base tables for add-on migrations...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(50) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      athlete_age INTEGER,
      interests TEXT,
      interests_array TEXT[],
      interest VARCHAR(100),
      class_types TEXT[],
      child_ages INTEGER[],
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      event_name VARCHAR(255) NOT NULL,
      short_description TEXT NOT NULL,
      long_description TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      type VARCHAR(50) DEFAULT 'event',
      address TEXT,
      dates_and_times JSONB DEFAULT '[]'::jsonb,
      key_details JSONB DEFAULT '[]'::jsonb,
      archived BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  console.log('✅ Runtime base tables ready')
}

async function ensurePostMigrationSchema(client) {
  console.log('\n🔧 Ensuring runtime schema compatibility...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_user_role (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      role user_role NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, role)
    );
    CREATE INDEX IF NOT EXISTS idx_app_user_role_user_id ON app_user_role(user_id);
    CREATE INDEX IF NOT EXISTS idx_app_user_role_role ON app_user_role(role);

    ALTER TABLE app_user ADD COLUMN IF NOT EXISTS username VARCHAR(50);
    ALTER TABLE app_user ADD COLUMN IF NOT EXISTS address TEXT;

    ALTER TABLE family ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE member
      ADD COLUMN IF NOT EXISTS gender TEXT,
      ADD COLUMN IF NOT EXISTS medical_concerns TEXT,
      ADD COLUMN IF NOT EXISTS injury_history_date DATE,
      ADD COLUMN IF NOT EXISTS injury_history_body_part TEXT,
      ADD COLUMN IF NOT EXISTS injury_history_notes TEXT,
      ADD COLUMN IF NOT EXISTS no_injury_history BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS experience TEXT,
      ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS signup_source VARCHAR(32),
      ADD COLUMN IF NOT EXISTS has_completed_waivers BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS waiver_completion_date TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS parent_guardian_ids BIGINT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS app_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL;

    ALTER TABLE program ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
  `)
  console.log('✅ Runtime schema compatibility ready')
}

async function runMigration(client, migrationFile) {
  const migrationPath = path.join(migrationsDir, migrationFile)
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration not found: ${migrationFile}`)
  }

  const sql = fs.readFileSync(migrationPath, 'utf8')
  const checksum = checksumFor(sql)
  const existing = await client.query(
    `SELECT filename FROM schema_migrations WHERE filename = $1 LIMIT 1`,
    [migrationFile],
  )
  if (existing.rows.length > 0) {
    console.log(`↩️  Skipping already applied migration: ${migrationFile}`)
    return
  }

  console.log(`\n📄 Running migration: ${migrationFile}`)
  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query(
      `INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)`,
      [migrationFile, checksum],
    )
    await client.query('COMMIT')
    console.log(`✅ Migration completed: ${migrationFile}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

function listAllMigrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
}

function listMigrationsForAll() {
  const all = listAllMigrationFiles()
  const numbered = all.filter((name) => /^\d{3}_/.test(name)).sort()
  const scheduled = new Set()
  const core = []

  for (const file of numbered) {
    core.push(file)
    for (const inserted of INSERTED_AFTER[file] || []) {
      if (!all.includes(inserted)) continue
      core.push(inserted)
      scheduled.add(inserted)
    }
  }

  const addonCandidates = all.filter(
    (file) => !core.includes(file) && !scheduled.has(file) && !EXCLUDED_FROM_ALL.has(file),
  )

  const orderedAddon = []
  for (const file of ADDON_MIGRATION_ORDER) {
    if (addonCandidates.includes(file)) {
      orderedAddon.push(file)
    }
  }
  for (const file of addonCandidates.sort()) {
    if (!orderedAddon.includes(file)) {
      orderedAddon.push(file)
    }
  }

  return { core, addon: orderedAddon }
}

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage:')
    console.error('  node run-migration.js <migration-file.sql>')
    console.error('  node run-migration.js --all')
    process.exit(1)
  }

  const client = await pool.connect()
  try {
    await ensureMigrationTable(client)

    if (arg === '--all') {
      await ensureFreshDbPrerequisites(client)
    }

    const migrations = arg === '--all' ? listMigrationsForAll() : { core: [arg], addon: [] }

    for (const migrationFile of migrations.core) {
      await runMigration(client, migrationFile)
    }

    if (arg === '--all' && migrations.addon.length > 0) {
      await ensureRuntimeBaseTables(client)
      for (const migrationFile of migrations.addon) {
        await runMigration(client, migrationFile)
      }
    }

    if (arg === '--all') {
      await ensurePostMigrationSchema(client)
    }

    console.log('\n✅ Migration process completed successfully')
  } catch (error) {
    console.error('\n❌ Migration process failed')
    console.error('Error:', error.message)
    if (error.stack) console.error('Stack:', error.stack)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
