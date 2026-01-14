/**
 * Script to create app_user records for members that have login credentials
 * but are missing app_user records (which prevents them from logging in)
 */

import pg from 'pg'
import dotenv from 'dotenv'

const { Pool } = pg
dotenv.config({ path: '.env.local' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vortex_athletics',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// Helper to check if person is adult (18+)
function isAdult(dateOfBirth) {
  if (!dateOfBirth) return true
  const today = new Date()
  const birthDate = new Date(dateOfBirth)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age >= 18
}

async function fixMissingAppUsers() {
  console.log('🔍 Finding members with login credentials but missing app_user records...\n')
  
  try {
    // Find members that have email or username AND password_hash but no app_user record
    const membersResult = await pool.query(`
      SELECT 
        m.id,
        m.first_name,
        m.last_name,
        m.email,
        m.username,
        m.phone,
        m.password_hash,
        m.date_of_birth,
        m.is_active,
        m.facility_id,
        m.address
      FROM member m
      WHERE (m.email IS NOT NULL OR m.username IS NOT NULL)
        AND m.password_hash IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM app_user au WHERE au.id = m.id
        )
      ORDER BY m.id
    `)
    
    if (membersResult.rows.length === 0) {
      console.log('✅ No members found that need app_user records')
      return
    }
    
    console.log(`Found ${membersResult.rows.length} member(s) missing app_user records:\n`)
    
    // Get facility_id
    let facilityId = null
    const facilityResult = await pool.query('SELECT id FROM facility LIMIT 1')
    if (facilityResult.rows.length > 0) {
      facilityId = facilityResult.rows[0].id
    }
    
    let fixed = 0
    let errors = 0
    
    for (const member of membersResult.rows) {
      try {
        const fullName = `${member.first_name} ${member.last_name}`.trim()
        const isChild = member.date_of_birth && !isAdult(member.date_of_birth)
        const role = isChild ? 'ATHLETE' : 'PARENT_GUARDIAN'
        
        // Check if app_user with this ID already exists (shouldn't happen, but check anyway)
        const existingCheck = await pool.query('SELECT id FROM app_user WHERE id = $1', [member.id])
        if (existingCheck.rows.length > 0) {
          console.log(`   ⚠️  Member ${member.id} (${fullName}) already has app_user record, skipping`)
          continue
        }
        
        // Check if email/username conflict with existing app_user
        let conflictCheck = null
        if (member.email) {
          conflictCheck = await pool.query('SELECT id, email FROM app_user WHERE email = $1 AND id != $2', [member.email, member.id])
        } else if (member.username) {
          conflictCheck = await pool.query('SELECT id, username FROM app_user WHERE LOWER(username) = LOWER($1) AND id != $2', [member.username, member.id])
        }
        
        if (conflictCheck && conflictCheck.rows.length > 0) {
          console.log(`   ⚠️  Member ${member.id} (${fullName}) has email/username conflict with app_user ${conflictCheck.rows[0].id}, skipping`)
          continue
        }
        
        // Create app_user record
        await pool.query(`
          INSERT INTO app_user (
            id, full_name, email, phone, username, password_hash,
            role, is_active, facility_id, address, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        `, [
          member.id,
          fullName,
          member.email || null,
          member.phone || null,
          member.username || null,
          member.password_hash,
          role,
          member.is_active,
          member.facility_id || facilityId,
          member.address || null
        ])
        
        console.log(`   ✅ Created app_user for member ${member.id}: ${fullName} (${member.email || member.username}) - Role: ${role}`)
        fixed++
      } catch (error) {
        console.error(`   ❌ Error creating app_user for member ${member.id} (${member.first_name} ${member.last_name}):`, error.message)
        errors++
      }
    }
    
    console.log(`\n📊 Summary:`)
    console.log(`   Fixed: ${fixed}`)
    console.log(`   Errors: ${errors}`)
    console.log(`   Total: ${membersResult.rows.length}`)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await pool.end()
  }
}

// Run the fix
fixMissingAppUsers().catch(console.error)

