import { loadRevenueForecast } from './adminRevenueForecast.js'
import { settledRefundPredicate } from '../billing/billingLedgerSql.js'
import { loadEnrollmentTrend } from './adminEnrollmentTrend.js'
import { currentHouseholdLinkSql, familyIsActiveSql, familyIsEnrolledSql } from '../newAdmin/householdStatus.js'
import { currentEnrollmentSql, memberHasActiveMembershipSql, memberIsActiveSql } from '../newAdmin/memberActivity.js'

const CURRENT_ENROLLMENTS_CTE = `
  WITH ctx AS (
    SELECT ($2::timestamptz AT TIME ZONE COALESCE(NULLIF(timezone,''),'America/New_York'))::date AS today
    FROM facility WHERE id=$1
  ), current_enrollments AS (
    SELECT signup.id AS signup_id,signup.record_member_id AS member_id,signup.form_id,
      signup.enrollment_start_date,signup.record_class_name AS class_name,
      member.first_name,member.last_name,family.id AS family_id,family.family_name
    FROM account_enrollment_current signup
    JOIN member ON member.id=signup.record_member_id AND member.facility_id=signup.record_facility_id
    CROSS JOIN ctx
    LEFT JOIN LATERAL (
      SELECT f.id,f.family_name FROM family f
      WHERE f.facility_id=$1
        AND ${currentHouseholdLinkSql('member', 'f.id')}
      ORDER BY f.id LIMIT 1
    ) family ON TRUE
    WHERE signup.record_facility_id=$1
      AND ${currentEnrollmentSql('ctx.today', 'signup')}
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

async function enrollmentDashboard(pool, facilityId, now) {
  const [summary, classes, athletes, missingMemberships] = await Promise.all([
    safeQuery(pool, `${CURRENT_ENROLLMENTS_CTE}
      SELECT
        (SELECT COUNT(*)::int FROM member m CROSS JOIN ctx
          WHERE m.facility_id=$1
            AND ${memberIsActiveSql('m.id', '$1', 'ctx.today')}) AS active_athletes,
        (SELECT COUNT(*)::int FROM family f CROSS JOIN ctx
          WHERE f.facility_id=$1 AND ${familyIsActiveSql('f.id', '$1', 'ctx.today')}) AS active_families,
        COUNT(DISTINCT member_id)::int AS enrolled_athletes,
        (SELECT COUNT(*)::int FROM family f CROSS JOIN ctx
          WHERE f.facility_id=$1 AND ${familyIsEnrolledSql('f.id', '$1', 'ctx.today')}) AS enrolled_families,
        COUNT(*)::int AS current_enrollment_count,
        COUNT(DISTINCT member_id) FILTER (
          WHERE enrollment_start_date >= date_trunc('month', (SELECT today FROM ctx))::date
        )::int AS gained_this_month,
        (
          SELECT COUNT(DISTINCT signup.member_id)::int
          FROM scheduling_signup signup
          JOIN member cancelled_member ON cancelled_member.id = signup.member_id
          WHERE signup.cancel_effective_date >= date_trunc('month', (SELECT today FROM ctx))::date
            AND signup.cancel_effective_date < (date_trunc('month', (SELECT today FROM ctx)) + INTERVAL '1 month')::date
            AND cancelled_member.facility_id = $1
        ) AS lost_this_month
      FROM current_enrollments`, [facilityId, now.toISOString()]),
    safeQuery(pool, `${CURRENT_ENROLLMENTS_CTE}
      SELECT
        class_name,
        COUNT(DISTINCT member_id)::int AS athlete_count,
        COUNT(*)::int AS enrollment_count
      FROM current_enrollments
      GROUP BY class_name
      ORDER BY athlete_count DESC, class_name ASC
      LIMIT 12`, [facilityId, now.toISOString()]),
    safeQuery(pool, `${CURRENT_ENROLLMENTS_CTE}
      SELECT
        member_id,
        first_name,
        last_name,
        family_name,
        COUNT(*)::int AS class_count
      FROM current_enrollments
      GROUP BY member_id, first_name, last_name, family_name
      ORDER BY class_count DESC, last_name ASC, first_name ASC
      LIMIT 12`, [facilityId, now.toISOString()]),
    safeQuery(pool, `${CURRENT_ENROLLMENTS_CTE}
      SELECT DISTINCT ON (current_enrollments.member_id)
        current_enrollments.member_id,current_enrollments.first_name,current_enrollments.last_name,
        current_enrollments.family_name,
        COUNT(*) OVER (PARTITION BY current_enrollments.member_id)::int AS class_count
      FROM current_enrollments CROSS JOIN ctx
      WHERE NOT ${memberHasActiveMembershipSql('current_enrollments.member_id', 'ctx.today')}
      ORDER BY current_enrollments.member_id,current_enrollments.last_name,current_enrollments.first_name
      LIMIT 50`, [facilityId, now.toISOString()]),
  ])

  const row = summary.rows[0] ?? {}
  return {
    activeAthletes: numeric(row.active_athletes),
    activeFamilies: numeric(row.active_families),
    enrolledAthletes: numeric(row.enrolled_athletes),
    enrolledFamilies: numeric(row.enrolled_families),
    currentEnrollments: numeric(row.current_enrollment_count),
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

// Cash collections are net of completed refunds in the month the refund was
// recorded, even when the original payment belongs to an earlier month.
export async function loadNetCollectedRevenue(pool, facilityId, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)).toISOString()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
  return safeQuery(pool, `
    WITH revenue_movements AS (
      SELECT payment.paid_at AS occurred_at, payment.amount_cents
      FROM account_payment_current payment
      WHERE payment.record_facility_id = $1
        AND payment.external_status IN ('settled', 'succeeded')
        AND payment.paid_at >= $2::timestamptz AND payment.paid_at < $3::timestamptz
      UNION ALL
      SELECT refund.created_at AS occurred_at, -refund.amount_cents
      FROM account_refund_current refund
      WHERE refund.record_facility_id = $1 AND ${settledRefundPredicate('refund')}
        AND refund.created_at >= $2::timestamptz AND refund.created_at < $3::timestamptz

    )
    SELECT to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month_key,
           SUM(amount_cents)::int AS amount_cents
    FROM revenue_movements
    GROUP BY 1 ORDER BY 1`, [facilityId, start, end])
}

async function billingDashboard(pool, facilityId, now) {
  const [revenue, tuition, dropIns, memberships, withoutCard, withoutBilling, forecast] = await Promise.all([
    loadNetCollectedRevenue(pool, facilityId, now),
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
      SELECT COUNT(*)::int AS total FROM member m
      JOIN facility ON facility.id=m.facility_id
      WHERE m.facility_id=$1
        AND ${memberHasActiveMembershipSql('m.id', "($2::timestamptz AT TIME ZONE COALESCE(NULLIF(facility.timezone,''),'America/New_York'))::date")}`,
    [facilityId, now.toISOString()]),
    safeQuery(pool, `${CURRENT_ENROLLMENTS_CTE}, account_enrollments AS (
        SELECT DISTINCT current_enrollments.member_id, current_enrollments.first_name, current_enrollments.last_name,
          current_enrollments.family_name, current_enrollments.family_id
        FROM current_enrollments
      )
      SELECT account_enrollments.member_id, account_enrollments.first_name, account_enrollments.last_name,
        account_enrollments.family_name, COUNT(current_enrollments.signup_id)::int AS class_count
      FROM account_enrollments
      JOIN current_enrollments ON current_enrollments.member_id = account_enrollments.member_id
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
      LIMIT 50`, [facilityId, now.toISOString()]),
    safeQuery(pool, `${CURRENT_ENROLLMENTS_CTE}
      SELECT current_enrollments.member_id, current_enrollments.first_name, current_enrollments.last_name,
        current_enrollments.family_name,
        COUNT(*) FILTER (WHERE subscription.id IS NULL)::int AS missing_schedule_count,
        COUNT(*)::int AS class_count
      FROM current_enrollments
      LEFT JOIN billing_subscription subscription
        ON subscription.source_type = 'scheduling_signup'
        AND subscription.source_id = current_enrollments.signup_id::text
        AND subscription.status = 'active'
      GROUP BY current_enrollments.member_id, current_enrollments.first_name,
        current_enrollments.last_name, current_enrollments.family_name
      HAVING COUNT(*) FILTER (WHERE subscription.id IS NULL) > 0
      ORDER BY missing_schedule_count DESC, current_enrollments.last_name, current_enrollments.first_name
      LIMIT 50`, [facilityId, now.toISOString()]),
    loadRevenueForecast(pool, facilityId, now),
  ])

  const dropIn = dropIns.rows[0] ?? {}
  const revenueByMonth = buildRevenueMonths(revenue.rows, now)
  return {
    revenueByMonth,
    revenueForecast: forecast.map((month, index) => ({ ...month, expectedCents: index === 0
      ? month.owedCents + (revenueByMonth.at(-1)?.amountCents ?? 0)
      : month.expectedCents })),
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

async function mediaReleaseOptOutDashboard(pool, facilityId, now) {
  const result = await safeQuery(pool, `
    ${CURRENT_ENROLLMENTS_CTE}, current_enrollment_schedules AS (
      SELECT signup.signup_id,signup.member_id,signup.class_name,
        slot.schedule_mode,slot.specific_date,slot.day_of_week,slot.start_time,slot.end_time
      FROM current_enrollments signup
      JOIN scheduling_signup live_signup ON live_signup.id=signup.signup_id
      LEFT JOIN LATERAL (
        SELECT time_slot.schedule_mode, time_slot.specific_date, time_slot.day_of_week,
          time_slot.start_time, time_slot.end_time
        FROM scheduling_time_slot time_slot
        WHERE time_slot.id = live_signup.time_slot_id

        UNION ALL

        SELECT group_slot.schedule_mode, group_slot.specific_date, group_slot.day_of_week,
          group_slot.start_time, group_slot.end_time
        FROM scheduling_time_slot group_slot
        WHERE live_signup.time_slot_id IS NULL
          AND group_slot.slot_group_id = live_signup.slot_group_id
      ) slot ON TRUE
    )
    SELECT
      member.id AS member_id,
      member.first_name,
      member.last_name,
      family.family_name,
      (COUNT(DISTINCT current_enrollment_schedules.signup_id) > 0) AS enrolled,
      COUNT(DISTINCT current_enrollment_schedules.signup_id)::int AS current_enrollment_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'className', current_enrollment_schedules.class_name,
            'scheduleMode', current_enrollment_schedules.schedule_mode,
            'specificDate', current_enrollment_schedules.specific_date,
            'dayOfWeek', current_enrollment_schedules.day_of_week,
            'startTime', current_enrollment_schedules.start_time,
            'endTime', current_enrollment_schedules.end_time
          )
          ORDER BY current_enrollment_schedules.class_name,
            current_enrollment_schedules.day_of_week NULLS LAST,
            current_enrollment_schedules.specific_date NULLS LAST,
            current_enrollment_schedules.start_time NULLS LAST
        ) FILTER (WHERE current_enrollment_schedules.signup_id IS NOT NULL),
        '[]'::jsonb
      ) AS current_classes
    FROM member
    LEFT JOIN family ON family.id = member.family_id
    LEFT JOIN current_enrollment_schedules ON current_enrollment_schedules.member_id = member.id
    WHERE member.facility_id = $1
      AND COALESCE(member.signup_source,'') <> 'jackrabbit_history_merged'
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
    ORDER BY enrolled DESC, member.is_active DESC, member.last_name ASC, member.first_name ASC
  `, [facilityId, now.toISOString()])

  return result.rows.map((item) => ({
    memberId: numeric(item.member_id),
    memberName: displayName(item),
    familyName: item.family_name || null,
    enrolled: item.enrolled === true,
    currentEnrollmentCount: numeric(item.current_enrollment_count),
    currentClasses: Array.isArray(item.current_classes)
      ? item.current_classes.map((enrollment) => ({
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
  const [enrollment, billing, mediaReleaseOptOuts, enrollmentTrend] = await Promise.all([
    canViewEnrollment && hasFacilityScope
      ? enrollmentDashboard(pool, parsedFacilityId, now)
      : null,
    canViewBilling && hasFacilityScope
      ? billingDashboard(pool, parsedFacilityId, now)
      : null,
    canViewEnrollment && canViewWaivers && hasFacilityScope
      ? mediaReleaseOptOutDashboard(pool, parsedFacilityId, now)
      : null,
    canViewEnrollment && hasFacilityScope ? loadEnrollmentTrend(pool, parsedFacilityId, now) : null,
  ])
  return {
    permissions: { canViewEnrollment, canViewBilling, canViewWaivers },
    generatedAt: now.toISOString(),
    enrollment,
    billing,
    mediaReleaseOptOuts,
    enrollmentTrend,
  }
}
