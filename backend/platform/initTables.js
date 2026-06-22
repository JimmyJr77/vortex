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
  ]

  for (const migrationFile of migrationFiles) {
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile)
    const sql = fs.readFileSync(migrationPath, 'utf8')
    await pool.query(sql)
  }

  await seedCanonicalWaivers(pool)

  console.log('✅ Platform access, billing, and waiver tables initialized')
}
