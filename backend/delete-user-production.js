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
      
      // Check old members table
      try {
        const oldMembersResult = await client.query(
          'SELECT id, email, first_name, last_name FROM members WHERE email = $1',
          [emailToDelete]
        )
        if (oldMembersResult.rows.length > 0) {
          console.log('⚠️  Found in old members table, deleting...')
          await client.query('DELETE FROM members WHERE email = $1', [emailToDelete])
          console.log('✅ Deleted from old members table')
        }
      } catch (error) {
        // Old members table might not exist
        console.log('ℹ️  Old members table does not exist (expected)')
      }
    } else {
      const user = userResult.rows[0]
      console.log(`✅ Found user: ${user.full_name} (ID: ${user.id}, Facility: ${user.facility_id})`)
      
      // Get all family IDs associated with this user
      const familiesResult = await client.query(`
        SELECT DISTINCT family_id as id FROM family_guardian WHERE user_id = $1
        UNION
        SELECT id FROM family WHERE primary_user_id = $1
      `, [user.id])
      
      const familyIds = familiesResult.rows.map(row => row.id)
      console.log(`📦 Found ${familyIds.length} associated family/families`)
      
      if (familyIds.length > 0) {
        // Get facility ID
        const facilityResult = await client.query('SELECT id FROM facility LIMIT 1')
        const facilityId = facilityResult.rows.length > 0 ? facilityResult.rows[0].id : null
        
        // Delete athletes in these families
        for (const familyId of familyIds) {
          if (facilityId) {
            const athletesResult = await client.query(
              'SELECT id FROM athlete WHERE family_id = $1 AND facility_id = $2',
              [familyId, facilityId]
            )
            const athleteIds = athletesResult.rows.map(row => row.id)
            
            if (athleteIds.length > 0) {
              await client.query(
                'DELETE FROM athlete WHERE id = ANY($1::bigint[])',
                [athleteIds]
              )
              console.log(`  🗑️  Deleted ${athleteIds.length} athlete(s) from family ${familyId}`)
            }
          } else {
            const athletesResult = await client.query(
              'SELECT id FROM athlete WHERE family_id = $1',
              [familyId]
            )
            const athleteIds = athletesResult.rows.map(row => row.id)
            
            if (athleteIds.length > 0) {
              await client.query(
                'DELETE FROM athlete WHERE id = ANY($1::bigint[])',
                [athleteIds]
              )
              console.log(`  🗑️  Deleted ${athleteIds.length} athlete(s) from family ${familyId}`)
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
    }
    
    // Also check and delete from old members table if it exists
    try {
      const oldMembersResult = await client.query(
        'SELECT id, email FROM members WHERE email = $1',
        [emailToDelete]
      )
      if (oldMembersResult.rows.length > 0) {
        await client.query('DELETE FROM members WHERE email = $1', [emailToDelete])
        console.log('✅ Deleted from old members table')
      }
    } catch (error) {
      // Old members table might not exist, that's OK
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

