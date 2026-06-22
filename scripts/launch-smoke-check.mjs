import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const files = {
  server: readFileSync(resolve(root, 'backend/server.js'), 'utf8'),
  platformRoutes: readFileSync(resolve(root, 'backend/platform/registerRoutes.js'), 'utf8'),
  runMigration: readFileSync(resolve(root, 'backend/run-migration.js'), 'utf8'),
  login: readFileSync(resolve(root, 'src/components/Login.tsx'), 'utf8'),
}

const checks = [
  ['member password reset route', files.server.includes("/api/members/request-password-reset")],
  ['admin password reset route', files.server.includes("/api/admin/request-password-reset")],
  ['member change password route', files.server.includes("/api/members/change-password")],
  ['health check db signal', files.server.includes('dbConnected') && files.server.includes('schemaMigrationsTracked')],
  ['temporary auth token removed', !files.server.includes("token.startsWith('temp-admin-')")],
  ['payment provider config route', files.platformRoutes.includes("/api/admin/billing/provider-config")],
  ['payment reconciliation fields', files.platformRoutes.includes('external_reference') && files.platformRoutes.includes('external_status')],
  ['schema migrations ledger', files.runMigration.includes('schema_migrations') && files.runMigration.includes('--all')],
  ['admin login no temp token fallback', !files.login.includes('temp-admin-')],
  ['account login forgot password flow', files.login.includes('/api/members/request-password-reset')],
]

const failures = checks.filter(([, passed]) => !passed)
if (failures.length) {
  console.error('Launch smoke check failed:')
  for (const [label] of failures) console.error(`- ${label}`)
  process.exit(1)
}

console.log(`Launch smoke check passed (${checks.length} checks).`)
