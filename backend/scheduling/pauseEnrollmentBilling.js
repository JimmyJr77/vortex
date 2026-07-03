/**
 * Billing side effects when an enrollment is paused or reactivated.
 *
 * 1. Paused enrollments do not count toward household discount tiers (handled by
 *    excluding paused signups from pricing/discount queries; this module resyncs
 *    subscription discount amounts for remaining active classes).
 * 2. Mid-month pauses earn a prorated credit on the following month's bill for
 *    unused class sessions while paused (same 4-class-month ratio as signup proration).
 */

import {
  todayDateOnly,
  monthBounds,
  firstOfNextMonth,
  remainingOccurrencesInMonth,
  CLASSES_PER_MONTH,
} from './firstMonthProration.js'
import { loadCalendarRowsForSlotGroups } from './freePassEngine.js'
import {
  safeSetSubscriptionPausedForSource,
} from './billingSubscriptions.js'
import {
  buildSignupOrderPreview,
  computeExistingEnrollmentDiscounts,
} from './orderPricing.js'
import { ensureBillingAccount } from './persistSignupCharges.js'

export async function ensurePauseCreditTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_pause_credit (
      id                        BIGSERIAL PRIMARY KEY,
      scheduling_signup_id      BIGINT NOT NULL REFERENCES scheduling_signup(id) ON DELETE CASCADE,
      family_billing_account_id BIGINT NOT NULL REFERENCES family_billing_account(id) ON DELETE CASCADE,
      member_id                 BIGINT REFERENCES member(id) ON DELETE SET NULL,
      credit_cents              INTEGER NOT NULL CHECK (credit_cents > 0),
      pause_date                DATE NOT NULL,
      service_month             TEXT NOT NULL,
      apply_on_month            TEXT NOT NULL,
      remaining_classes         INTEGER,
      applied_at                TIMESTAMPTZ,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (scheduling_signup_id, pause_date)
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_billing_pause_credit_apply
      ON billing_pause_credit(apply_on_month)
      WHERE applied_at IS NULL
  `)
}

async function signupChargedForMonth(pool, signupId, monthStart, monthEnd) {
  try {
    const res = await pool.query(
      `
      SELECT 1
      FROM billing_charge
      WHERE (
          (source_type = 'scheduling_signup' AND source_id = $1)
          OR (source_type = 'billing_subscription' AND source_id LIKE $2)
        )
        AND charge_type IN ('recurring', 'one_time')
        AND COALESCE(service_period_start, created_at::date) >= $3::date
        AND COALESCE(service_period_start, created_at::date) <= $4::date
      LIMIT 1
      `,
      [String(signupId), `%:${monthStart.slice(0, 7)}%`, monthStart, monthEnd],
    )
    return res.rows.length > 0
  } catch {
    return false
  }
}

/**
 * Prorated credit for sessions not used after a mid-month pause.
 * @returns {{ creditCents:number, ratio:number, remainingClasses:number }}
 */
export function pauseCreditForLine(calendarRows, { slotGroupId, timeSlotId = null, pauseDate, netMonthlyCents }) {
  const remaining = remainingOccurrencesInMonth(calendarRows, {
    slotGroupId,
    timeSlotId,
    fromDate: pauseDate,
  })
  if (remaining <= 0) {
    return { creditCents: 0, ratio: 0, remainingClasses: 0 }
  }
  const ratio = Math.min(remaining, CLASSES_PER_MONTH) / CLASSES_PER_MONTH
  const net = Math.max(0, Math.round(Number(netMonthlyCents) || 0))
  return {
    creditCents: Math.round(net * ratio),
    ratio,
    remainingClasses: remaining,
  }
}

/** First day of the month after `asOf` (YYYY-MM-DD). */
export function nextMonthPauseEffectiveDate(asOf = new Date()) {
  return firstOfNextMonth(todayDateOnly(asOf))
}

/** Schedule pause at start of next month; enrollment stays active until then. */
export async function schedulePauseNextMonth(client, signupId, asOf = new Date()) {
  const effectiveDate = nextMonthPauseEffectiveDate(asOf)
  const res = await client.query(
    `
    UPDATE scheduling_signup
    SET pause_effective_date = $2, pause_mode = 'next_month'
    WHERE id = $1
    RETURNING *
    `,
    [signupId, effectiveDate],
  )
  return res.rows[0]
}

/** Pause immediately with prorated billing credit. */
export async function applyImmediatePause(client, signupId) {
  const { updateSignupLifecycleStatus } = await import('./enrollmentLifecycle.js')
  await updateSignupLifecycleStatus(client, signupId, 'paused')
  const res = await client.query(
    `
    UPDATE scheduling_signup
    SET pause_mode = 'prorated', pause_effective_date = CURRENT_DATE
    WHERE id = $1
    RETURNING *
    `,
    [signupId],
  )
  return res.rows[0]
}

/** Clear a scheduled pause without changing enrollment status. */
export async function clearScheduledPause(client, signupId) {
  const res = await client.query(
    `
    UPDATE scheduling_signup
    SET pause_effective_date = NULL, pause_mode = NULL
    WHERE id = $1
    RETURNING *
    `,
    [signupId],
  )
  return res.rows[0]
}

async function loadSignupBillingContext(pool, signupId) {
  const res = await pool.query(
    `
    SELECT s.id, s.member_id, s.slot_group_id, s.time_slot_id, s.paused_at,
           m.family_id,
           bs.id AS subscription_id,
           bs.net_monthly_cents,
           bs.monthly_amount_cents,
           bs.discount_amount_cents,
           bs.status AS subscription_status
    FROM scheduling_signup s
    JOIN member m ON m.id = s.member_id
    LEFT JOIN billing_subscription bs
      ON bs.source_type = 'scheduling_signup'
     AND bs.source_id = s.id::text
     AND bs.status <> 'cancelled'
    WHERE s.id = $1
    `,
    [signupId],
  )
  return res.rows[0] ?? null
}

async function recordPauseCredit(pool, signup) {
  if (!signup?.slot_group_id || !signup.family_id) return null

  const pauseDate = signup.paused_at
    ? todayDateOnly(signup.paused_at instanceof Date ? signup.paused_at : new Date(signup.paused_at))
    : todayDateOnly()

  const { monthStart, monthEnd } = monthBounds(pauseDate)
  const netMonthly =
    Number(signup.net_monthly_cents) ||
    Math.max(0, Number(signup.monthly_amount_cents) - Number(signup.discount_amount_cents))

  if (netMonthly <= 0) return null

  const rowsByGroup = await loadCalendarRowsForSlotGroups(pool, [Number(signup.slot_group_id)])
  const calendarRows = [...rowsByGroup.values()].flat()
  const { creditCents, remainingClasses } = pauseCreditForLine(calendarRows, {
    slotGroupId: Number(signup.slot_group_id),
    timeSlotId: signup.time_slot_id != null ? Number(signup.time_slot_id) : null,
    pauseDate,
    netMonthlyCents: netMonthly,
  })

  if (creditCents <= 0) return null

  // At the start of a billing cycle with no charge yet, skip credit (pause blocks the bill).
  const isMonthStart = pauseDate === monthStart
  if (isMonthStart) {
    const charged = await signupChargedForMonth(pool, signup.id, monthStart, monthEnd)
    if (!charged) return null
  }

  try {
    await ensurePauseCreditTable(pool)
  } catch (err) {
    console.warn('[pauseBilling] ensurePauseCreditTable:', err?.message ?? err)
    return null
  }

  const account = await ensureBillingAccount(pool, Number(signup.family_id))
  if (!account) return null

  const serviceMonth = pauseDate.slice(0, 7)
  const applyOnMonth = firstOfNextMonth(pauseDate).slice(0, 7)

  const ins = await pool.query(
    `
    INSERT INTO billing_pause_credit (
      scheduling_signup_id, family_billing_account_id, member_id,
      credit_cents, pause_date, service_month, apply_on_month, remaining_classes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (scheduling_signup_id, pause_date) DO UPDATE
      SET credit_cents = EXCLUDED.credit_cents,
          remaining_classes = EXCLUDED.remaining_classes,
          apply_on_month = EXCLUDED.apply_on_month
    WHERE billing_pause_credit.applied_at IS NULL
    RETURNING id, credit_cents
    `,
    [
      signup.id,
      account.id,
      signup.member_id,
      creditCents,
      pauseDate,
      serviceMonth,
      applyOnMonth,
      remainingClasses,
    ],
  )
  return ins.rows[0] ?? null
}

/**
 * Recompute household discount tiers and push updated discount/net onto active subscriptions.
 */
export async function syncFamilyEnrollmentDiscounts(pool, familyId) {
  if (!familyId) return { updated: 0 }

  const membersRes = await pool.query(
    `SELECT id, billing_city FROM member WHERE family_id = $1 AND is_active = TRUE`,
    [familyId],
  )
  if (membersRes.rows.length === 0) return { updated: 0 }

  const previewExistingLines = []
  let anchorMemberId = null

  for (const member of membersRes.rows) {
    try {
      const preview = await buildSignupOrderPreview(pool, {
        memberId: Number(member.id),
        newSignups: [],
        promoCodes: [],
        memberContext: {
          city: member.billing_city ?? null,
          familyId: Number(familyId),
        },
      })
      for (const cls of preview?.existingClasses ?? []) {
        if (cls.id == null || !(cls.monthlyPrice > 0)) continue
        anchorMemberId = anchorMemberId ?? Number(member.id)
        previewExistingLines.push({
          key: `preview-existing-${cls.id}`,
          signupId: Number(cls.id),
          formId: cls.formId,
          programId: cls.programsId ?? null,
          sportId: null,
          memberId: Number(member.id),
          familyId: Number(familyId),
          baseCents: Math.round((cls.monthlyPrice || 0) * 100),
          listCents: Math.round((cls.monthlyPrice || 0) * 100),
          finalCents: Math.round((cls.monthlyPrice || 0) * 100),
          includeInSubtotal: false,
          shadowOnly: true,
        })
      }
    } catch (err) {
      console.warn('[pauseBilling] preview for member', member.id, err?.message ?? err)
    }
  }

  if (!anchorMemberId || previewExistingLines.length === 0) return { updated: 0 }

  let accountLines = []
  try {
    const discounts = await computeExistingEnrollmentDiscounts(pool, {
      memberId: anchorMemberId,
      promoCodes: [],
      memberContext: { familyId: Number(familyId) },
      previewExistingLines,
      formRows: new Map(),
      scopeMeta: new Map(),
    })
    accountLines = discounts?.accountLines ?? []
  } catch (err) {
    console.warn('[pauseBilling] discount recompute failed:', err?.message ?? err)
    return { updated: 0 }
  }

  let updated = 0
  for (const line of accountLines) {
    if (line.signupId == null) continue
    const gross = Math.max(0, Math.round(line.baseCents ?? line.listCents ?? 0))
    const net = Math.max(0, Math.round(line.finalCents ?? gross))
    const discount = Math.max(0, gross - net)
    try {
      const res = await pool.query(
        `
        UPDATE billing_subscription
        SET monthly_amount_cents = $2,
            discount_amount_cents = $3,
            net_monthly_cents = $4,
            updated_at = now()
        WHERE source_type = 'scheduling_signup'
          AND source_id = $1
          AND status = 'active'
        RETURNING id
        `,
        [String(line.signupId), gross, discount, net],
      )
      if (res.rows.length > 0) updated += 1
    } catch (err) {
      console.warn('[pauseBilling] subscription update', line.signupId, err?.message ?? err)
    }
  }
  return { updated }
}

/**
 * Post pending pause credits whose apply_on_month matches the billing period starting `periodStart`.
 * @returns {Promise<number>} credits posted
 */
export async function applyPendingPauseCredits(pool, { periodStart }) {
  const applyOnMonth = String(periodStart).slice(0, 7)
  let pending
  try {
    await ensurePauseCreditTable(pool)
    pending = await pool.query(
      `
      SELECT pc.*, sf.title AS form_title
      FROM billing_pause_credit pc
      JOIN scheduling_signup s ON s.id = pc.scheduling_signup_id
      JOIN scheduling_form sf ON sf.id = s.form_id
      WHERE pc.applied_at IS NULL AND pc.apply_on_month = $1
      ORDER BY pc.id
      `,
      [applyOnMonth],
    )
  } catch (err) {
    console.warn('[pauseBilling] load pending credits:', err?.message ?? err)
    return 0
  }

  let posted = 0
  for (const row of pending.rows) {
    const sourceId = `pause:${row.scheduling_signup_id}:${row.pause_date}`
    const description = `Pause credit — ${row.form_title || 'Class'} (${row.service_month}, ${row.remaining_classes ?? '?'} unused sessions)`
    try {
      const ins = await pool.query(
        `
        INSERT INTO billing_charge
          (family_billing_account_id, member_id, source_type, source_id, description,
           amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval)
        VALUES ($1, $2, 'pause_credit', $3, $4, $5, $5, 0, 'credit', 'one_time')
        ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
        DO NOTHING
        RETURNING id
        `,
        [
          row.family_billing_account_id,
          row.member_id,
          sourceId,
          description,
          -Math.abs(Number(row.credit_cents)),
        ],
      )
      if (ins.rows.length > 0) {
        await pool.query(`UPDATE billing_pause_credit SET applied_at = now() WHERE id = $1`, [row.id])
        posted += 1
      }
    } catch (err) {
      console.warn('[pauseBilling] post credit', row.id, err?.message ?? err)
    }
  }
  return posted
}

/**
 * Pending debits/credits that carry forward to a future billing period (e.g. mid-month
 * pause proration credits). Shown at checkout so families see what will hit next month.
 */
export async function computeCarriedForwardLayer(pool, { memberId, asOfDate = null }) {
  const empty = { enabled: false, items: [], totalCents: 0 }
  if (memberId == null) return empty

  const famRes = await pool.query(`SELECT family_id FROM member WHERE id = $1`, [memberId])
  const familyId = famRes.rows[0]?.family_id
  if (familyId == null) return empty

  const fromMonth = (asOfDate ?? todayDateOnly()).slice(0, 7)
  const items = []

  try {
    await ensurePauseCreditTable(pool)
    const credits = await pool.query(
      `
      SELECT pc.scheduling_signup_id, pc.credit_cents, pc.pause_date, pc.apply_on_month, pc.remaining_classes,
             sf.title AS class_name,
             m.first_name, m.last_name
      FROM billing_pause_credit pc
      JOIN scheduling_signup s ON s.id = pc.scheduling_signup_id
      JOIN scheduling_form sf ON sf.id = s.form_id
      LEFT JOIN member m ON m.id = pc.member_id
      WHERE pc.applied_at IS NULL
        AND pc.apply_on_month >= $2
        AND pc.family_billing_account_id IN (
          SELECT id FROM family_billing_account WHERE family_id = $1
        )
      ORDER BY pc.apply_on_month, pc.id
      `,
      [familyId, fromMonth],
    )
    for (const row of credits.rows) {
      const memberName = `${row.first_name || ''} ${row.last_name || ''}`.trim()
      const creditCents = Math.abs(Number(row.credit_cents) || 0)
      if (creditCents <= 0) continue
      const applyLabel = row.apply_on_month
        ? new Date(`${row.apply_on_month}-01T12:00:00`).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })
        : 'next billing cycle'
      items.push({
        key: `pause-${row.scheduling_signup_id}-${row.pause_date}`,
        kind: 'pause_credit',
        label: `Pause credit — ${row.class_name || 'Class'}`,
        detail: [
          memberName || null,
          row.remaining_classes != null
            ? `${row.remaining_classes} unused session${row.remaining_classes === 1 ? '' : 's'}`
            : null,
          `Applies ${applyLabel}`,
        ]
          .filter(Boolean)
          .join(' · '),
        amountCents: -creditCents,
        applyOnMonth: row.apply_on_month,
      })
    }
  } catch (err) {
    console.warn('[pauseBilling] carried forward preview:', err?.message ?? err)
  }

  if (!items.length) return empty
  const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0)
  return { enabled: true, items, totalCents }
}

/**
 * Run after signup status commit when entering or leaving paused.
 * @param {'prorated'|'next_month'} [pauseMode] — prorated pauses now with mid-month credit; next_month skips credit.
 */
export async function handleEnrollmentPauseBilling(pool, { signupId, enteringPaused, leavingPaused, pauseMode = 'prorated' }) {
  const signup = await loadSignupBillingContext(pool, signupId)
  if (!signup) return

  if (enteringPaused) {
    await safeSetSubscriptionPausedForSource(pool, {
      sourceType: 'scheduling_signup',
      sourceId: signupId,
      paused: true,
    })
    if (pauseMode === 'prorated') {
      await recordPauseCredit(pool, signup)
    }
  } else if (leavingPaused) {
    await safeSetSubscriptionPausedForSource(pool, {
      sourceType: 'scheduling_signup',
      sourceId: signupId,
      paused: false,
    })
  }

  if (signup.family_id && (enteringPaused || leavingPaused)) {
    await syncFamilyEnrollmentDiscounts(pool, Number(signup.family_id))
  }
}

/**
 * Activate enrollments whose pause_effective_date has arrived (start-of-month pauses).
 * @returns {Promise<number>} count activated
 */
export async function applyScheduledPauses(pool, { asOf = new Date() } = {}) {
  const today = todayDateOnly(asOf)
  let due
  try {
    due = await pool.query(
      `
      SELECT id, pause_effective_date, pause_mode
      FROM scheduling_signup
      WHERE pause_effective_date IS NOT NULL
        AND pause_effective_date <= $1
        AND status IN ('confirmed', 'waitlisted')
        AND orphaned_at IS NULL
      ORDER BY id
      `,
      [today],
    )
  } catch (err) {
    console.warn('[pauseBilling] applyScheduledPauses query:', err?.message ?? err)
    return 0
  }

  let applied = 0
  for (const row of due.rows) {
    const signupId = Number(row.id)
    const mode = row.pause_mode === 'prorated' ? 'prorated' : 'next_month'
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { updateSignupLifecycleStatus } = await import('./enrollmentLifecycle.js')
      await updateSignupLifecycleStatus(client, signupId, 'paused')
      await client.query(
        `
        UPDATE scheduling_signup
        SET pause_effective_date = NULL,
            pause_mode = $2
        WHERE id = $1
        `,
        [signupId, mode],
      )
      await client.query('COMMIT')
      await handleEnrollmentPauseBilling(pool, {
        signupId,
        enteringPaused: true,
        pauseMode: mode,
      })
      applied += 1
    } catch (err) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      console.warn('[pauseBilling] applyScheduledPauses signup', signupId, err?.message ?? err)
    } finally {
      client.release()
    }
  }
  return applied
}
