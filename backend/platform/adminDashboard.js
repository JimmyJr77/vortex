const ACTIVE_SIGNUPS_CTE = `
  WITH active_signups AS (
    SELECT
      signup.id AS signup_id,
      signup.member_id,
      signup.form_id,
      COALESCE(signup.enrollment_start_date, signup.created_at::date) AS enrollment_start_date,
      form.title AS class_name,
      member.first_name,
      member.last_name,
      member.family_id,
      family.family_name
    FROM scheduling_signup signup
    JOIN member ON member.id = signup.member_id
    LEFT JOIN family ON family.id = member.family_id
    JOIN scheduling_form form ON form.id = signup.form_id
    LEFT JOIN scheduling_slot_group slot_group ON slot_group.id = signup.slot_group_id
    LEFT JOIN scheduling_offering offering ON offering.id = slot_group.offering_id
    WHERE signup.status = 'confirmed'
      AND signup.orphaned_at IS NULL
      AND signup.archived_at IS NULL
      AND member.facility_id = $1
      AND member.is_active = TRUE
      AND COALESCE(signup.enrollment_start_date, signup.created_at::date) <= CURRENT_DATE
      AND (signup.cancel_effective_date IS NULL OR signup.cancel_effective_date > CURRENT_DATE)
      AND (signup.pause_effective_date IS NULL OR signup.pause_effective_date > CURRENT_DATE)
      AND (COALESCE(offering.start_date, slot_group.active_start, form.start_date) IS NULL
        OR COALESCE(offering.start_date, slot_group.active_start, form.start_date) <= CURRENT_DATE)
      AND (COALESCE(offering.end_date, slot_group.active_end, form.end_date) IS NULL
        OR COALESCE(offering.end_date, slot_group.active_end, form.end_date) >= CURRENT_DATE)
  )
`

function numeric(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function displayName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Unnamed member'
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function buildRevenueMonths(rows = [], now = new Date()) {
  const amounts = new Map(rows.map((row) => [String(row.month_key), numeric(row.amount_cents)]))
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))
  return Array.from({ length: 6 }, () => {
    const key = monthKey(cursor)
    const label = cursor.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    return { key, label, amountCents: amounts.get(key) ?? 0 }
  })
}

async function safeQuery(pool, query, params = []) {
  try {
    return await pool.query(query, params)
  } catch (error) {
    // The dashboard remains usable during additive migration rollouts. The missing
    // section returns empty data while the rest of the account-health view loads.
    if (error?.code === '42P01' || error?.code === '42703') return { rows: [] }
    throw error
  }
}

async function enrollmentDashboard(pool, facilityId) {
  const [summary, classes, athletes, missingMemberships] = await Promise.all([
    safeQuery(pool, `${ACTIVE_SIGNUPS_CTE}
      SELECT
        COUNT(DISTINCT member_id)::int AS active_athletes,
        COUNT(*)::int AS active_classes,
        COUNT(DISTINCT member_id) FILTER (
          WHERE enrollment_start_date >= date_trunc('month', CURRENT_DATE)::date
        )::int AS gained_this_month,
        (
          SELECT COUNT(DISTINCT signup.member_id)::int
          FROM scheduling_signup signup
          JOIN member cancelled_member ON cancelled_member.id = signup.member_id
          WHERE signup.cancel_effective_date >= date_trunc('month', CURRENT_DATE)::date
            AND signup.cancel_effective_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
            AND cancelled_member.facility_id = $1
        ) AS lost_this_month
      FROM active_signups`, [facilityId]),
    safeQuery(pool, `${ACTIVE_SIGNUPS_CTE}
      SELECT
        class_name,
        COUNT(DISTINCT member_id)::int AS athlete_count,
        COUNT(*)::int AS enrollment_count
      FROM active_signups
      GROUP BY class_name
      ORDER BY athlete_count DESC, class_name ASC
      LIMIT 12`, [facilityId]),
    safeQuery(pool, `${ACTIVE_SIGNUPS_CTE}
      SELECT
        member_id,
        first_name,
        last_name,
        family_name,
        COUNT(*)::int AS class_count
      FROM active_signups
      GROUP BY member_id, first_name, last_name, family_name
      ORDER BY class_count DESC, last_name ASC, first_name ASC
      LIMIT 12`, [facilityId]),
    safeQuery(pool, `${ACTIVE_SIGNUPS_CTE}, active_memberships AS (
        SELECT DISTINCT member_id
        FROM billing_subscription
        WHERE (source_type = 'annual_membership' OR pricing_option_key = 'annual_membership')
          AND next_bill_date > CURRENT_DATE
      )
      SELECT DISTINCT ON (active_signups.member_id)
        active_signups.member_id,
        active_signups.first_name,
        active_signups.last_name,
        active_signups.family_name,
        COUNT(*) OVER (PARTITION BY active_signups.member_id)::int AS class_count
      FROM active_signups
      LEFT JOIN active_memberships ON active_memberships.member_id = active_signups.member_id
      WHERE active_memberships.member_id IS NULL
      ORDER BY active_signups.member_id, active_signups.last_name, active_signups.first_name
      LIMIT 50`, [facilityId]),
  ])

  const row = summary.rows[0] ?? {}
  return {
    activeAthletes: numeric(row.active_athletes),
    activeClasses: numeric(row.active_classes),
    gainedThisMonth: numeric(row.gained_this_month),
    lostThisMonth: numeric(row.lost_this_month),
    byClass: classes.rows.map((item) => ({
      className: item.class_name || 'Untitled class',
      athleteCount: numeric(item.athlete_count),
      enrollmentCount: numeric(item.enrollment_count),
    })),
    byAthlete: athletes.rows.map((item) => ({
      memberId: numeric(item.member_id),
      memberName: displayName(item),
      familyName: item.family_name || null,
      classCount: numeric(item.class_count),
    })),
    withoutMembership: missingMemberships.rows.map((item) => ({
      memberId: numeric(item.member_id),
      memberName: displayName(item),
      familyName: item.family_name || null,
      classCount: numeric(item.class_count),
    })),
  }
}

