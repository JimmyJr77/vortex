import jwt from 'jsonwebtoken'
import { resolveJwtSecret } from '../auth/jwtSecret.js'
import { formatDateOnly, resolveSlotActiveDates } from './slotActiveDates.js'
import { loadActiveAnnualMembership } from './annualMembership.js'
import { toUtcDateString } from './membershipAnniversary.js'
import { sendDropInConfirmationNotifications } from './dropInNotificationEmail.js'

const ACTIVE_REGISTRATION_STATUSES = ['account_required', 'confirmed', 'payment_pending']

export function isActiveSlotOccurrence(row, classDate) {
  const date = formatDateOnly(classDate)
  if (!date || row?.dates_tbd) return false
  const activeStart = formatDateOnly(row.active_start)
  const activeEnd = formatDateOnly(row.active_end)
  if (activeStart && date < activeStart) return false
  if (activeEnd && date > activeEnd) return false
  const specificDate = formatDateOnly(row.specific_date)
  if (specificDate) return date === specificDate
  if (row.day_of_week == null) return false
  return new Date(`${date}T12:00:00Z`).getUTCDay() === Number(row.day_of_week)
}

export function resolveDropInOutcome({ member, benefits, useFreeTrial }) {
  const benefitType = useFreeTrial
    ? 'free_trial'
    : benefits.annualCreditsRemaining > 0
      ? 'annual_credit'
      : benefits.adminCreditsRemaining > 0 ? 'admin_credit' : 'paid'
  return {
    benefitType,
    status: member ? 'confirmed' : 'account_required',
  }
}

export function calculateDropInPrice({ monthlyCents, annualMember, discountPercent = 0, isFree = false }) {
  const divisor = annualMember ? 4 : 3
  const baseCents = Math.max(0, Math.round(Number(monthlyCents || 0) / divisor))
  const safeDiscount = annualMember
    ? Math.min(100, Math.max(0, Number(discountPercent || 0)))
    : 0
  const discountCents = Math.round(baseCents * safeDiscount / 100)
  return {
    baseCents,
    discountPercent: safeDiscount,
    discountCents,
    totalCents: isFree ? 0 : Math.max(0, baseCents - discountCents),
  }
}

export function calculateDropInAvailability({ maxParticipants, monthlyEnrolled, dropInEnrolled }) {
  const maximum = Math.max(0, Number(maxParticipants) || 0)
  const monthly = Math.max(0, Number(monthlyEnrolled) || 0)
  const dropIns = Math.max(0, Number(dropInEnrolled) || 0)
  const totalAttending = monthly + dropIns
  return {
    monthlyEnrolled: monthly,
    dropInEnrolled: dropIns,
    totalAttending,
    spotsRemaining: Math.max(0, maximum - totalAttending),
    isFull: totalAttending >= maximum,
  }
}

export function occurrenceDatesThroughTwoMonths(dayOfWeek, now = new Date()) {
  const result = []
  const cursor = new Date(now)
  cursor.setHours(12, 0, 0, 0)
  const end = new Date(cursor)
  end.setMonth(end.getMonth() + 2)
  for (let offset = 0; ; offset += 1) {
    const date = new Date(cursor)
    date.setDate(cursor.getDate() + offset)
    if (date > end) break
    if (date.getDay() !== Number(dayOfWeek)) continue
    result.push(date.toISOString().slice(0, 10))
  }
  return result
}

function dateInTwoMonthWindow(date, now = new Date()) {
  const value = formatDateOnly(date)
  if (!value) return false
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 2)
  return value >= formatDateOnly(start) && value <= formatDateOnly(end)
}

function monthlyCentsFromOptions(options, fallback = 0) {
  const rows = Array.isArray(options) ? options : []
  const one = rows.find((row) => row?.enabled !== false && row?.key === 'monthly_1x')
  const flat = rows.find((row) => row?.enabled !== false && row?.key === 'monthly_flat')
  return Math.max(0, Number(one?.amountCents ?? flat?.amountCents ?? fallback ?? 0))
}

function normalizePromoCode(value) {
  return String(value ?? '').trim().toUpperCase()
}

async function expirePendingDropIns(pool) {
  const expired = await pool.query(
    `UPDATE drop_in_registration
        SET status = 'cancelled', updated_at = now()
      WHERE status = 'account_required'
        AND expires_at IS NOT NULL
        AND expires_at <= now()
      RETURNING id, free_pass_template_id`,
  )
  const templateCounts = new Map()
  for (const row of expired.rows) {
    await pool.query(
      `DELETE FROM free_pass_redemption
        WHERE context->>'sourceType' = 'drop_in'
          AND context->>'dropInRegistrationId' = $1`,
      [String(row.id)],
    )
    if (row.free_pass_template_id == null) continue
    const id = Number(row.free_pass_template_id)
    templateCounts.set(id, (templateCounts.get(id) ?? 0) + 1)
  }
  for (const [templateId, count] of templateCounts) {
    await pool.query(
      `UPDATE free_pass_template
          SET redeemed_count = GREATEST(0, redeemed_count - $2), updated_at = now()
        WHERE id = $1`,
      [templateId, count],
    )
  }
}

