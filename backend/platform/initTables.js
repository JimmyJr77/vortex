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
    '048_program_pricing_cost_options.sql',
    '049_multi_class_pass.sql',
    '053_billing_recurring_model.sql',
    '054_billing_anchor_first.sql',
    '055_enrollment_cancel_effective.sql',
    '056_stripe_catalog.sql',
    '057_stripe_pending_enrollment.sql',
    '058_billing_stripe_links.sql',
    '059_facility_portal_config.sql',
    '060_coaching_message_enhancements.sql',
    '061_coaching_message_sender_portal.sql',
    '062_coaching_message_thread_favorite.sql',
    '063_coaching_message_thread_inbox_hide.sql',
    '064_coaching_message_attachments.sql',
    '065_coaching_message_platform_foundation.sql',
    '066_coaching_message_files_alerts.sql',
    '067_coaching_message_collaboration.sql',
    '068_coaching_message_pin_groups.sql',
    '069_coaching_thread_faq_master_list.sql',
    '070_event_calendar_and_rsvp.sql',
    '071_thread_signup_sheets.sql',
    '072_collaboration_panel_lifecycle.sql',
    '073_event_calendar_item_classes.sql',
    '074_member_messaging_create_permissions.sql',
    '075_coaching_tenet_flexibility_mobility.sql',
    '076_coaching_methodology_hiit.sql',
    '077_event_calendar_item_what_to_bring.sql',
    '078_coaching_session_phases.sql',
    '079_coaching_education_content.sql',
    '080_coaching_exercise_programming.sql',
    '081_coaching_exercise_backfill.sql',
    '082_coaching_workout_metadata.sql',
    '083_coaching_validation_rules.sql',
    '084_coaching_training_block.sql',
    '085_coaching_regimen_template.sql',
    '086_coaching_session_templates.sql',
    '087_coaching_phase_order_slot_education.sql',
    '088_archive_orphan_scheduling_forms.sql',
    '089_drop_class_iteration.sql',
    '090_drop_member_program.sql',
    '091_drop_admins_and_trim_roles.sql',
    '092_drop_sport_pricing_default.sql',
    '093_coaching_skill_library.sql',
    '094_coaching_skill_evaluation.sql',
    '095_coaching_exercise_card_v2.sql',
    '096_coaching_prepare_access_subroles.sql',
    '097_coaching_prepare_access_seed.sql',
    '098_coaching_prepare_access_foundation_cards.sql',
    '099_coaching_prepare_access_content_support.sql',
    '100_coaching_prepare_access_upper_body_cards.sql',
    '101_coaching_prepare_access_lower_leg_cards.sql',
    '102_coaching_prepare_access_hip_access_cards.sql',
    '103_coaching_prepare_access_activation_cards.sql',
    '104_coaching_skill_phase_infrastructure.sql',
    '105_coaching_skill_movement_intelligence_seed.sql',
    '106_coaching_skill_shape_cards.sql',
    '107_coaching_skill_tumbling_cards.sql',
    '108_coaching_skill_sprint_cards.sql',
    '109_coaching_skill_balance_cards.sql',
    '110_coaching_skill_perception_cards.sql',
    '111_coaching_output_phase_infrastructure.sql',
    '112_coaching_output_seed.sql',
    '113_coaching_output_acceleration_cards.sql',
    '114_coaching_output_max_velocity_cards.sql',
    '115_coaching_output_elastic_cards.sql',
    '116_coaching_education_dedupe_framework.sql',
    '117_coaching_output_jump_power_cards.sql',
    '118_coaching_output_decel_cod_cards.sql',
    '119_coaching_output_reactive_tumbling_cards.sql',
    '120_coaching_capacity_phase_infrastructure.sql',
    '121_coaching_capacity_seed.sql',
    '122_coaching_capacity_squat_cards.sql',
    '123_coaching_capacity_hinge_cards.sql',
    '124_coaching_capacity_push_cards.sql',
    '125_coaching_capacity_pull_cards.sql',
    '126_coaching_capacity_carry_cards.sql',
    '127_coaching_capacity_tissue_cards.sql',
    '128_coaching_control_resilience_phase_infrastructure.sql',
    '129_coaching_control_resilience_seed.sql',
    '130_coaching_control_landing_cards.sql',
    '131_coaching_control_single_leg_cards.sql',
    '132_coaching_control_trunk_cards.sql',
    '133_coaching_control_scapular_cards.sql',
    '134_coaching_control_slow_eccentric_cards.sql',
  ]

  for (const migrationFile of migrationFiles) {
    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile)
    const sql = fs.readFileSync(migrationPath, 'utf8')
    try {
      await pool.query(sql)
    } catch (err) {
      const msg = String(err.message || err)
      // Migrations re-run on every boot; tolerate duplicate DDL/DML conflicts.
      if (/already exists|duplicate key value violates unique constraint/i.test(msg)) {
        console.warn(`[initPlatformTables] Skipping duplicate in ${migrationFile}:`, msg)
        continue
      }
      console.error(`[initPlatformTables] Migration ${migrationFile} failed (continuing):`, msg)
    }
  }

  await seedCanonicalWaivers(pool)

  console.log('✅ Platform access, billing, and waiver tables initialized')
}
