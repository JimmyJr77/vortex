import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pg from 'pg'

const { Pool } = pg
const here = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(here, '..', '.env.local') })
dotenv.config({ path: path.join(here, '..', '.env') })

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || 'vortex_athletics',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'vortex2024',
      },
)

const args = process.argv.slice(2)
const requestedVersion = args.find((arg) => /^\d+$/.test(arg))
const outputArg = args.find((arg) => arg.startsWith('--output='))
const outputPath = outputArg
  ? path.resolve(process.cwd(), outputArg.slice('--output='.length))
  : path.resolve(here, '..', '..', 'generated', 'marketing-visibility.json')

try {
  const result = requestedVersion
    ? await pool.query(
        `SELECT version, snapshot FROM marketing_publish_revisions WHERE version = $1 AND status <> 'cancelled'`,
        [Number(requestedVersion)],
      )
    : await pool.query(
        `SELECT version, snapshot FROM marketing_publish_revisions WHERE status <> 'cancelled' ORDER BY version DESC LIMIT 1`,
      )

  if (!result.rows[0]) {
    throw new Error('No implementation package found. Create one in Admin → Marketing & Visibility first.')
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(result.rows[0].snapshot, null, 2)}\n`)
  console.log(`Marketing visibility version ${result.rows[0].version} exported to ${outputPath}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await pool.end()
}