async function billingDashboard(pool, facilityId, now) {
  const [revenue, tuition, dropIns, memberships, withoutCard, withoutBilling] = await Promise.all([
    safeQuery(pool, `
      SELECT to_char(date_trunc('month', payment.paid_at), 'YYYY-MM') AS month_key,
             COALESCE(SUM(payment.amount_cents), 0)::int AS amount_cents
      FROM billing_payment payment
      JOIN family_billing_account account ON account.id = payment.family_billing_account_id
      JOIN family ON family.id = account.family_id
      WHERE payment.paid_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
        AND family.facility_id = $1
      GROUP BY date_trunc('month', payment.paid_at)
      ORDER BY date_trunc('month', payment.paid_at)`, [facilityId]),
    safeQuery(pool, `
      SELECT COALESCE(SUM(net_monthly_cents), 0)::int AS amount_cents
      FROM billing_subscription subscription
      JOIN family_billing_account account ON account.id = subscription.family_billing_account_id
      JOIN family ON family.id = account.family_id
      WHERE subscription.source_type = 'scheduling_signup'
        AND subscription.status = 'active'
        AND family.facility_id = $1`, [facilityId]),
    safeQuery(pool, `
      SELECT COUNT(*)::int AS total,
             COALESCE(SUM(amount_cents), 0)::int AS amount_cents
      FROM drop_in_registration registration
      JOIN member ON member.id = registration.member_id
      WHERE registration.created_at >= date_trunc('month', CURRENT_DATE)
        AND registration.status IN ('confirmed', 'attended')
        AND member.facility_id = $1`, [facilityId]),
    safeQuery(pool, `
      SELECT COUNT(DISTINCT member_id)::int AS total
      FROM billing_subscription subscription
      JOIN family_billing_account account ON account.id = subscription.family_billing_account_id
      JOIN family ON family.id = account.family_id
      WHERE (subscription.source_type = 'annual_membership' OR subscription.pricing_option_key = 'annual_membership')
        AND subscription.next_bill_date > CURRENT_DATE
        AND family.facility_id = $1`, [facilityId]),
    safeQuery(pool, `${ACTIVE_SIGNUPS_CTE}, account_enrollments AS (
        SELECT DISTINCT active_signups.member_id, active_signups.first_name, active_signups.last_name,
          active_signups.family_name, active_signups.family_id
        FROM active_signups
      )
      SELECT account_enrollments.member_id, account_enrollments.first_name, account_enrollments.last_name,
        account_enrollments.family_name, COUNT(active_signups.signup_id)::int AS class_count
      FROM account_enrollments
      JOIN active_signups ON active_signups.member_id = account_enrollments.member_id
      LEFT JOIN family_billing_account account ON account.family_id = account_enrollments.family_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM billing_subscription subscription
        WHERE subscription.family_billing_account_id = account.id
          AND subscription.source_type = 'scheduling_signup'
          AND subscription.status = 'active'
          AND subscription.stripe_subscription_id IS NOT NULL
      )
      GROUP BY account_enrollments.member_id, account_enrollments.first_name,
        account_enrollments.last_name, account_enrollments.family_name
      ORDER BY account_enrollments.last_name, account_enrollments.first_name
      LIMIT 50`, [facilityId]),
    safeQuery(pool, `${ACTIVE_SIGNUPS_CTE}
      SELECT active_signups.member_id, active_signups.first_name, active_signups.last_name,
        active_signups.family_name,
        COUNT(*) FILTER (WHERE subscription.id IS NULL)::int AS missing_schedule_count,
        COUNT(*)::int AS class_count
      FROM active_signups
      LEFT JOIN billing_subscription subscription
        ON subscription.source_type = 'scheduling_signup'
        AND subscription.source_id = active_signups.signup_id::text
        AND subscription.status = 'active'
      GROUP BY active_signups.member_id, active_signups.first_name,
        active_signups.last_name, active_signups.family_name
      HAVING COUNT(*) FILTER (WHERE subscription.id IS NULL) > 0
      ORDER BY missing_schedule_count DESC, active_signups.last_name, active_signups.first_name
      LIMIT 50`, [facilityId]),
  ])

  const dropIn = dropIns.rows[0] ?? {}
  return {
    revenueByMonth: buildRevenueMonths(revenue.rows, now),
    scheduledMonthlyTuitionCents: numeric(tuition.rows[0]?.amount_cents),
    dropInsThisMonth: numeric(dropIn.total),
    dropInRevenueCents: numeric(dropIn.amount_cents),
    activeAnnualMemberships: numeric(memberships.rows[0]?.total),
    withoutCard: withoutCard.rows.map((item) => ({
      memberId: numeric(item.member_id),
      memberName: displayName(item),
      familyName: item.family_name || null,
      classCount: numeric(item.class_count),
    })),
    withoutMonthlyBilling: withoutBilling.rows.map((item) => ({
      memberId: numeric(item.member_id),
      memberName: displayName(item),
      familyName: item.family_name || null,
      classCount: numeric(item.class_count),
      missingScheduleCount: numeric(item.missing_schedule_count),
    })),
  }
}