export async function resolveDropInFreePass(pool, { member, email = null, promoCode, slot }) {
  const code = normalizePromoCode(promoCode)
  const scopeSql = `
    AND (
      t.scope_level = 'global'
      OR (t.scope_level = 'program' AND t.scope_ref_id = $2)
      OR (t.scope_level = 'class' AND t.scope_ref_id = $3)
      OR (t.scope_level = 'offering' AND t.scope_ref_id = $4)
    )`
  if (code) {
    const result = await pool.query(
      `SELECT t.id AS template_id
         FROM free_pass_template t
        WHERE t.active = TRUE
          AND (t.starts_at IS NULL OR t.starts_at <= now())
          AND (t.ends_at IS NULL OR t.ends_at >= now())
          AND upper(COALESCE(t.issuance->>'promo_code', '')) = $1
          AND COALESCE((t.issuance->>'admin_only')::boolean, FALSE) = FALSE
          AND (t.max_redemptions IS NULL OR t.redeemed_count < t.max_redemptions)
          AND (
            t.config->>'max_redemptions_per_member' IS NULL
            OR (
              SELECT COUNT(*)
              FROM drop_in_registration used
              WHERE used.free_pass_template_id = t.id
                AND used.status IN ('account_required','payment_pending','confirmed','attended')
                AND (
                  ($5::bigint IS NOT NULL AND used.member_id = $5)
                  OR ($6::text IS NOT NULL AND lower(used.email) = lower($6))
                )
            ) < (t.config->>'max_redemptions_per_member')::int
          )
          ${scopeSql}
        ORDER BY t.id
        LIMIT 1
        FOR UPDATE OF t`,
      [code, slot.program_id, slot.form_id, slot.offering_id, member?.id ?? null, email],
    )
    return result.rows[0]
      ? { benefitType: 'promo_code', templateId: Number(result.rows[0].template_id), promoCode: code }
      : { error: 'That free-day code is invalid, expired, or not available for this class.' }
  }
  if (!member) return null
  const result = await pool.query(
    `SELECT g.id AS grant_id, t.id AS template_id
       FROM member_free_pass g
       JOIN free_pass_template t ON t.id = g.pass_template_id
      WHERE g.member_id = $1
        AND g.quantity_remaining > 0
        AND (g.expires_at IS NULL OR g.expires_at >= now())
        AND t.active = TRUE
        AND (t.starts_at IS NULL OR t.starts_at <= now())
        AND (t.ends_at IS NULL OR t.ends_at >= now())
        AND (t.max_redemptions IS NULL OR t.redeemed_count < t.max_redemptions)
        ${scopeSql}
      ORDER BY COALESCE(g.expires_at, 'infinity'::timestamptz), g.issued_at, g.id
      LIMIT 1
      FOR UPDATE OF g, t`,
    [member.id, slot.program_id, slot.form_id, slot.offering_id],
  )
  return result.rows[0]
    ? {
        benefitType: 'free_pass',
        grantId: Number(result.rows[0].grant_id),
        templateId: Number(result.rows[0].template_id),
      }
    : null
}

async function resolveMember(pool, req) {
  let token = req.headers.authorization?.split(' ')[1]
  let decoded = null
  if (token) {
    try { decoded = jwt.verify(token, resolveJwtSecret()) } catch { decoded = null }
  }
  const identityId = decoded?.userId ?? decoded?.memberId ?? null
  if (identityId != null) {
    const result = await pool.query(
      `SELECT * FROM member WHERE id = $1 OR app_user_id = $1 ORDER BY (id = $1) DESC LIMIT 1`,
      [identityId],
    )
    if (result.rows[0]) return result.rows[0]
  }
  return null
}

async function resolveBookingMember(pool, authenticatedMember, { firstName, lastName }) {
  if (!authenticatedMember) return null
  const result = await pool.query(
    `SELECT *
       FROM member
      WHERE is_active = TRUE
        AND (
          id = $1
          OR (family_id IS NOT NULL AND family_id = $2)
        )
        AND lower(trim(first_name)) = lower(trim($3))
        AND lower(trim(last_name)) = lower(trim($4))
      ORDER BY (id = $1) DESC, id
      LIMIT 1`,
    [authenticatedMember.id, authenticatedMember.family_id, firstName, lastName],
  )
  return result.rows[0] ?? null
}

