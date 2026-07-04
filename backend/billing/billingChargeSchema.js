/**
 * billing_charge idempotency index (046) + Stripe checkout links (058).
 * Required before persistSignupCharges ON CONFLICT upserts.
 */

let billingChargeSchemaEnsured = false

async function runMigrationFile(pool, relativePath) {
  const fs = await import('fs')
  const migrationPath = new URL(relativePath, import.meta.url)
  await pool.query(fs.readFileSync(migrationPath, 'utf8'))
}

export async function ensureBillingChargeSchema(pool) {
  if (billingChargeSchemaEnsured) return
  await runMigrationFile(pool, '../migrations/046_signup_billing_charges.sql')
  await runMigrationFile(pool, '../migrations/058_billing_stripe_links.sql')
  billingChargeSchemaEnsured = true
}
