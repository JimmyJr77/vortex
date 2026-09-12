import { ensureEmployerSetup } from './employerSetup.js'
import fs from 'node:fs/promises'

const migrationUrl = new URL('../migrations/812_payroll_operations.sql', import.meta.url)

export async function initPayrollTables(pool) {
  const sql = await fs.readFile(migrationUrl, 'utf8')
  // Historical employer/employee/payment seeds are a one-time import, never a startup action.
  // Replaying them copies employer identity across workplaces, overwrites rates, and duplicates historical payments.
  const seedStart = sql.indexOf('\nINSERT INTO payroll_settings (')
  if (seedStart < 0) throw new Error('Payroll foundation seed boundary is missing.')
  const extension=await fs.readFile(new URL('../migrations/813_payroll_onboarding.sql', import.meta.url), 'utf8')
  const client=await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('vortex-payroll-schema'))")
    await client.query(sql.slice(0, seedStart))
    await client.query(extension)
    for(const facility of (await client.query('SELECT id FROM facility')).rows)await ensureEmployerSetup(client,facility.id)
    await client.query('COMMIT')
  } catch(error) {
    await client.query('ROLLBACK').catch(()=>{})
    throw error
  } finally {client.release()}
}
