import { buildSlotDisplayLabel, loadGroupDisplayLabels } from './slotDisplayLabel.js'

export async function loadDailyReportActivity(pool, { since, through, newSignupIds = [] }) {
  const { rows } = await pool.query(
    `WITH activity AS (
       SELECT action.signup_id, NULL::bigint AS member_id, NULL::text AS class_name,
              CASE WHEN action.requested_status = 'confirmed' THEN 'add' ELSE 'drop' END AS kind,
              CASE
                WHEN action.requested_status = 'confirmed' AND action.status = 'pending' THEN 'Activation scheduled'
                WHEN action.requested_status = 'confirmed' AND action.previous_status = 'waitlisted' THEN 'Promoted from waitlist'
                WHEN action.requested_status = 'confirmed' THEN 'Reactivated'
                WHEN action.requested_status = 'waitlisted' AND action.status = 'pending' THEN 'Move to waitlist scheduled'
                WHEN action.requested_status = 'waitlisted' THEN 'Moved to waitlist'
                WHEN action.requested_status = 'paused' THEN 'Paused'
                WHEN action.status = 'pending' THEN 'Cancellation scheduled'
                ELSE 'Cancelled'
              END AS status,
              action.effective_date::text AS effective_date,
              COALESCE(action.applied_at, action.requested_at) AS occurred_at,
              3 AS priority
         FROM enrollment_action action
        WHERE action.status IN ('pending', 'applied')
          AND ((action.requested_status = 'confirmed' AND action.previous_status <> 'confirmed')
            OR (action.requested_status = 'cancelled' AND action.previous_status <> 'cancelled')
            OR (action.requested_status = 'paused' AND action.previous_status = 'confirmed' AND action.status = 'applied')
            OR (action.requested_status = 'waitlisted' AND action.previous_status IN ('confirmed', 'paused')))
       UNION ALL
       SELECT request.signup_id, NULL, NULL, 'drop',
              CASE WHEN request.status = 'pending' THEN 'Cancellation requested · awaiting review'
                   ELSE 'Cancellation approved' END,
              request.approved_effective_date::text,
              COALESCE(request.reviewed_at, request.created_at), 3
         FROM enrollment_cancellation_request request
        WHERE request.status IN ('pending', 'approved')
       UNION ALL
       SELECT signup.id, NULL, NULL, 'drop',
              CASE WHEN signup.status = 'cancelled' THEN 'Cancelled' ELSE 'Cancellation scheduled' END,
              signup.cancel_effective_date::text, signup.cancel_requested_at, 1
         FROM scheduling_signup signup
        WHERE signup.cancel_requested_at IS NOT NULL
          AND signup.cancel_effective_date IS NOT NULL
       UNION ALL
       SELECT signup.id, NULL, NULL, 'drop', 'Paused',
              COALESCE(signup.pause_effective_date, (signup.paused_at AT TIME ZONE 'America/New_York')::date)::text,
              signup.paused_at, 1
         FROM scheduling_signup signup
        WHERE signup.status = 'paused' AND signup.paused_at IS NOT NULL
       UNION ALL
       SELECT COALESCE(event.signup_id, (event.after_value->>'signupId')::bigint), event.member_id,
              event.before_value->>'className', 'drop',
              CASE event.event_type
                WHEN 'enrollment_class_swapped' THEN 'Moved to another class'
                WHEN 'unpaid_enrollment_deleted' THEN 'Enrollment deleted'
                WHEN 'enrollment_cancellation_scheduled' THEN 'Cancellation scheduled'
                ELSE 'Cancelled'
              END,
              COALESCE(event.details->>'effectiveDate', event.after_value->>'cancelEffectiveDate'),
              event.occurred_at, 2
         FROM billing_account_activity event
        WHERE event.occurred_at >= $1::timestamptz AND event.occurred_at < $2::timestamptz
          AND event.event_type IN ('enrollment_class_swapped', 'unpaid_enrollment_deleted',
                                  'enrollment_cancellation_scheduled', 'enrollment_cancelled_immediately')
       UNION ALL
       SELECT signup.id, NULL, NULL, 'drop', 'Class time removed',
              NULL, signup.orphaned_at, 2
         FROM scheduling_signup signup
        WHERE signup.status_at_orphaning IN ('confirmed', 'paused')
     ), recent AS (
       SELECT DISTINCT ON (signup_id, kind) *
         FROM activity
        WHERE occurred_at >= $1::timestamptz AND occurred_at < $2::timestamptz
          AND (kind = 'drop' OR NOT (signup_id = ANY($3::bigint[])))
        ORDER BY signup_id, kind, occurred_at DESC, priority DESC
     )
     SELECT recent.signup_id, recent.kind, recent.status, recent.effective_date,
            COALESCE(NULLIF(BTRIM(member.first_name), ''), NULLIF(BTRIM(signup.first_name), ''), '') AS first_name,
            COALESCE(NULLIF(BTRIM(member.last_name), ''), NULLIF(BTRIM(signup.last_name), ''), '') AS last_name,
            COALESCE(NULLIF(BTRIM(program.display_name), ''), NULLIF(BTRIM(program.name), ''),
                     recent.class_name, signup.orphaned_snapshot->>'formTitle', form.title) AS class_name,
            signup.slot_group_id, signup.orphaned_snapshot->>'slotLabel' AS former_schedule,
            slot.week_letter, slot.schedule_mode, slot.specific_date::text, slot.day_of_week,
            slot.start_time, slot.end_time
       FROM recent
       LEFT JOIN scheduling_signup signup ON signup.id = recent.signup_id
       LEFT JOIN member ON member.id = COALESCE(recent.member_id, signup.member_id)
       LEFT JOIN scheduling_form form ON form.id = signup.form_id
       LEFT JOIN program ON program.id = form.program_id
       LEFT JOIN scheduling_time_slot slot ON slot.id = signup.time_slot_id
      ORDER BY recent.occurred_at DESC, recent.signup_id DESC`,
    [since, through, newSignupIds],
  )

  const { labels } = await loadGroupDisplayLabels(pool, rows.map((row) => row.slot_group_id), { activeOnly: true })
  const activity = { adds: [], drops: [] }
  for (const row of rows) {
    const changes = row.kind === 'add' ? activity.adds : activity.drops
    changes.push({
      signupId: Number(row.signup_id),
      name: `${row.first_name} ${row.last_name}`.trim() || 'Unnamed athlete',
      className: row.class_name || null,
      scheduleLabel: labels.get(Number(row.slot_group_id)) || row.former_schedule || buildSlotDisplayLabel(row),
      effectiveDate: row.effective_date,
      status: row.status,
    })
  }
  return activity
}
