import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

// PostgreSQL Database setup - uses environment variables for production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vortex_athletics',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

const emailToDelete = 'jimmyjr.obrien@gmail.com'

async function deleteUserFromProduction() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    console.log(`🔍 Searching for user with email: ${emailToDelete}`)
    console.log(`📍 Database: ${process.env.DB_NAME || 'vortex_athletics'}`)
    console.log(`🌐 Host: ${process.env.DB_HOST || 'localhost'}`)
    console.log('')
    
    // Find the user in app_user
    const userResult = await client.query(
      'SELECT id, email, full_name, facility_id FROM app_user WHERE email = $1',
      [emailToDelete]
    )
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found in app_user table')
      console.log('ℹ️  Also check the unified member table if user should exist as a member')
    } else {
      const user = userResult.rows[0]
      console.log(`✅ Found user: ${user.full_name} (ID: ${user.id}, Facility: ${user.facility_id})`)
      
      // Get all family IDs associated with this user
      const familiesResult = await client.query(`
        SELECT DISTINCT fm.family_id as id
        FROM family_member fm
        JOIN member m ON m.id = fm.member_id
        WHERE m.app_user_id = $1
      `, [user.id])
      
      const familyIds = familiesResult.rows.map(row => row.id)
      console.log(`📦 Found ${familyIds.length} associated family/families`)
      
      if (familyIds.length > 0) {
        // Get facility ID
        const facilityResult = await client.query('SELECT id FROM facility LIMIT 1')
        const facilityId = facilityResult.rows.length > 0 ? facilityResult.rows[0].id : null
        
        // Delete members in these families (unified member table replaces old athlete table)
        for (const familyId of familyIds) {
          if (facilityId) {
            const membersResult = await client.query(
              `SELECT DISTINCT m.id
               FROM family_member fm
               JOIN member m ON m.id = fm.member_id
               WHERE fm.family_id = $1 AND m.facility_id = $2`,
              [familyId, facilityId]
            )
            const memberIds = membersResult.rows.map(row => row.id)
            
            if (memberIds.length > 0) {
              await client.query(
                'DELETE FROM member WHERE id = ANY($1::bigint[])',
                [memberIds]
              )
              console.log(`  🗑️  Deleted ${memberIds.length} member(s) from family ${familyId}`)
            }
          } else {
            const membersResult = await client.query(
              `SELECT DISTINCT m.id
               FROM family_member fm
               JOIN member m ON m.id = fm.member_id
               WHERE fm.family_id = $1`,
              [familyId]
            )
            const memberIds = membersResult.rows.map(row => row.id)
            
            if (memberIds.length > 0) {
              await client.query(
                'DELETE FROM member WHERE id = ANY($1::bigint[])',
                [memberIds]
              )
              console.log(`  🗑️  Deleted ${memberIds.length} member(s) from family ${familyId}`)
            }
          }
        }
        
        // Delete families
        await client.query('DELETE FROM family WHERE id = ANY($1::bigint[])', [familyIds])
        console.log(`  🗑️  Deleted ${familyIds.length} family/families`)
      }
      
      // Delete the user
      await client.query('DELETE FROM app_user WHERE id = $1', [user.id])
      console.log('✅ User deleted from app_user table')
      
      // Also check and delete from unified member table if it exists
      try {
        const memberResult = await client.query(
          'SELECT id, email, first_name, last_name FROM member WHERE email = $1',
          [emailToDelete]
        )
        if (memberResult.rows.length > 0) {
          await client.query('DELETE FROM member WHERE email = $1', [emailToDelete])
          console.log('✅ Deleted from unified member table')
        }
      } catch (error) {
        console.log('ℹ️  Could not check/delete from member table:', error.message)
      }
    }
    
    await client.query('COMMIT')
    console.log('')
    console.log('✅ Deletion completed successfully!')
    console.log('')
    console.log('You can now create a new account with this email.')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('')
    console.error('❌ Error deleting user:', error.message)
    console.error('')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

deleteUserFromProduction()
  .then(() => {
    console.log('Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