async function mediaReleaseOptOutDashboard(pool, facilityId) {
  const result = await safeQuery(pool, `
    WITH current_enrollments AS (
      SELECT
        signup.id AS signup_id,
        signup.member_id,
        form.title AS class_name,
        slot.schedule_mode,
        slot.specific_date,
        slot.day_of_week,
        slot.start_time,
        slot.end_time
      FROM scheduling_signup signup
      JOIN member enrolled_member ON enrolled_member.id = signup.member_id
      JOIN scheduling_form form ON form.id = signup.form_id
      LEFT JOIN scheduling_slot_group slot_group ON slot_group.id = signup.slot_group_id
      LEFT JOIN scheduling_offering offering ON offering.id = slot_group.offering_id
      LEFT JOIN LATERAL (
        SELECT time_slot.schedule_mode, time_slot.specific_date, time_slot.day_of_week,
          time_slot.start_time, time_slot.end_time
        FROM scheduling_time_slot time_slot
        WHERE time_slot.id = signup.time_slot_id

        UNION ALL

        SELECT group_slot.schedule_mode, group_slot.specific_date, group_slot.day_of_week,
          group_slot.start_time, group_slot.end_time
        FROM scheduling_time_slot group_slot
        WHERE signup.time_slot_id IS NULL
          AND group_slot.slot_group_id = signup.slot_group_id
      ) slot ON TRUE
      WHERE enrolled_member.facility_id = $1
        AND enrolled_member.is_active = TRUE
        AND signup.status = 'confirmed'
        AND signup.orphaned_at IS NULL
        AND signup.archived_at IS NULL
        AND COALESCE(signup.enrollment_start_date, signup.created_at::date) <= CURRENT_DATE
        AND (signup.cancel_effective_date IS NULL OR signup.cancel_effective_date > CURRENT_DATE)
        AND (signup.pause_effective_date IS NULL OR signup.pause_effective_date > CURRENT_DATE)
        AND (COALESCE(offering.start_date, slot_group.active_start, form.start_date) IS NULL
          OR COALESCE(offering.start_date, slot_group.active_start, form.start_date) <= CURRENT_DATE)
        AND (COALESCE(offering.end_date, slot_group.active_end, form.end_date) IS NULL
          OR COALESCE(offering.end_date, slot_group.active_end, form.end_date) >= CURRENT_DATE)
    )
    SELECT
      member.id AS member_id,
      member.first_name,
      member.last_name,
      family.family_name,
      (COUNT(DISTINCT current_enrollments.signup_id) > 0) AS is_active_student,
      COUNT(DISTINCT current_enrollments.signup_id)::int AS active_class_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'className', current_enrollments.class_name,
            'scheduleMode', current_enrollments.schedule_mode,
            'specificDate', current_enrollments.specific_date,
            'dayOfWeek', current_enrollments.day_of_week,
            'startTime', current_enrollments.start_time,
            'endTime', current_enrollments.end_time
          )
          ORDER BY current_enrollments.class_name,
            current_enrollments.day_of_week NULLS LAST,
            current_enrollments.specific_date NULLS LAST,
            current_enrollments.start_time NULLS LAST
        ) FILTER (WHERE current_enrollments.signup_id IS NOT NULL),
        '[]'::jsonb
      ) AS active_classes
    FROM member
    LEFT JOIN family ON family.id = member.family_id
    LEFT JOIN current_enrollments ON current_enrollments.member_id = member.id
    WHERE member.facility_id = $1
      AND EXISTS (
        SELECT 1
        FROM waiver_template template
        WHERE template.facility_id = member.facility_id
          AND template.waiver_type = 'MEDIA_RELEASE'
          AND template.active_from <= now()
          AND (template.active_to IS NULL OR template.active_to > now())
      )
      AND NOT EXISTS (
        SELECT 1
        FROM member_waiver_acceptance acceptance
        JOIN waiver_template template ON template.id = acceptance.waiver_template_id
        WHERE acceptance.member_id = member.id
          AND template.facility_id = member.facility_id
          AND template.waiver_type = 'MEDIA_RELEASE'
          AND template.active_from <= now()
          AND (template.active_to IS NULL OR template.active_to > now())
      )
    GROUP BY member.id, member.first_name, member.last_name, family.family_name
    ORDER BY is_active_student DESC, member.is_active DESC, member.last_name ASC, member.first_name ASC
  `, [facilityId])

  return result.rows.map((item) => ({
    memberId: numeric(item.member_id),
    memberName: displayName(item),
    familyName: item.family_name || null,
    isActiveStudent: item.is_active_student === true,
    activeClassCount: numeric(item.active_class_count),
    activeClasses: Array.isArray(item.active_classes)
      ? item.active_classes.map((enrollment) => ({
        className: enrollment.className || 'Untitled class',
        scheduleMode: enrollment.scheduleMode || null,
        specificDate: enrollment.specificDate || null,
        dayOfWeek: enrollment.dayOfWeek != null ? numeric(enrollment.dayOfWeek) : null,
        startTime: enrollment.startTime || null,
        endTime: enrollment.endTime || null,
      }))
      : [],
  }))
}

export async function getAdminDashboard(pool, {
  facilityId = null,
  canViewEnrollment = false,
  canViewBilling = false,
  canViewWaivers = false,
  now = new Date(),
} = {}) {
  const parsedFacilityId = Number(facilityId)
  const hasFacilityScope = Number.isInteger(parsedFacilityId) && parsedFacilityId > 0
  const [enrollment, billing, mediaReleaseOptOuts] = await Promise.all([
    canViewEnrollment && hasFacilityScope
      ? enrollmentDashboard(pool, parsedFacilityId)
      : null,
    canViewBilling && hasFacilityScope
      ? billingDashboard(pool, parsedFacilityId, now)
      : null,
    canViewEnrollment && canViewWaivers && hasFacilityScope
      ? mediaReleaseOptOutDashboard(pool, parsedFacilityId)
      : null,
  ])
  return {
    permissions: { canViewEnrollment, canViewBilling, canViewWaivers },
    generatedAt: now.toISOString(),
    enrollment,
    billing,
    mediaReleaseOptOuts,
  }
}
