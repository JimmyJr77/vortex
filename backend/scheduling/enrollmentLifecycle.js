/**
 * Enrollment lifecycle schema + status updates for admin member-account actions.
 *
 * Production DBs may still carry an inline status CHECK from the original
 * scheduling_signup CREATE TABLE (only confirmed/cancelled) alongside the named
 * scheduling_signup_status_check — both must be removed before paused/completed work.
 */

const CANONICAL_STATUSES = ['confirmed', 'waitlisted', 'cancelled', 'paused', 'completed']

let schemaReady = false

async function statusCheckAllowsLifecycleStatuses(pool) {
  const res = await pool.query(`
    SELECT pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'scheduling_signup'
      AND c.conname = 'scheduling_signup_status_check'
  `)
  const def = res.rows[0]?.def ?? ''
  return def.includes("'paused'") && def.includes("'completed'")
}

/** Drop every CHECK constraint on scheduling_signup that references status. */
async function dropLegacySignupStatusChecks(pool) {
  await pool.query(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.relname = 'scheduling_signup'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      LOOP
        EXECUTE format('ALTER TABLE scheduling_signup DROP CONSTRAINT IF EXISTS %I', r.conname);
      END LOOP;
    END $$;
  `)
}

/** Idempotent columns + canonical status CHECK (safe before admin enrollment actions). */
export async function ensureEnrollmentLifecycleColumns(pool) {
  await pool.query(`ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`)
  await pool.query(`ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ`)
  await pool.query(`ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS manual_discount_cents INTEGER`)
  await pool.query(`ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS manual_discount_pct NUMERIC(5,2)`)
  await pool.query(`ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS manual_discount_reason TEXT`)
  await pool.query(`ALTER TABLE scheduling_signup ADD COLUMN IF NOT EXISTS manual_discount_rule_id BIGINT`)

  if (schemaReady && (await statusCheckAllowsLifecycleStatuses(pool))) return

  await dropLegacySignupStatusChecks(pool)

  try {
    await pool.query(`
      UPDATE scheduling_signup
      SET status = 'confirmed'
      WHERE status NOT IN ('confirmed', 'waitlisted', 'cancelled', 'paused', 'completed')
    `)
  } catch (normalizeErr) {
    console.warn('[enrollmentLifecycle] status normalize skipped:', normalizeErr?.message ?? normalizeErr)
  }

  try {
    await pool.query(`
      ALTER TABLE scheduling_signup
      ADD CONSTRAINT scheduling_signup_status_check
      CHECK (status IN ('confirmed', 'waitlisted', 'cancelled', 'paused', 'completed'))
    `)
  } catch (err) {
    const msg = String(err?.message ?? err)
    if (!/already exists|duplicate_object/i.test(msg)) {
      console.warn('[enrollmentLifecycle] status check add skipped:', msg)
    }
  }

  schemaReady = await statusCheckAllowsLifecycleStatuses(pool)
}

async function hasLifecycleTimestampColumns(pool) {
  const res = await pool.query(`
    SELECT COUNT(*)::int AS n
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scheduling_signup'
      AND column_name IN ('paused_at', 'completed_at')
  `)
  return Number(res.rows[0]?.n ?? 0) >= 2
}

/**
 * Update signup status; uses paused_at/completed_at when columns exist.
 * Call ensureEnrollmentLifecycleColumns on the pool before BEGIN — do not run DDL here.
 * @param {import('pg').PoolClient} client
 */
export async function updateSignupLifecycleStatus(client, signupId, targetStatus) {
  const withTimestamps = await hasLifecycleTimestampColumns(client)
  if (withTimestamps) {
    try {
      return await client.query(
        `
        UPDATE scheduling_signup
        SET status = $1,
            paused_at = CASE
              WHEN $1 = 'paused' THEN now()
              WHEN $1 IN ('confirmed', 'waitlisted') THEN NULL
              ELSE paused_at END,
            completed_at = CASE
              WHEN $1 = 'completed' THEN now()
              WHEN $1 IN ('confirmed', 'waitlisted') THEN NULL
              ELSE completed_at END
        WHERE id = $2 RETURNING *
        `,
        [targetStatus, signupId],
      )
    } catch (err) {
      console.warn('[enrollmentLifecycle] timestamp update failed, retrying status-only:', err?.message ?? err)
    }
  }

  return client.query(
    'UPDATE scheduling_signup SET status = $1 WHERE id = $2 RETURNING *',
    [targetStatus, signupId],
  )
}

export { CANONICAL_STATUSES }
