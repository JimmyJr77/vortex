/** Enrollment lifecycle status updates for admin member-account actions. */

import { runIsolated } from './transactionSavepoint.js'

const CANONICAL_STATUSES = ['confirmed', 'waitlisted', 'cancelled', 'paused', 'completed']

/**
 * Compatibility hook for older callers. Migration 780 owns this schema and
 * process readiness verifies it before HTTP traffic or billing workers run.
 * A live request must never create, alter, normalize, or constrain tables.
 */
export async function ensureEnrollmentLifecycleColumns() {
  // Intentionally read/write-free.
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
      return await runIsolated(client, () =>
        client.query(
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
        ),
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
