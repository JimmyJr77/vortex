/**
 * Diagnostic script to check why a member can't login
 * Compares member records in member table vs app_user table
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

async function diagnoseMember(memberName) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Diagnosing: ${memberName}`)
  console.log('='.repeat(60))
  
  try {
    // 1. Check member table
    console.log('\n1. Checking member table...')
    const memberResult = await pool.query(`
      SELECT 
        id, first_name, last_name, email, phone, username,
        password_hash IS NOT NULL as has_password,
        is_active, status, family_id, created_at
      FROM member
      WHERE LOWER(first_name) = LOWER($1) OR LOWER(last_name) = LOWER($1)
         OR LOWER(first_name || ' ' || last_name) LIKE LOWER($2)
    `, [memberName, `%${memberName}%`])
    
    if (memberResult.rows.length === 0) {
      console.log('   ❌ NOT FOUND in member table')
      return
    }
    
    const member = memberResult.rows[0]
    console.log('   ✅ Found in member table:')
    console.log(`      ID: ${member.id}`)
    console.log(`      Name: ${member.first_name} ${member.last_name}`)
    console.log(`      Email: ${member.email || 'NULL'}`)
    console.log(`      Username: ${member.username || 'NULL'}`)
    console.log(`      Has Password: ${member.has_password}`)
    console.log(`      Is Active: ${member.is_active}`)
    console.log(`      Status: ${member.status}`)
    console.log(`      Family ID: ${member.family_id || 'NULL'}`)
    
    // 2. Check app_user table by email
    if (member.email) {
      console.log('\n2. Checking app_user table by email...')
      const appUserByEmail = await pool.query(`
        SELECT 
          id, full_name, email, username, phone,
          password_hash IS NOT NULL as has_password,
          role, is_active, facility_id, created_at
        FROM app_user
        WHERE email = $1
      `, [member.email])
      
      if (appUserByEmail.rows.length === 0) {
        console.log('   ❌ NOT FOUND in app_user table by email')
      } else {
        const appUser = appUserByEmail.rows[0]
        console.log('   ✅ Found in app_user table by email:')
        console.log(`      ID: ${appUser.id}`)
        console.log(`      Name: ${appUser.full_name}`)
        console.log(`      Email: ${appUser.email}`)
        console.log(`      Username: ${appUser.username || 'NULL'}`)
        console.log(`      Has Password: ${appUser.has_password}`)
        console.log(`      Role: ${appUser.role}`)
        console.log(`      Is Active: ${appUser.is_active}`)
        console.log(`      Facility ID: ${appUser.facility_id || 'NULL'}`)
        
        // Check if IDs match
        if (appUser.id === member.id) {
          console.log('   ✅ Member ID matches app_user ID')
        } else {
          console.log(`   ⚠️  ID MISMATCH: member.id=${member.id} vs app_user.id=${appUser.id}`)
        }
      }
    }
    
    // 3. Check app_user table by username
    if (member.username) {
      console.log('\n3. Checking app_user table by username...')
      const appUserByUsername = await pool.query(`
        SELECT 
          id, full_name, email, username, phone,
          password_hash IS NOT NULL as has_password,
          role, is_active, facility_id, created_at
        FROM app_user
        WHERE LOWER(username) = LOWER($1)
      `, [member.username])
      
      if (appUserByUsername.rows.length === 0) {
        console.log('   ❌ NOT FOUND in app_user table by username')
      } else {
        const appUser = appUserByUsername.rows[0]
        console.log('   ✅ Found in app_user table by username:')
        console.log(`      ID: ${appUser.id}`)
        console.log(`      Name: ${appUser.full_name}`)
        console.log(`      Email: ${appUser.email}`)
        console.log(`      Username: ${appUser.username}`)
        console.log(`      Has Password: ${appUser.has_password}`)
        console.log(`      Role: ${appUser.role}`)
        console.log(`      Is Active: ${appUser.is_active}`)
        
        // Check if IDs match
        if (appUser.id === member.id) {
          console.log('   ✅ Member ID matches app_user ID')
        } else {
          console.log(`   ⚠️  ID MISMATCH: member.id=${member.id} vs app_user.id=${appUser.id}`)
        }
      }
    }
    
    // 4. Check app_user table by ID
    console.log('\n4. Checking app_user table by ID...')
    const appUserById = await pool.query(`
      SELECT 
        id, full_name, email, username, phone,
        password_hash IS NOT NULL as has_password,
        role, is_active, facility_id, created_at
      FROM app_user
      WHERE id = $1
    `, [member.id])
    
    if (appUserById.rows.length === 0) {
      console.log('   ❌ NOT FOUND in app_user table by ID')
      console.log('   ⚠️  This is the problem! Member exists but no app_user record for login')
    } else {
      const appUser = appUserById.rows[0]
      console.log('   ✅ Found in app_user table by ID:')
      console.log(`      ID: ${appUser.id}`)
      console.log(`      Name: ${appUser.full_name}`)
      console.log(`      Email: ${appUser.email}`)
      console.log(`      Username: ${appUser.username || 'NULL'}`)
      console.log(`      Has Password: ${appUser.has_password}`)
      console.log(`      Role: ${appUser.role}`)
      console.log(`      Is Active: ${appUser.is_active}`)
      
      // Check role compatibility
      const validRoles = ['PARENT_GUARDIAN', 'ATHLETE_VIEWER', 'ATHLETE', 'OWNER_ADMIN']
      if (!validRoles.includes(appUser.role)) {
        console.log(`   ❌ INVALID ROLE: ${appUser.role} (must be one of: ${validRoles.join(', ')})`)
      } else {
        console.log(`   ✅ Valid role for member login: ${appUser.role}`)
      }
      
      // Check if active
      if (!appUser.is_active) {
        console.log('   ❌ INACTIVE: app_user.is_active = FALSE')
      } else {
        console.log('   ✅ Active: app_user.is_active = TRUE')
      }
      
      // Check password
      if (!appUser.has_password) {
        console.log('   ❌ NO PASSWORD: password_hash is NULL')
      } else {
        console.log('   ✅ Has password_hash')
      }
    }
    
    // 5. Check user_role table
    console.log('\n5. Checking user_role table...')
    const userRoles = await pool.query(`
      SELECT role, user_id, member_id
      FROM user_role
      WHERE user_id = $1 OR member_id = $1
    `, [member.id])
    
    if (userRoles.rows.length === 0) {
      console.log('   ℹ️  No roles in user_role table')
    } else {
      console.log('   ✅ Roles found:')
      userRoles.rows.forEach(ur => {
        console.log(`      - ${ur.role} (user_id: ${ur.user_id}, member_id: ${ur.member_id})`)
      })
    }
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`)
    console.error(error.stack)
  }
}

async function listAllMembers() {
  console.log('\n📋 Listing all members in database...\n')
  try {
    const result = await pool.query(`
      SELECT id, first_name, last_name, email, username, is_active
      FROM member
      ORDER BY last_name, first_name
      LIMIT 20
    `)
    
    if (result.rows.length === 0) {
      console.log('   No members found in member table')
    } else {
      result.rows.forEach(m => {
        console.log(`   - ${m.first_name} ${m.last_name} (ID: ${m.id}, Email: ${m.email || 'NULL'}, Active: ${m.is_active})`)
      })
    }
  } catch (error) {
    console.error(`   Error: ${error.message}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  
  // First list all members
  await listAllMembers()
  
  if (args.length === 0) {
    console.log('\nUsage: node diagnose-member-login.js <member_name> [member_name2] ...')
    console.log('Example: node diagnose-member-login.js James Karla')
    await pool.end()
    process.exit(1)
  }
  
  for (const memberName of args) {
    await diagnoseMember(memberName)
  }
  
  await pool.end()
}

main().catch(console.error)

