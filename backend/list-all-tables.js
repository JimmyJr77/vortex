import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vortex_athletics',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function listAllTables() {
  const client = await pool.connect()
  try {
    console.log('🔍 Listing all tables in the database...')
    console.log('')
    
    // Get all tables in the public schema
    const tablesResult = await client.query(`
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
    
    console.log(`📊 Found ${tablesResult.rows.length} tables:`)
    console.log('─'.repeat(80))
    
    // Categorize tables
    const memberRelatedTables = []
    const otherTables = []
    
    for (const table of tablesResult.rows) {
      const tableName = table.table_name.toLowerCase()
      if (tableName.includes('member') || 
          tableName.includes('user') || 
          tableName.includes('athlete') ||
          tableName.includes('family') ||
          tableName.includes('guardian') ||
          tableName.includes('app_user')) {
        memberRelatedTables.push(table)
      } else {
        otherTables.push(table)
      }
    }
    
    // Show member-related tables first
    if (memberRelatedTables.length > 0) {
      console.log('\n🔴 MEMBER/USER/ATHLETE/FAMILY RELATED TABLES:')
      console.log('─'.repeat(80))
      for (const table of memberRelatedTables) {
        console.log(`  • ${table.table_name}`)
        
        // Get row count
        try {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table.table_name}`)
          const count = parseInt(countResult.rows[0].count)
          console.log(`    └─ Rows: ${count}`)
          
          // Get column names for member-related tables
          const columnsResult = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = $1
            ORDER BY ordinal_position
          `, [table.table_name])
          
          if (columnsResult.rows.length > 0) {
            console.log(`    └─ Columns: ${columnsResult.rows.map(c => c.column_name).join(', ')}`)
          }
        } catch (error) {
          console.log(`    └─ Error querying table: ${error.message}`)
        }
        console.log('')
      }
    }
    
    // Show other tables
    if (otherTables.length > 0) {
      console.log('\n📋 OTHER TABLES:')
      console.log('─'.repeat(80))
      for (const table of otherTables) {
        console.log(`  • ${table.table_name}`)
        
        // Get row count
        try {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table.table_name}`)
          const count = parseInt(countResult.rows[0].count)
          console.log(`    └─ Rows: ${count}`)
        } catch (error) {
          console.log(`    └─ Error querying table: ${error.message}`)
        }
      }
    }
    
    console.log('')
    console.log('─'.repeat(80))
    console.log('')
    
    // Now check for any member data in various tables
    console.log('🔍 Checking for member data in each table:')
    console.log('')
    
    const tablesToCheck = [
      'member',
      'members',
      'app_user',
      'athlete',
      'athletes',
      'user',
      'users',
      'family',
      'family_guardian',
      'guardian'
    ]
    
    for (const tableName of tablesToCheck) {
      const existsResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName])
      
      if (existsResult.rows[0].exists) {
        try {
          const sampleResult = await client.query(`
            SELECT * FROM ${tableName} LIMIT 3
          `)
          
          console.log(`✅ ${tableName}:`)
          console.log(`   └─ Exists: Yes`)
          console.log(`   └─ Sample rows: ${sampleResult.rows.length}`)
          
          if (sampleResult.rows.length > 0) {
            console.log(`   └─ Sample columns: ${Object.keys(sampleResult.rows[0]).join(', ')}`)
            console.log(`   └─ First row keys:`, Object.keys(sampleResult.rows[0]))
          }
          
          // Get full count
          const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`)
          console.log(`   └─ Total rows: ${countResult.rows[0].count}`)
        } catch (error) {
          console.log(`   └─ Error: ${error.message}`)
        }
        console.log('')
      }
    }
    
  } catch (error) {
    console.error('')
    console.error('❌ Error listing tables:', error.message)
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

listAllTables()
  .then(() => {
    console.log('✅ Table listing completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })


