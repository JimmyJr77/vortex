#!/usr/bin/env node
import pkg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { seedDevTestMembers } from './seedDevTestMembers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'vortex_athletics',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
})

try {
  const result = await seedDevTestMembers(pool, { replace: true })
  console.log(`✅ Created ${result.created} dev test members (password: Vortex25!)`)
  for (const m of result.members ?? []) {
    console.log(`   - ${m.firstName} ${m.lastName}${m.email ? ` <${m.email}>` : ''}`)
  }
} catch (err) {
  console.error('❌', err.message)
  process.exit(1)
} finally {
  await pool.end()
}
