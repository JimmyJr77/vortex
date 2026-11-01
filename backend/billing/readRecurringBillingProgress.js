import 'dotenv/config'
import dotenv from 'dotenv'
import pg from 'pg'
dotenv.config({ path: '.env.local', quiet: true })

// Operational inspection only. The database rejects all mutations in this
// session, including if a future status query accidentally tries to write.
const connectionString = process.env.DATABASE_URL || process.env.EXTERNAL_DB_URL || process.env.DB_URL
const pool = new pg.Pool({ connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString ?? '') ? false : { rejectUnauthorized: false },
  options: '-c default_transaction_read_only=on -c statement_timeout=30000',
  connectionTimeoutMillis: 15000,
})
pool.on('error', error => console.error('[billing:worker-status]', error.message))
try {
  const runs = (await pool.query('SELECT * FROM billing_recurring_run ORDER BY started_at DESC LIMIT 5')).rows
  const accounts = (await pool.query(`SELECT progress.*,family.family_name
    FROM billing_recurring_account_progress progress
    JOIN family_billing_account account ON account.id=progress.family_billing_account_id
    JOIN family ON family.id=account.family_id
    WHERE run_id=ANY($1::uuid[]) ORDER BY run_id,phase,family_billing_account_id`, [runs.map(run => run.id)])).rows
  console.log(JSON.stringify(runs.map(run => ({ ...run,
    accounts: accounts.filter(row => row.run_id === run.id),
  })), null, 2))
} catch (error) {
  console.error('[billing:worker-status]', error.message)
  process.exitCode = 1
} finally { await pool.end() }
