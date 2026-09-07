import fs from 'node:fs/promises'

const migrationUrl = new URL('../migrations/812_payroll_operations.sql', import.meta.url)

export async function initPayrollTables(pool) {
  const sql = await fs.readFile(migrationUrl, 'utf8')
  await pool.query(sql)
}
