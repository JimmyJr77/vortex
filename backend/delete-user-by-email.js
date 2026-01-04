import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

// PostgreSQL Database setup
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

async function deleteUserByEmail() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    console.log(`Searching for user with email: ${emailToDelete}`)
    
    // Find the user
    const userResult = await client.query(
      'SELECT id, email, full_name FROM app_user WHERE email = $1',
      [emailToDelete]
    )
    
    if (userResult.rows.length === 0) {
      console.log('User not found in app_user table')
      
      // Check if there's a family with this email
      const familyResult = await client.query(`
        SELECT f.id, f.family_name, u.email, u.id as user_id
        FROM family f
        JOIN app_user u ON f.primary_user_id = u.id
        WHERE u.email = $1
      `, [emailToDelete])
      
      if (familyResult.rows.length > 0) {
        console.log(`Found family associated with this email: ${familyResult.rows[0].family_name}`)
        console.log('Family ID:', familyResult.rows[0].id)
        console.log('User ID:', familyResult.rows[0].user_id)
        
        // Delete the family (which should cascade)
        await client.query('DELETE FROM family WHERE id = $1', [familyResult.rows[0].id])
        console.log('Family deleted')
        
        // Delete the user
        await client.query('DELETE FROM app_user WHERE id = $1', [familyResult.rows[0].user_id])
        console.log('User deleted')
      } else {
        console.log('No family or user found with this email')
      }
    } else {
      const user = userResult.rows[0]
      console.log(`Found user: ${user.full_name} (ID: ${user.id})`)
      
      // Check if user is associated with any families
      const familyCheck = await client.query(`
        SELECT COUNT(*) as count
        FROM (
          SELECT family_id FROM family_guardian WHERE user_id = $1
          UNION
          SELECT id FROM family WHERE primary_user_id = $1
        ) as families
      `, [user.id])
      
      const familyCount = parseInt(familyCheck.rows[0].count)
      
      if (familyCount > 0) {
        console.log(`User is associated with ${familyCount} family/families`)
        console.log('Deleting associated families first...')
        
        // Get all family IDs
        const familiesResult = await client.query(`
          SELECT DISTINCT family_id as id FROM family_guardian WHERE user_id = $1
          UNION
          SELECT id FROM family WHERE primary_user_id = $1
        `, [user.id])
        
        const familyIds = familiesResult.rows.map(row => row.id)
        
        // Delete athletes in these families
        for (const familyId of familyIds) {
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
            console.log(`Deleted ${athleteIds.length} athlete(s) from family ${familyId}`)
          }
        }
        
        // Delete families
        await client.query('DELETE FROM family WHERE id = ANY($1::bigint[])', [familyIds])
        console.log(`Deleted ${familyIds.length} family/families`)
      }
      
      // Delete the user
      await client.query('DELETE FROM app_user WHERE id = $1', [user.id])
      console.log('User deleted successfully')
    }
    
    await client.query('COMMIT')
    console.log('✅ Deletion completed successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error deleting user:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

deleteUserByEmail()
  .then(() => {
    console.log('Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