async function memberBenefits(pool, member) {
  if (!member) return {
    annualMember: false,
    annualCreditsRemaining: 0,
    adminCreditsRemaining: 0,
    trialAvailable: true,
    discountPercent: 0,
  }
  await pool.query(
    `INSERT INTO member_drop_in_entitlement (member_id) VALUES ($1)
     ON CONFLICT (member_id) DO NOTHING`,
    [member.id],
  )
  const membership = await loadActiveAnnualMembership(pool, member.id)
  const annualMember = Boolean(membership?.active)
  const cycleStart = membership?.cycleStart ?? null
  const cycleEnd = membership?.renewsOn ?? null
  await pool.query(
    `UPDATE member_drop_in_entitlement
        SET annual_cycle_started_at = $2,
            annual_cycle_expires_at = $3,
            annual_credits_granted = $4,
            updated_at = now()
      WHERE member_id = $1`,
    [
      member.id,
      annualMember && cycleStart ? cycleStart.toISOString() : null,
      annualMember && cycleEnd ? `${toUtcDateString(cycleEnd)}T12:00:00.000Z` : null,
      annualMember ? 4 : 0,
    ],
  )
  const usage = await pool.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE benefit_type = 'annual_credit'
           AND created_at >= $2::timestamptz
           AND created_at < $3::timestamptz
       )::int AS annual_used,
       COUNT(*) FILTER (WHERE benefit_type = 'admin_credit')::int AS admin_used,
       COUNT(*) FILTER (WHERE benefit_type = 'free_trial')::int AS trials_used
     FROM drop_in_registration
     WHERE member_id = $1
       AND status IN ('account_required','payment_pending','confirmed','attended')`,
    [
      member.id,
      annualMember && cycleStart ? cycleStart.toISOString() : new Date(0).toISOString(),
      annualMember && cycleEnd
        ? `${toUtcDateString(cycleEnd)}T12:00:00.000Z`
        : new Date(0).toISOString(),
    ],
  )
  const entitlement = await pool.query(
    `SELECT lifetime_trial_granted, annual_credits_granted, admin_credits_granted,
            annual_cycle_started_at, annual_cycle_expires_at
       FROM member_drop_in_entitlement WHERE member_id = $1`,
    [member.id],
  )
  const recorded = entitlement.rows[0] ?? {}
  const passGrants = await pool.query(
    `SELECT COALESCE(SUM(g.quantity_remaining), 0)::int AS remaining
       FROM member_free_pass g
       JOIN free_pass_template t ON t.id = g.pass_template_id
      WHERE g.member_id = $1
        AND g.quantity_remaining > 0
        AND (g.expires_at IS NULL OR g.expires_at >= now())
        AND t.active = TRUE
        AND (t.starts_at IS NULL OR t.starts_at <= now())
        AND (t.ends_at IS NULL OR t.ends_at >= now())`,
    [member.id],
  ).catch(() => ({ rows: [{ remaining: 0 }] }))
  const pricing = await pool.query(
    `SELECT pricing_breakdown
       FROM scheduling_signup
      WHERE member_id = $1 AND status = 'confirmed' AND pricing_breakdown IS NOT NULL
      ORDER BY created_at DESC LIMIT 1`,
    [member.id],
  ).catch(() => ({ rows: [] }))
  const breakdown = pricing.rows[0]?.pricing_breakdown ?? {}
  const list = Number(breakdown.nonDiscountedCents ?? breakdown.listCents ?? 0)
  const net = Number(breakdown.netCents ?? breakdown.finalCents ?? list)
  const discountPercent = list > 0 ? Math.max(0, Math.min(100, ((list - net) / list) * 100)) : 0
  return {
    annualMember,
    annualCycleStartedAt: recorded.annual_cycle_started_at ?? null,
    annualCycleExpiresAt: recorded.annual_cycle_expires_at ?? null,
    annualCreditsGranted: Number(recorded.annual_credits_granted || 0),
    annualCreditsRemaining: annualMember
      ? Math.max(0, Number(recorded.annual_credits_granted || 0) - Number(usage.rows[0]?.annual_used || 0))
      : 0,
    adminCreditsRemaining: Math.max(
      0,
      Number(recorded.admin_credits_granted || 0) - Number(usage.rows[0]?.admin_used || 0),
    ),
    freePassesRemaining: Number(passGrants.rows[0]?.remaining || 0),
    trialAvailable:
      Number(recorded.lifetime_trial_granted || 0) > Number(usage.rows[0]?.trials_used || 0),
    discountPercent,
  }
}

export async function initDropInTables(pool) {
  const { ensureProgramDropInColumns } = await import('../programs/schema.js')
  await ensureProgramDropInColumns(pool)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drop_in_registration (
      id BIGSERIAL PRIMARY KEY,
      member_id BIGINT REFERENCES member(id) ON DELETE SET NULL,
      form_id BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
      slot_group_id BIGINT NOT NULL REFERENCES scheduling_slot_group(id) ON DELETE CASCADE,
      class_date DATE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      benefit_type TEXT NOT NULL DEFAULT 'paid' CHECK (benefit_type IN ('paid','free_trial','annual_credit')),
      base_price_cents INTEGER NOT NULL DEFAULT 0,
      discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('account_required','payment_pending','confirmed','attended','cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (member_id, slot_group_id, class_date)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_drop_in_slot_date ON drop_in_registration(slot_group_id, class_date, status)`)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_drop_in_lifetime_trial_member ON drop_in_registration(member_id) WHERE benefit_type='free_trial' AND member_id IS NOT NULL AND status <> 'cancelled'`)
  await pool.query(`
    ALTER TABLE drop_in_registration
      ADD COLUMN IF NOT EXISTS member_confirmation_email_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS team_notification_email_sent_at TIMESTAMPTZ
  `)
  const fs = await import('fs')
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const migrationPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations/add_drop_in_entitlements.sql')
  await pool.query(fs.readFileSync(migrationPath, 'utf8'))
}

async function loadCatalog(pool, member, { includeExcluded = false } = {}) {
  await expirePendingDropIns(pool)
  const benefits = await memberBenefits(pool, member)
  const result = await pool.query(`
    SELECT sg.id AS slot_group_id, sf.id AS form_id,
           sg.schedule_mode, sg.max_participants, sg.active_start, sg.active_end,
           sg.offering_id, sg.inherits_offering_dates, sg.dates_tbd,
           sf.start_date AS form_start_date, sf.end_date AS form_end_date,
           offering.start_date AS offering_start_date, offering.end_date AS offering_end_date,
           ts.day_of_week, ts.specific_date, ts.start_time, ts.end_time,
           p.id AS class_id, p.display_name AS class_name, p.description AS class_description, p.skill_level,
           p.age_min, p.age_max,
           top.id AS program_id, top.display_name AS program_name, top.description AS program_description,
           COALESCE(top.exclude_from_drop_ins, FALSE) AS excluded_from_drop_ins,
           primary_dt.name AS sport_name,
           COALESCE(top.pricing_cost_options, '[]'::jsonb) AS pricing_options,
           COALESCE(top.pricing_slot_cost_monthly_cents, sf.slot_cost_monthly_cents, 0) AS fallback_monthly_cents,
           (SELECT COUNT(*) FROM scheduling_signup s WHERE s.slot_group_id=sg.id AND s.status='confirmed')::int AS monthly_enrolled
      FROM scheduling_slot_group sg
      JOIN scheduling_form sf ON sf.id=sg.form_id AND sf.deleted_at IS NULL
      JOIN scheduling_time_slot ts ON ts.slot_group_id=sg.id AND ts.is_active=TRUE
      JOIN program p ON p.id=sf.program_id
      JOIN programs top ON top.id=COALESCE(sf.programs_id, p.programs_id)
      LEFT JOIN discipline_tag primary_dt ON primary_dt.id=top.primary_discipline_tag_id
      LEFT JOIN scheduling_offering offering ON offering.id=sg.offering_id
     WHERE sg.is_active=TRUE
       AND COALESCE(p.is_active, TRUE)=TRUE
       AND COALESCE(p.archived, FALSE)=FALSE
       AND COALESCE(top.is_active, TRUE)=TRUE
       AND COALESCE(top.archived, FALSE)=FALSE
       ${includeExcluded ? '' : 'AND COALESCE(top.exclude_from_drop_ins, FALSE)=FALSE'}
     ORDER BY primary_dt.name, top.display_name, p.display_name,
              ts.day_of_week, ts.specific_date, ts.start_time
  `)
  const registrationCounts = await pool.query(
    `SELECT slot_group_id, class_date, COUNT(*)::int AS count
       FROM drop_in_registration
      WHERE status = ANY($1)
        AND class_date >= CURRENT_DATE
        AND class_date <= (CURRENT_DATE + INTERVAL '2 months')::date
      GROUP BY slot_group_id, class_date`,
    [ACTIVE_REGISTRATION_STATUSES],
  )
  const dropInCountByOccurrence = new Map(
    registrationCounts.rows.map((row) => [
      `${Number(row.slot_group_id)}:${formatDateOnly(row.class_date)}`,
      Number(row.count),
    ]),
  )
  const monthlyEnrollmentCounts = await pool.query(
    `SELECT slot_group_id, enrollment_start_date, cancel_effective_date, COUNT(*)::int AS count
       FROM scheduling_signup
      WHERE status = 'confirmed'
        AND slot_group_id IS NOT NULL
        AND orphaned_at IS NULL
        AND archived_at IS NULL
      GROUP BY slot_group_id, enrollment_start_date, cancel_effective_date`,
  )
  const monthlyStartsByGroup = new Map()
  for (const row of monthlyEnrollmentCounts.rows) {
    const groupId = Number(row.slot_group_id)
    const starts = monthlyStartsByGroup.get(groupId) ?? []
    starts.push({
      date: formatDateOnly(row.enrollment_start_date),
      cancelEffectiveDate: formatDateOnly(row.cancel_effective_date),
      count: Number(row.count),
    })
    monthlyStartsByGroup.set(groupId, starts)
  }
  const sessions = []
  const classesById = new Map()
  for (const row of result.rows) {
    const offeringById = row.offering_id == null ? null : new Map([[Number(row.offering_id), {
      start_date: row.offering_start_date,
      end_date: row.offering_end_date,
    }]])
    const activeDates = resolveSlotActiveDates(row, {
      start_date: row.form_start_date,
      end_date: row.form_end_date,
    }, offeringById)
    const specificDate = formatDateOnly(row.specific_date)
    const dates = specificDate
      ? (dateInTwoMonthWindow(specificDate) ? [specificDate] : [])
      : occurrenceDatesThroughTwoMonths(row.day_of_week)
    const monthlyCents = monthlyCentsFromOptions(row.pricing_options, row.fallback_monthly_cents)
    const price = calculateDropInPrice({ monthlyCents, annualMember: benefits.annualMember, discountPercent: benefits.discountPercent })
    if (!classesById.has(Number(row.class_id))) {
      classesById.set(Number(row.class_id), {
        formId: Number(row.form_id), classId: Number(row.class_id), className: row.class_name,
        classDescription: row.class_description, programId: Number(row.program_id),
        programName: row.program_name, programDescription: row.program_description,
        sportName: row.sport_name, skillLevel: row.skill_level,
        ageMin: row.age_min != null ? Number(row.age_min) : null,
        ageMax: row.age_max != null ? Number(row.age_max) : null,
        excludedFromDropIns: Boolean(row.excluded_from_drop_ins),
        monthlyCents, ...price,
      })
    }
    for (const date of dates) {
      if (activeDates.datesTbd) continue
      if (activeDates.activeStart && date < activeDates.activeStart) continue
      if (activeDates.activeEnd && date > activeDates.activeEnd) continue
      const availability = calculateDropInAvailability({
        maxParticipants: row.max_participants,
        monthlyEnrolled: (monthlyStartsByGroup.get(Number(row.slot_group_id)) ?? [])
          .filter((entry) =>
            entry.date && entry.date <= date &&
            (!entry.cancelEffectiveDate || entry.cancelEffectiveDate > date),
          )
          .reduce((sum, entry) => sum + entry.count, 0),
        dropInEnrolled: dropInCountByOccurrence.get(`${Number(row.slot_group_id)}:${date}`) ?? 0,
      })
      sessions.push({
        slotGroupId: Number(row.slot_group_id), formId: Number(row.form_id),
        offeringId: row.offering_id != null ? Number(row.offering_id) : null,
        classId: Number(row.class_id), className: row.class_name,
        classDescription: row.class_description,
        programId: Number(row.program_id), programName: row.program_name,
        programDescription: row.program_description,
        sportName: row.sport_name, skillLevel: row.skill_level,
        ageMin: row.age_min != null ? Number(row.age_min) : null,
        ageMax: row.age_max != null ? Number(row.age_max) : null,
        excludedFromDropIns: Boolean(row.excluded_from_drop_ins),
        scheduleDayOfWeek: row.day_of_week != null ? Number(row.day_of_week) : null,
        activeStart: activeDates.activeStart,
        activeEnd: activeDates.activeEnd,
        date,
        startTime: String(row.start_time).slice(0, 5), endTime: String(row.end_time).slice(0, 5),
        maxParticipants: Number(row.max_participants), ...availability,
        enrolled: availability.totalAttending,
        monthlyCents, ...price,
      })
    }
  }
  return { classes: [...classesById.values()], sessions, benefits }
}

async function loadDropInClassInventory(pool) {
  const result = await pool.query(
    `SELECT p.id AS "classId", p.display_name AS "className",
            top.id AS "programId", top.display_name AS "programName",
            COALESCE(top.exclude_from_drop_ins, FALSE) AS "excludedFromDropIns",
            sf.id AS "formId",
            COUNT(DISTINCT offering.id)::int AS "offeringCount",
            COUNT(DISTINCT sg.id)::int AS "slotGroupCount",
            COALESCE(MAX(sg.max_participants), 0)::int AS "largestRegistrationLimit",
            COUNT(DISTINCT signup.id) FILTER (WHERE signup.status = 'confirmed')::int AS "monthlyRegistrations"
       FROM program p
       JOIN programs top ON top.id = p.programs_id
       LEFT JOIN scheduling_form sf
         ON sf.program_id = p.id AND sf.deleted_at IS NULL
       LEFT JOIN scheduling_offering offering ON offering.form_id = sf.id
       LEFT JOIN scheduling_slot_group sg ON sg.form_id = sf.id AND sg.is_active = TRUE
       LEFT JOIN scheduling_signup signup ON signup.slot_group_id = sg.id
      WHERE COALESCE(p.archived, FALSE) = FALSE
        AND COALESCE(top.archived, FALSE) = FALSE
      GROUP BY p.id, p.display_name, top.id, top.display_name,
               top.exclude_from_drop_ins, sf.id
      ORDER BY top.display_name, p.display_name, sf.id`,
  )
  return result.rows
}

export function registerDropInRoutes(app, pool) {
  app.get('/api/public/drop-ins', async (req, res) => {
    try {
      const member = await resolveMember(pool, req)
      res.json({ success: true, data: await loadCatalog(pool, member) })
    } catch (error) {
      console.error('[drop-ins] catalog:', error)
      res.status(500).json({ success: false, message: 'Failed to load drop-in classes' })
    }
  })

  app.get('/api/admin/scheduling/drop-ins/overview', async (_req, res) => {
    try {
      const catalog = await loadCatalog(pool, null, { includeExcluded: true })
      const classInventory = await loadDropInClassInventory(pool)
      const registrations = await pool.query(
        `SELECT d.id, d.member_id AS "memberId", d.form_id AS "formId",
                d.slot_group_id AS "slotGroupId", d.class_date AS "classDate",
                d.first_name AS "firstName", d.last_name AS "lastName", d.email,
                d.benefit_type AS "benefitType", d.amount_cents AS "amountCents",
                d.status, d.created_at AS "createdAt"
           FROM drop_in_registration d
          WHERE d.class_date >= CURRENT_DATE - INTERVAL '2 months'
          ORDER BY d.class_date, d.id`,
      )
      res.json({
        success: true,
        data: { ...catalog, classInventory, registrations: registrations.rows },
      })
    } catch (error) {
      console.error('[drop-ins] admin overview:', error)
      res.status(500).json({ success: false, message: 'Failed to load drop-in overview' })
    }
  })

  app.get('/api/admin/scheduling/members/:memberId/drop-in-benefits', async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM member WHERE id = $1`, [Number(req.params.memberId)])
      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Member not found' })
      res.json({ success: true, data: await memberBenefits(pool, result.rows[0]) })
    } catch (error) {
      console.error('[drop-ins] member benefits:', error)
      res.status(500).json({ success: false, message: 'Failed to load member drop-in benefits' })
    }
  })

  app.post('/api/admin/scheduling/members/:memberId/drop-in-credits', async (req, res) => {
    const client = await pool.connect()
    try {
      const memberId = Number(req.params.memberId)
      const quantity = Number(req.body?.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({ success: false, message: 'Quantity must be between 1 and 100.' })
      }
      await client.query('BEGIN')
      const member = await client.query(`SELECT * FROM member WHERE id = $1 FOR UPDATE`, [memberId])
      if (!member.rows[0]) {
        await client.query('ROLLBACK')
        return res.status(404).json({ success: false, message: 'Member not found' })
      }
      await client.query(
        `INSERT INTO member_drop_in_entitlement (member_id, admin_credits_granted)
         VALUES ($1, $2)
         ON CONFLICT (member_id) DO UPDATE
           SET admin_credits_granted = member_drop_in_entitlement.admin_credits_granted + EXCLUDED.admin_credits_granted,
               updated_at = now()
         RETURNING member_id`,
        [memberId, quantity],
      )
      await client.query(
        `INSERT INTO drop_in_credit_adjustment
          (member_id, quantity, reason, admin_user_id)
         VALUES ($1, $2, $3, $4)`,
        [
          memberId,
          quantity,
          String(req.body?.reason ?? 'Admin-issued drop-in credits').trim(),
          req.adminId ?? null,
        ],
      )
      const benefits = await memberBenefits(client, member.rows[0])
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: benefits })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      if (error?.code === '23503') return res.status(404).json({ success: false, message: 'Member not found' })
      console.error('[drop-ins] add member credits:', error)
      res.status(500).json({ success: false, message: 'Failed to add drop-in credits' })
    } finally { client.release() }
  })

  app.post('/api/public/drop-ins/register', async (req, res) => {
    const client = await pool.connect()
    try {
      const { slotGroupId, classDate, firstName, lastName, email, phone, useFreeTrial, promoCode } = req.body || {}
      const authenticatedMember = await resolveMember(client, req)
      const bookingEmail = authenticatedMember?.email?.trim() || String(email ?? '').trim()
      const bookingPhone = authenticatedMember?.phone?.trim() || String(phone ?? '').trim() || null
      if (!slotGroupId || !/^\d{4}-\d{2}-\d{2}$/.test(String(classDate)) || !firstName || !lastName || !bookingEmail) {
        return res.status(400).json({ success: false, message: 'Class, date, athlete name, and email are required.' })
      }
      await client.query('BEGIN')
      await expirePendingDropIns(client)
      const member = await resolveBookingMember(client, authenticatedMember, { firstName, lastName })
      if (authenticatedMember && !member) {
        await client.query('ROLLBACK')
        return res.status(400).json({
          success: false,
          message: 'Select an athlete already on your family account, or add this athlete before booking.',
        })
      }
      if (!authenticatedMember) {
        const existingAccount = await client.query(
          `SELECT 1 FROM member WHERE lower(email) = lower($1) AND is_active = TRUE LIMIT 1`,
          [bookingEmail],
        )
        if (existingAccount.rows[0]) {
          await client.query('ROLLBACK')
          return res.status(409).json({
            success: false,
            message: 'An account already uses this email. Sign in before booking to use its passes or member rate.',
          })
        }
      }
      const benefits = await memberBenefits(client, member)
      const slot = await client.query(`
        SELECT sg.id, sg.form_id, sg.max_participants, sg.offering_id, sf.title,
               sg.dates_tbd, ts.day_of_week, ts.specific_date,
               CASE
                 WHEN offering.id IS NOT NULL
                   AND (sg.inherits_offering_dates OR (sg.active_start IS NULL AND sg.active_end IS NULL))
                 THEN offering.start_date
                 ELSE COALESCE(sg.active_start, sf.start_date)
               END AS active_start,
               CASE
                 WHEN offering.id IS NOT NULL
                   AND (sg.inherits_offering_dates OR (sg.active_start IS NULL AND sg.active_end IS NULL))
                 THEN offering.end_date
                 ELSE COALESCE(sg.active_end, sf.end_date)
               END AS active_end,
               COALESCE(top.pricing_cost_options,'[]'::jsonb) AS pricing_options,
               top.id AS program_id,
               COALESCE(top.pricing_slot_cost_monthly_cents, sf.slot_cost_monthly_cents, 0) AS fallback_monthly_cents,
               (SELECT COUNT(*) FROM scheduling_signup s
                 WHERE s.slot_group_id=sg.id
                   AND s.status='confirmed'
                   AND s.orphaned_at IS NULL
                   AND s.archived_at IS NULL
                   AND (s.cancel_effective_date IS NULL OR s.cancel_effective_date > $2::date)
                   AND s.enrollment_start_date <= $2::date)::int AS monthly_enrolled
          FROM scheduling_slot_group sg
          JOIN scheduling_form sf ON sf.id=sg.form_id AND sf.deleted_at IS NULL
          JOIN scheduling_time_slot ts ON ts.slot_group_id=sg.id AND ts.is_active=TRUE
          LEFT JOIN scheduling_offering offering ON offering.id=sg.offering_id
          JOIN program p ON p.id=sf.program_id
          JOIN programs top ON top.id=COALESCE(sf.programs_id,p.programs_id)
         WHERE sg.id=$1 AND sg.is_active=TRUE
           AND COALESCE(p.is_active, TRUE)=TRUE
           AND COALESCE(p.archived, FALSE)=FALSE
           AND COALESCE(top.is_active, TRUE)=TRUE
           AND COALESCE(top.archived, FALSE)=FALSE
           AND COALESCE(top.exclude_from_drop_ins, FALSE)=FALSE
         FOR UPDATE OF sg`, [slotGroupId, classDate])
      if (!slot.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Class not found.' }) }
      if (!slot.rows.some((row) => isActiveSlotOccurrence(row, classDate))) {
        await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: 'That date is not an active occurrence of this class.' })
      }
      if (!dateInTwoMonthWindow(classDate)) {
        await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: 'Drop-ins may be booked up to two months in advance.' })
      }
      const existing = await client.query(`SELECT COUNT(*)::int AS count FROM drop_in_registration WHERE slot_group_id=$1 AND class_date=$2 AND status=ANY($3)`, [slotGroupId, classDate, ACTIVE_REGISTRATION_STATUSES])
      if (Number(slot.rows[0].monthly_enrolled) + Number(existing.rows[0].count) >= Number(slot.rows[0].max_participants)) {
        await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'That class is full.' })
      }
      if (useFreeTrial && !benefits.trialAvailable) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'The one-time free trial has already been used.' }) }
      const freePass = useFreeTrial
        ? null
        : await resolveDropInFreePass(client, {
            member,
            email: bookingEmail,
            promoCode,
            slot: slot.rows[0],
          })
      if (freePass?.error) {
        await client.query('ROLLBACK')
        return res.status(400).json({ success: false, message: freePass.error })
      }
      const defaultOutcome = resolveDropInOutcome({ member, benefits, useFreeTrial })
      const benefitType = freePass?.benefitType ?? defaultOutcome.benefitType
      const status = defaultOutcome.status
      const monthlyCents = monthlyCentsFromOptions(slot.rows[0].pricing_options, slot.rows[0].fallback_monthly_cents)
      const price = calculateDropInPrice({ monthlyCents, annualMember: benefits.annualMember, discountPercent: benefits.discountPercent, isFree: benefitType !== 'paid' })
      const inserted = await client.query(
        `INSERT INTO drop_in_registration
          (member_id,form_id,slot_group_id,class_date,first_name,last_name,email,phone,
           benefit_type,free_pass_template_id,member_free_pass_id,promo_code,
           base_price_cents,discount_percent,amount_cents,status,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,lower($7),$8,$9,$10,$11,$12,$13,$14,$15,$16,
                CASE WHEN $16 = 'account_required' THEN now() + INTERVAL '1 hour' ELSE NULL END)
         RETURNING id`,
        [
          member?.id ?? null, slot.rows[0].form_id, slotGroupId, classDate,
          String(firstName).trim(), String(lastName).trim(), bookingEmail, bookingPhone,
          benefitType, freePass?.templateId ?? null, freePass?.grantId ?? null,
          freePass?.promoCode ?? null, price.baseCents, price.discountPercent, price.totalCents, status,
        ],
      )
      if (freePass?.grantId) {
        await client.query(
          `UPDATE member_free_pass
              SET quantity_remaining = quantity_remaining - 1
            WHERE id = $1 AND quantity_remaining > 0`,
          [freePass.grantId],
        )
      }
      if (freePass?.templateId) {
        await client.query(
          `UPDATE free_pass_template
              SET redeemed_count = redeemed_count + 1, updated_at = now()
            WHERE id = $1
              AND (max_redemptions IS NULL OR redeemed_count < max_redemptions)`,
          [freePass.templateId],
        )
        await client.query(
          `INSERT INTO free_pass_redemption
            (member_pass_id, pass_template_id, member_id, units, amount_cents_credited, context)
           VALUES ($1, $2, $3, 1, $4, $5::jsonb)`,
          [
            freePass.grantId ?? null,
            freePass.templateId,
            member?.id ?? null,
            price.baseCents,
            JSON.stringify({
              sourceType: 'drop_in',
              dropInRegistrationId: Number(inserted.rows[0].id),
              classDate,
              promoCode: freePass.promoCode ?? null,
            }),
          ],
        )
      }
      if (benefitType === 'paid' && member && price.totalCents > 0) {
        const account = await client.query(
          `SELECT id FROM family_billing_account WHERE family_id=$1 LIMIT 1`,
          [member.family_id],
        )
        if (!account.rows[0]) throw new Error('Member billing account not found')
        await client.query(
          `INSERT INTO billing_charge
             (family_billing_account_id, member_id, source_type, source_id, description,
              amount_cents, gross_amount_cents, discount_amount_cents, charge_type, billing_interval,
              service_period_start, service_period_end)
           VALUES ($1,$2,'drop_in',$3,$4,$5,$6,$7,'one_time','one_time',$8,$8)
           ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING`,
          [account.rows[0].id, member.id, String(inserted.rows[0].id), `${slot.rows[0].title} drop-in — ${classDate}`, price.totalCents, price.baseCents, price.discountCents, classDate],
        )
      }
      await client.query('COMMIT')
      if (status === 'confirmed') {
        try {
          await sendDropInConfirmationNotifications(pool, Number(inserted.rows[0].id))
        } catch (emailError) {
          console.error('[drop-ins] confirmation notifications:', emailError?.message || emailError)
        }
      }
      res.status(201).json({ success: true, data: { id: Number(inserted.rows[0].id), status, benefitType, enrollmentStartDate: classDate, ...price, accountRequired: status === 'account_required', signupUrl: status === 'account_required' ? `/signup/family?dropIn=${inserted.rows[0].id}` : null } })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'This free trial or class date has already been registered.' })
      console.error('[drop-ins] register:', error)
      res.status(500).json({ success: false, message: 'Failed to register for this drop-in.' })
    } finally { client.release() }
  })
}
