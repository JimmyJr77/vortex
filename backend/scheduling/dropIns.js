import jwt from 'jsonwebtoken'
import { resolveJwtSecret } from '../auth/jwtSecret.js'

const ACTIVE_REGISTRATION_STATUSES = ['confirmed', 'payment_pending']

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

function nextDates(dayOfWeek, count = 6) {
  const result = []
  const cursor = new Date()
  cursor.setHours(12, 0, 0, 0)
  for (let offset = 0; result.length < count && offset < 60; offset += 1) {
    const date = new Date(cursor)
    date.setDate(cursor.getDate() + offset)
    if (date.getDay() !== Number(dayOfWeek)) continue
    result.push(date.toISOString().slice(0, 10))
  }
  return result
}

function monthlyCentsFromOptions(options, fallback = 0) {
  const rows = Array.isArray(options) ? options : []
  const one = rows.find((row) => row?.enabled !== false && row?.key === 'monthly_1x')
  const flat = rows.find((row) => row?.enabled !== false && row?.key === 'monthly_flat')
  return Math.max(0, Number(one?.amountCents ?? flat?.amountCents ?? fallback ?? 0))
}

async function resolveMember(pool, req, email = null) {
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
  if (!email) return null
  const result = await pool.query(
    `SELECT * FROM member WHERE lower(email) = lower($1) ORDER BY is_active DESC, id DESC LIMIT 1`,
    [String(email).trim()],
  )
  return result.rows[0] ?? null
}

async function memberBenefits(pool, member) {
  if (!member) return { annualMember: false, annualCreditsRemaining: 0, trialAvailable: true, discountPercent: 0 }
  const membership = await pool.query(
    `SELECT 1
       FROM additional_fee_redemption r
       JOIN additional_fee f ON f.id = r.fee_id
      WHERE r.member_id = $1
        AND r.period_key = EXTRACT(YEAR FROM CURRENT_DATE)::text
        AND (lower(f.name) LIKE '%annual%' OR lower(f.name) LIKE '%membership%')
      LIMIT 1`,
    [member.id],
  ).catch(() => ({ rows: [] }))
  const annualMember = membership.rows.length > 0
  const usage = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE benefit_type = 'annual_credit' AND EXTRACT(YEAR FROM class_date) = EXTRACT(YEAR FROM CURRENT_DATE))::int AS annual_used,
       COUNT(*) FILTER (WHERE benefit_type = 'free_trial')::int AS trials_used
     FROM drop_in_registration
     WHERE member_id = $1 AND status IN ('confirmed','attended')`,
    [member.id],
  )
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
    annualCreditsRemaining: annualMember ? Math.max(0, 4 - Number(usage.rows[0]?.annual_used || 0)) : 0,
    trialAvailable: Number(usage.rows[0]?.trials_used || 0) === 0,
    discountPercent,
  }
}

export async function initDropInTables(pool) {
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
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_drop_in_lifetime_trial_email ON drop_in_registration(lower(email)) WHERE benefit_type='free_trial' AND status <> 'cancelled'`)
}

async function loadCatalog(pool, member) {
  const benefits = await memberBenefits(pool, member)
  const result = await pool.query(`
    SELECT sg.id AS slot_group_id, sf.id AS form_id, sf.title AS class_name,
           sg.schedule_mode, sg.max_participants, sg.active_start, sg.active_end,
           ts.day_of_week, ts.specific_date, ts.start_time, ts.end_time,
           p.display_name AS program_name, top.display_name AS sport_name,
           COALESCE(top.pricing_cost_options, '[]'::jsonb) AS pricing_options,
           COALESCE(top.pricing_slot_cost_monthly_cents, sf.slot_cost_monthly_cents, 0) AS fallback_monthly_cents,
           (SELECT COUNT(*) FROM scheduling_signup s WHERE s.slot_group_id=sg.id AND s.status IN ('confirmed','waitlisted'))::int AS enrolled
      FROM scheduling_slot_group sg
      JOIN scheduling_form sf ON sf.id=sg.form_id AND sf.deleted_at IS NULL
      JOIN scheduling_time_slot ts ON ts.slot_group_id=sg.id AND ts.is_active=TRUE
      LEFT JOIN program p ON p.id=sf.program_id
      LEFT JOIN programs top ON top.id=COALESCE(sf.programs_id, p.programs_id)
     WHERE sg.is_active=TRUE AND sf.is_active=TRUE
     ORDER BY top.display_name, sf.title, ts.day_of_week, ts.start_time
  `)
  const sessions = []
  for (const row of result.rows) {
    const dates = row.specific_date ? [String(row.specific_date).slice(0, 10)] : nextDates(row.day_of_week)
    const monthlyCents = monthlyCentsFromOptions(row.pricing_options, row.fallback_monthly_cents)
    for (const date of dates) {
      if (row.active_start && date < String(row.active_start).slice(0, 10)) continue
      if (row.active_end && date > String(row.active_end).slice(0, 10)) continue
      const dropIns = await pool.query(
        `SELECT COUNT(*)::int AS count FROM drop_in_registration WHERE slot_group_id=$1 AND class_date=$2 AND status=ANY($3)`,
        [row.slot_group_id, date, ACTIVE_REGISTRATION_STATUSES],
      )
      const occupied = Number(row.enrolled) + Number(dropIns.rows[0]?.count || 0)
      const price = calculateDropInPrice({ monthlyCents, annualMember: benefits.annualMember, discountPercent: benefits.discountPercent })
      sessions.push({
        slotGroupId: Number(row.slot_group_id), formId: Number(row.form_id), className: row.class_name,
        programName: row.program_name, sportName: row.sport_name, date,
        startTime: String(row.start_time).slice(0, 5), endTime: String(row.end_time).slice(0, 5),
        maxParticipants: Number(row.max_participants), enrolled: occupied,
        spotsRemaining: Math.max(0, Number(row.max_participants) - occupied), isFull: occupied >= Number(row.max_participants),
        monthlyCents, ...price,
      })
    }
  }
  return { sessions, benefits }
}

