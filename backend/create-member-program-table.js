import pkg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vortex_athletics',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function createMemberProgramTable() {
  try {
    console.log('Creating member_program table...')
    
    // Create member_program table (replaces athlete_program)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS member_program (
        id                  BIGSERIAL PRIMARY KEY,
        member_id           BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
        program_id          BIGINT NOT NULL REFERENCES program(id) ON DELETE CASCADE,
        iteration_id        BIGINT REFERENCES class_iteration(id) ON DELETE CASCADE,
        days_per_week       INTEGER NOT NULL,
        selected_days       JSONB,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (member_id, program_id, iteration_id)
      )
    `)
    console.log('✅ member_program table created')
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_program_member ON member_program(member_id)`)
    console.log('✅ Index on member_id created')
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_program_program ON member_program(program_id)`)
    console.log('✅ Index on program_id created')
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_member_program_iteration ON member_program(iteration_id)`)
    console.log('✅ Index on iteration_id created')
    
    console.log('✅ member_program table and indexes created successfully')
  } catch (error) {
    console.error('❌ Error creating member_program table:', error)
    throw error
  } finally {
    await pool.end()
  }
}

createMemberProgramTable().catch(console.error)

