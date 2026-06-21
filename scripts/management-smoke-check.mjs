import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const files = {
  platformRoutes: readFileSync(resolve(root, 'backend/platform/registerRoutes.js'), 'utf8'),
  server: readFileSync(resolve(root, 'backend/server.js'), 'utf8'),
  portalSession: readFileSync(resolve(root, 'src/utils/portalSession.ts'), 'utf8'),
  adminAccess: readFileSync(resolve(root, 'src/components/AdminAccess.tsx'), 'utf8'),
  adminCoaches: readFileSync(resolve(root, 'src/components/AdminCoaches.tsx'), 'utf8'),
}

const checks = [
  ['unified access account create route', files.platformRoutes.includes("app.post('/api/admin/access/users'")],
  ['access account activation route', files.platformRoutes.includes("app.patch('/api/admin/access/users/:userId/active'")],
  ['admin account routes use app_user', files.server.includes('FROM app_user au') && files.server.includes('INSERT INTO app_user')],
  ['legacy admin permission map exists', files.server.includes('legacyAdminPermissionFor')],
  ['family relationship route exists', files.server.includes("relationshipLabel") && files.server.includes('/relationship')],
  ['member family self-service route exists', files.server.includes("app.post('/api/members/family'")],
  ['coach assignment routes exist', files.platformRoutes.includes("app.post('/api/admin/coaches/:userId/assignments'")],
  ['coach roster notes exist', files.platformRoutes.includes('coach_roster_note')],
  ['billing payments route exists', files.platformRoutes.includes("app.post('/api/admin/families/:familyId/payments'")],
  ['waiver compliance route exists', files.platformRoutes.includes("app.get('/api/admin/waivers/compliance'")],
  ['shared portal session helpers exist', files.portalSession.includes('getAvailablePortals') && files.portalSession.includes('clearPortalSession')],
  ['access UI supports deny overrides', files.adminAccess.includes('denyPermissions')],
  ['coach admin UI exists', files.adminCoaches.includes('Coach Management')],
]

const failures = checks.filter(([, passed]) => !passed)
if (failures.length > 0) {
  console.error('Management smoke check failed:')
  for (const [name] of failures) console.error(`- ${name}`)
  process.exit(1)
}

console.log(`Management smoke check passed (${checks.length} checks).`)
