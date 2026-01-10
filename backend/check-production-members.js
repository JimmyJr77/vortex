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

async function checkProductionMembers() {
  // Check if we have database connection info
  const hasDatabaseUrl = process.env.DATABASE_URL || process.env.DB_URL
  const hasDbConfig = process.env.DB_HOST && process.env.DB_PASSWORD
  
  if (!hasDatabaseUrl && !hasDbConfig) {
    console.log('⚠️  No database connection configuration found!')
    console.log('')
    console.log('To check production members, you need to set one of the following:')
    console.log('  1. DATABASE_URL or DB_URL environment variable (recommended)')
    console.log('  2. Or set: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD')
    console.log('')
    console.log('Example:')
    console.log('  export DATABASE_URL="postgresql://user:password@host:port/database"')
    console.log('  node check-production-members.js')
    console.log('')
    console.log('Alternatively, you can query members via the API:')
    console.log('  curl https://vortex-backend-qybl.onrender.com/api/admin/members')
    console.log('')
    process.exit(1)
  }
  
  const client = await pool.connect()
  try {
    console.log('🔍 Checking for members in production database...')
    if (hasDatabaseUrl) {
      console.log(`📍 Database: Using DATABASE_URL`)
    } else {
      console.log(`📍 Database: ${process.env.DB_NAME || 'vortex_athletics'}`)
      console.log(`🌐 Host: ${process.env.DB_HOST || 'localhost'}`)
    }
    console.log('')
    
    // First, check if member table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member'
      )
    `)
    
    const hasMemberTable = tableCheck.rows[0].exists
    console.log(`📊 Member table exists: ${hasMemberTable}`)
    
    if (!hasMemberTable) {
      console.log('❌ Member table does not exist in database')
      
      // Check for old members table
      const oldTableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'members'
        )
      `)
      
      if (oldTableCheck.rows[0].exists) {
        console.log('⚠️  Found old "members" table instead')
        const oldMembersResult = await client.query('SELECT COUNT(*) as total FROM members')
        console.log(`   Total records in old members table: ${oldMembersResult.rows[0].total}`)
      }
      
      return
    }
    
    // Get total count of members
    const totalResult = await client.query('SELECT COUNT(*) as total FROM member')
    const totalMembers = parseInt(totalResult.rows[0].total)
    console.log(`📈 Total members in database: ${totalMembers}`)
    
    if (totalMembers === 0) {
      console.log('⚠️  No members found in production database')
      return
    }
    
    // Get count of active members
    const activeResult = await client.query('SELECT COUNT(*) as total FROM member WHERE is_active = TRUE')
    const activeMembers = parseInt(activeResult.rows[0].total)
    console.log(`✅ Active members: ${activeMembers}`)
    
    // Get count of archived/inactive members
    const archivedMembers = totalMembers - activeMembers
    console.log(`🗄️  Archived/inactive members: ${archivedMembers}`)
    console.log('')
    
    // Get sample of members (first 10)
    const sampleResult = await client.query(`
      SELECT 
        id,
        first_name,
        last_name,
        email,
        phone,
        date_of_birth,
        is_active,
        status,
        family_id,
        created_at
      FROM member 
      ORDER BY created_at DESC 
      LIMIT 10
    `)
    
    console.log('📋 Sample of members (most recent 10):')
    console.log('─'.repeat(100))
    
    if (sampleResult.rows.length > 0) {
      sampleResult.rows.forEach((member, index) => {
        const age = member.date_of_birth 
          ? Math.floor((new Date() - new Date(member.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))
          : 'N/A'
        
        console.log(`${index + 1}. ${member.first_name} ${member.last_name}`)
        console.log(`   Email: ${member.email || 'N/A'}`)
        console.log(`   Phone: ${member.phone || 'N/A'}`)
        console.log(`   Age: ${age}`)
        console.log(`   Status: ${member.status || 'N/A'} | Active: ${member.is_active ? 'Yes' : 'No'}`)
        console.log(`   Family ID: ${member.family_id || 'N/A'}`)
        console.log(`   Created: ${new Date(member.created_at).toLocaleDateString()}`)
        console.log('')
      })
    } else {
      console.log('   (No members found)')
    }
    
    // Check for families
    const familyCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'family'
      )
    `)
    
    if (familyCheck.rows[0].exists) {
      const familyResult = await client.query('SELECT COUNT(*) as total FROM family')
      const totalFamilies = parseInt(familyResult.rows[0].total)
      console.log(`👨‍👩‍👧‍👦 Total families: ${totalFamilies}`)
    }
    
    // Check enrollments if member_program table exists
    const enrollmentTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'member_program'
      )
    `)
    
    if (enrollmentTableCheck.rows[0].exists) {
      const enrollmentResult = await client.query('SELECT COUNT(*) as total FROM member_program')
      const totalEnrollments = parseInt(enrollmentResult.rows[0].total)
      console.log(`📚 Total enrollments: ${totalEnrollments}`)
    }
    
    console.log('')
    console.log('✅ Check completed successfully!')
    
  } catch (error) {
    console.error('')
    console.error('❌ Error checking members:', error.message)
    console.error('')
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

checkProductionMembers()
  .then(() => {
    console.log('')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })

