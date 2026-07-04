import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { seedCanonicalWaivers } from './seedCanonicalWaivers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function initPlatformTables(pool) {
  const migrationFiles = [
    '008_member_access_billing_waivers.sql',
    '009_family_identity_cleanup.sql',
    '010_launch_payment_reconciliation.sql',
    '011_coaching_schema_taxonomy_permissions.sql',
    '012_coaching_exercise_library.sql',
    '013_coaching_workout_builder.sql',
    '014_coaching_training_program.sql',
    '015_coaching_challenges.sql',
    '016_coaching_assessments_grading.sql',
    '017_coaching_assignments_sharing.sql',
    '018_coaching_ai.sql',
    '019_coaching_seed_starter_library.sql',
    '020_coaching_workout_minutes.sql',
    '021_coaching_sessions_attendance.sql',
    '022_coaching_periodization_load.sql',
    '023_coaching_engagement.sql',
    '024_coaching_messaging.sql',
    '025_coaching_goals_achievements.sql',
    '026_coaching_thread_scope.sql',
    '027_coaching_form_review.sql',
    '028_coaching_embeddings.sql',
    '029_coaching_video_submission_assign.sql',
    '030_coach_class_scheduling_form.sql',
    '031_coach_assignment_drilldown.sql',
    '037_waiver_types.sql',
    '038_account_invite.sql',
    '039_member_graduation_year.sql',
    '040_email_verification.sql',
    '041_app_user_nullable_email.sql',
    '042_enrollment_receipt_token.sql',
    '043_account_invite_reminders.sql',
    '044_email_deliverability.sql',
    '045_drop_family_member_relationship_label.sql',
    '046_signup_billing_charges.sql',
    '047_stripe_billing_scaffold.sql',
    '053_billing_recurring_model.sql',
    '054_billing_anchor_first.sql',
    '055_enrollment_cancel_effective.sql',
    '056_stripe_catalog.sql',
    '057_stripe_pending_enrollment.sql',
    '058_billing_stripe_links.sql',
    '059_facility_portal_config.sql',
  ]

  for (const migrationFile of migrationFiles) {
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile)
    const sql = fs.readFileSync(migrationPath, 'utf8')
    try {
      await pool.query(sql)
    } catch (err) {
      // Migrations re-run on every local boot; tolerate duplicate DDL objects.
      if (/already exists/i.test(String(err.message))) {
        console.warn(`[initPlatformTables] Skipping duplicate in ${migrationFile}:`, err.message)
        continue
      }
      throw err
    }
  }

  await seedCanonicalWaivers(pool)

  console.log('✅ Platform access, billing, and waiver tables initialized')
}