export function registerDropInRoutes(app, pool) {
  app.get('/api/public/drop-ins', async (req, res) => {
    try {
      const member = await resolveMember(pool, req, req.query.email)
      res.json({ success: true, data: await loadCatalog(pool, member) })
    } catch (error) {
      console.error('[drop-ins] catalog:', error)
      res.status(500).json({ success: false, message: 'Failed to load drop-in classes' })
    }
  })

  app.post('/api/public/drop-ins/register', async (req, res) => {
    const client = await pool.connect()
    try {
      const { slotGroupId, classDate, firstName, lastName, email, phone, useFreeTrial } = req.body || {}
      if (!slotGroupId || !/^\d{4}-\d{2}-\d{2}$/.test(String(classDate)) || !firstName || !lastName || !email) {
        return res.status(400).json({ success: false, message: 'Class, date, athlete name, and email are required.' })
      }
      await client.query('BEGIN')
      const member = await resolveMember(client, req, email)
      const benefits = await memberBenefits(client, member)
      const slot = await client.query(`
        SELECT sg.id, sg.form_id, sg.max_participants, sf.title,
               COALESCE(top.pricing_cost_options,'[]'::jsonb) AS pricing_options,
               COALESCE(top.pricing_slot_cost_monthly_cents, sf.slot_cost_monthly_cents, 0) AS fallback_monthly_cents,
               (SELECT COUNT(*) FROM scheduling_signup s WHERE s.slot_group_id=sg.id AND s.status IN ('confirmed','waitlisted'))::int AS enrolled
          FROM scheduling_slot_group sg JOIN scheduling_form sf ON sf.id=sg.form_id
          LEFT JOIN program p ON p.id=sf.program_id LEFT JOIN programs top ON top.id=COALESCE(sf.programs_id,p.programs_id)
         WHERE sg.id=$1 AND sg.is_active=TRUE FOR UPDATE`, [slotGroupId])
      if (!slot.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Class not found.' }) }
      const existing = await client.query(`SELECT COUNT(*)::int AS count FROM drop_in_registration WHERE slot_group_id=$1 AND class_date=$2 AND status=ANY($3)`, [slotGroupId, classDate, ACTIVE_REGISTRATION_STATUSES])
      if (Number(slot.rows[0].enrolled) + Number(existing.rows[0].count) >= Number(slot.rows[0].max_participants)) {
        await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'That class is full.' })
      }
      if (useFreeTrial && !benefits.trialAvailable) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'The one-time free trial has already been used.' }) }
      const benefitType = useFreeTrial ? 'free_trial' : benefits.annualCreditsRemaining > 0 ? 'annual_credit' : 'paid'
      const monthlyCents = monthlyCentsFromOptions(slot.rows[0].pricing_options, slot.rows[0].fallback_monthly_cents)
      const price = calculateDropInPrice({ monthlyCents, annualMember: benefits.annualMember, discountPercent: benefits.discountPercent, isFree: benefitType !== 'paid' })
      const status = benefitType === 'paid' ? (member ? 'confirmed' : 'account_required') : 'confirmed'
      const inserted = await client.query(`INSERT INTO drop_in_registration(member_id,form_id,slot_group_id,class_date,first_name,last_name,email,phone,benefit_type,base_price_cents,discount_percent,amount_cents,status) VALUES($1,$2,$3,$4,$5,$6,lower($7),$8,$9,$10,$11,$12,$13) RETURNING id`, [member?.id ?? null, slot.rows[0].form_id, slotGroupId, classDate, String(firstName).trim(), String(lastName).trim(), String(email).trim(), phone || null, benefitType, price.baseCents, price.discountPercent, price.totalCents, status])
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
      res.status(201).json({ success: true, data: { id: Number(inserted.rows[0].id), status, benefitType, ...price, accountRequired: status === 'account_required', signupUrl: status === 'account_required' ? `/signup/family?dropIn=${inserted.rows[0].id}` : null } })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      if (error?.code === '23505') return res.status(409).json({ success: false, message: 'This free trial or class date has already been registered.' })
      console.error('[drop-ins] register:', error)
      res.status(500).json({ success: false, message: 'Failed to register for this drop-in.' })
    } finally { client.release() }
  })
}
