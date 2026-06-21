/**
 * Migration Script: Unified Member Table
 * 
 * This script migrates data from app_user and athlete tables to the unified member table.
 * Run this after the database migration (005_unified_member_table.sql) has been executed.
 * 
 * Usage: node run-unified-member-migration.js
 */

import pkg from 'pg'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const { Pool } = pkg

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envLocalPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
} else {
  dotenv.config()
}

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
    await client.query('BEGIN')
    console.log('🔄 Starting unified member table migration...')
    
    // Step 1: Migrate app_user to member
    console.log('📝 Step 1: Migrating app_user records to member table...')
    
    // Check if username column exists in app_user
    const usernameCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'app_user' AND column_name = 'username'
    `)
    const hasUsername = usernameCheck.rows.length > 0
    
    let userQuery
    if (hasUsername) {
      userQuery = `
        INSERT INTO member (
          id, facility_id, first_name, last_name, email, phone, address,
          password_hash, username, is_active, status, created_at, updated_at
        )
        SELECT 
          id,
          facility_id,
          SPLIT_PART(full_name, ' ', 1) as first_name,
          SUBSTRING(full_name FROM LENGTH(SPLIT_PART(full_name, ' ', 1)) + 2) as last_name,
          email,
          phone,
          address,
          password_hash,
          username,
          is_active,
          CASE 
            WHEN is_active = FALSE THEN 'archived'
            ELSE 'legacy'
          END as status,
          created_at,
          updated_at
        FROM app_user
        WHERE NOT EXISTS (SELECT 1 FROM member WHERE member.id = app_user.id)
        ON CONFLICT DO NOTHING
        RETURNING id
      `
    } else {
      userQuery = `
        INSERT INTO member (
          id, facility_id, first_name, last_name, email, phone, address,
          password_hash, is_active, status, created_at, updated_at
        )
        SELECT 
          id,
          facility_id,
          SPLIT_PART(full_name, ' ', 1) as first_name,
          SUBSTRING(full_name FROM LENGTH(SPLIT_PART(full_name, ' ', 1)) + 2) as last_name,
          email,
          phone,
          address,
          password_hash,
          is_active,
          CASE 
            WHEN is_active = FALSE THEN 'archived'
            ELSE 'legacy'
          END as status,
          created_at,
          updated_at
        FROM app_user
        WHERE NOT EXISTS (SELECT 1 FROM member WHERE member.id = app_user.id)
        ON CONFLICT DO NOTHING
        RETURNING id
      `
    }
    
    const userResult = await client.query(userQuery)
    console.log(`✅ Migrated ${userResult.rows.length} app_user records`)
    
    // Step 2: Migrate athletes without user_id (children)
    console.log('📝 Step 2: Migrating child athlete records to member table...')
    const childAthleteResult = await client.query(`
      INSERT INTO member (
        facility_id, family_id, first_name, last_name, date_of_birth,
        medical_notes, internal_flags, status, is_active, created_at, updated_at
      )
      SELECT 
        a.facility_id,
        a.family_id,
        a.first_name,
        a.last_name,
        a.date_of_birth,
        a.medical_notes,
        a.internal_flags,
        CASE 
          WHEN a.status = 'stand-bye' THEN 'legacy'
          WHEN a.status = 'archived' THEN 'archived'
          WHEN a.status = 'enrolled' THEN 'enrolled'
          ELSE 'legacy'
        END as status,
        CASE WHEN a.status = 'archived' THEN FALSE ELSE TRUE END as is_active,
        a.created_at,
        a.updated_at
      FROM athlete a
      WHERE a.user_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM member m 
          WHERE m.first_name = a.first_name 
            AND m.last_name = a.last_name 
            AND m.date_of_birth = a.date_of_birth 
            AND COALESCE(m.family_id, 0) = COALESCE(a.family_id, 0)
        )
      RETURNING id
    `)
    console.log(`✅ Migrated ${childAthleteResult.rows.length} child athlete records`)
    
    // Step 3: Update existing members with athlete data (adults who train)
    console.log('📝 Step 3: Merging athlete data into existing member records...')
    const mergeResult = await client.query(`
      UPDATE member m
      SET 
        family_id = a.family_id,
        date_of_birth = COALESCE(m.date_of_birth, a.date_of_birth),
        medical_notes = COALESCE(m.medical_notes, a.medical_notes),
        internal_flags = COALESCE(m.internal_flags, a.internal_flags),
        status = CASE 
          WHEN a.status = 'stand-bye' THEN 'legacy'
          WHEN a.status = 'archived' THEN 'archived'
          WHEN a.status = 'enrolled' THEN 'enrolled'
          ELSE m.status
        END,
        updated_at = GREATEST(m.updated_at, a.updated_at)
      FROM athlete a
      WHERE a.user_id = m.id
      RETURNING m.id
    `)
    console.log(`✅ Updated ${mergeResult.rows.length} member records with athlete data`)
    
    // Step 4: Migrate athlete_program to member_program
    console.log('📝 Step 4: Migrating enrollments from athlete_program to member_program...')
    
    // Check if athlete_program table exists
    const athleteProgramCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'athlete_program'
      )
    `)
    
    if (!athleteProgramCheck.rows[0].exists) {
      console.log('⚠️  athlete_program table does not exist, skipping enrollment migration')
    } else {
      const enrollmentResult = await client.query(`
      INSERT INTO member_program (
        member_id, program_id, iteration_id, days_per_week, selected_days, created_at, updated_at
      )
      SELECT 
        COALESCE(
          (SELECT id FROM member WHERE id = a.user_id LIMIT 1),
          (SELECT id FROM member WHERE first_name = a.first_name 
           AND last_name = a.last_name 
           AND date_of_birth = a.date_of_birth 
           AND COALESCE(family_id, 0) = COALESCE(a.family_id, 0)
           LIMIT 1)
        ) as member_id,
        ap.program_id,
        ap.iteration_id,
        ap.days_per_week,
        ap.selected_days,
        ap.created_at,
        ap.updated_at
      FROM athlete_program ap
      JOIN athlete a ON ap.athlete_id = a.id
      WHERE COALESCE(
        (SELECT id FROM member WHERE id = a.user_id LIMIT 1),
        (SELECT id FROM member WHERE first_name = a.first_name 
         AND last_name = a.last_name 
         AND date_of_birth = a.date_of_birth 
         AND COALESCE(family_id, 0) = COALESCE(a.family_id, 0)
         LIMIT 1)
      ) IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM member_program mp
          WHERE mp.member_id = COALESCE(
            (SELECT id FROM member WHERE id = a.user_id LIMIT 1),
            (SELECT id FROM member WHERE first_name = a.first_name 
             AND last_name = a.last_name 
             AND date_of_birth = a.date_of_birth 
             AND COALESCE(family_id, 0) = COALESCE(a.family_id, 0)
             LIMIT 1)
          )
          AND mp.program_id = ap.program_id
          AND COALESCE(mp.iteration_id, 0) = COALESCE(ap.iteration_id, 0)
        )
      RETURNING id
      `)
      console.log(`✅ Migrated ${enrollmentResult.rows.length} enrollment records`)
    }
    
    // Step 5: Backfill canonical family_member records
    console.log('📝 Step 5: Backfilling family_member records...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS family_member (
        family_id BIGINT NOT NULL REFERENCES family(id) ON DELETE CASCADE,
        member_id BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
        relationship_label TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (family_id, member_id)
      )
    `)
    await client.query(`
      INSERT INTO family_member (family_id, member_id, is_active)
      SELECT family_id, id, TRUE
      FROM member
      WHERE family_id IS NOT NULL
      ON CONFLICT (family_id, member_id) DO UPDATE
      SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
    `)
    console.log('✅ Backfilled family_member records')
    
    // Step 6: Primary family ownership is now represented by family_billing_account.payer_member_id.
    console.log('📝 Step 6: Skipping legacy family primary member references')
    
    // Step 7: Update emergency_contact to reference member
    console.log('📝 Step 7: Updating emergency_contact to reference member...')
    await client.query(`
      UPDATE emergency_contact ec
      SET member_id = (
        SELECT m.id 
        FROM member m
        JOIN athlete a ON (
          (a.user_id = m.id) OR
          (m.first_name = a.first_name 
           AND m.last_name = a.last_name 
           AND m.date_of_birth = a.date_of_birth
           AND COALESCE(m.family_id, 0) = COALESCE(a.family_id, 0))
        )
        WHERE a.id = ec.athlete_id
        LIMIT 1
      )
      WHERE ec.athlete_id IS NOT NULL AND ec.member_id IS NULL
    `)
    console.log('✅ Updated emergency_contact references')
    
    // Step 8: Update user_role to reference member
    console.log('📝 Step 8: Updating user_role to reference member...')
    const userRoleCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_role'
      )
    `)
    if (userRoleCheck.rows[0].exists) {
      await client.query(`
        UPDATE user_role ur
        SET member_id = ur.user_id
        WHERE ur.user_id IS NOT NULL AND ur.member_id IS NULL
      `)
      console.log('✅ Updated user_role references')
    } else {
      console.log('⚠️  user_role table does not exist, skipping')
    }
    
    // Step 9: Calculate family_is_active status
    console.log('📝 Step 9: Calculating family_is_active status...')
    await client.query(`SELECT calculate_family_active_status()`)
    console.log('✅ Calculated family_is_active status for all members')
    
    // Step 10: Create parent_guardian_authority relationships
    console.log('📝 Step 10: Creating parent_guardian_authority relationships...')
    
    const authorityResult = await client.query(`
      INSERT INTO parent_guardian_authority (
        parent_member_id, child_member_id, has_legal_authority, relationship
      )
      SELECT DISTINCT
        parent.member_id as parent_member_id,
        child.member_id as child_member_id,
        TRUE as has_legal_authority,
        'Parent/Guardian' as relationship
      FROM family_member parent
      JOIN member parent_member ON parent_member.id = parent.member_id
      JOIN family_member child ON child.family_id = parent.family_id
      JOIN member child_member ON child_member.id = child.member_id
      WHERE parent.is_active = TRUE
        AND child.is_active = TRUE
        AND parent.member_id <> child.member_id
        AND parent_member.date_of_birth IS NOT NULL
        AND EXTRACT(YEAR FROM AGE(parent_member.date_of_birth)) >= 18
        AND child_member.date_of_birth IS NOT NULL
        AND EXTRACT(YEAR FROM AGE(child_member.date_of_birth)) < 18
        AND NOT EXISTS (
          SELECT 1 FROM parent_guardian_authority pga
          WHERE pga.parent_member_id = parent.member_id
            AND pga.child_member_id = child.member_id
        )
      RETURNING id
    `)
    console.log(`✅ Created ${authorityResult.rows.length} parent_guardian_authority relationships`)
    
    await client.query('COMMIT')
    console.log('✅ Migration completed successfully!')
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    client.release()
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('✅ Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error)
    process.exit(1)
  })

