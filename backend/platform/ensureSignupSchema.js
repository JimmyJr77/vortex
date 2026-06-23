import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { seedCanonicalWaivers } from './seedCanonicalWaivers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let ensurePromise = null

/** Apply signup/waiver DDL idempotently (covers DBs that missed numbered migrations). */
export async function ensureSignupSchema(pool) {
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    const migrationDir = path.join(__dirname, '..', 'migrations')
    for (const file of [
      '037_waiver_types.sql',
      '038_account_invite.sql',
      '039_member_graduation_year.sql',
      '041_app_user_nullable_email.sql',
      '042_enrollment_receipt_token.sql',
      '043_account_invite_reminders.sql',
    ]) {
      const migrationPath = path.join(migrationDir, file)
      if (fs.existsSync(migrationPath)) {
        await pool.query(fs.readFileSync(migrationPath, 'utf8'))
      }
    }
    await seedCanonicalWaivers(pool)
  })()

  try {
    await ensurePromise
  } catch (err) {
    ensurePromise = null
    throw err
  }
}
