import { isEmailConfigured } from './sendEmail.js'
import { sendAccountInviteReminderEmail } from './accountInviteEmail.js'
import {
  buildAccountInviteUrl,
  decryptAccountInviteToken,
} from './accountInviteTokens.js'
import { POLICY } from './emailPolicy.js'
import { isSuppressed } from './emailDeliveryStore.js'

const MAX_REMINDERS = POLICY.maxAutomaticReminders
const REMINDER_INTERVAL_DAYS = POLICY.reminderIntervalDays
const REMINDER_JOB_INTERVAL_MS = 6 * 60 * 60 * 1000
const ADVISORY_LOCK_ID = 943028471

async function recoverInviteUrl(invite) {
  const decrypted = decryptAccountInviteToken(invite.token_ciphertext)
  if (decrypted) return buildAccountInviteUrl(decrypted)

  // Do not rotate token_hash here — that would invalidate the link in the original invite email.
  console.warn(
    '[accountInviteReminders] cannot decrypt token_ciphertext for invite',
    invite.id,
    '- skipping reminder',
  )
  return null
}

/**
 * Send weekly reminder emails for unused parent/guardian signup invites (weeks 1–4).
 */
export async function processAccountInviteReminders(pool) {
  if (!isEmailConfigured()) return { processed: 0, sent: 0, skipped: 'smtp_not_configured' }

  const lock = await pool.query('SELECT pg_try_advisory_lock($1) AS acquired', [ADVISORY_LOCK_ID])
  if (!lock.rows[0]?.acquired) return { processed: 0, sent: 0, skipped: 'lock_not_acquired' }

  const client = await pool.connect()
  const toSend = []

  try {
    await client.query('BEGIN')
    const due = await client.query(
      `
        SELECT ai.*, m.first_name AS minor_first_name, m.last_name AS minor_last_name
        FROM account_invite ai
        JOIN member m ON m.id = ai.inviter_member_id
        WHERE ai.used_at IS NULL
          AND ai.reminder_count < $1
          AND ai.created_at <= now() - ((ai.reminder_count + 1) * ($2 || ' days')::interval)
        ORDER BY ai.created_at ASC
        FOR UPDATE OF ai SKIP LOCKED
      `,
      [MAX_REMINDERS, String(REMINDER_INTERVAL_DAYS)],
    )

    for (const row of due.rows) {
      const weekNumber = Number(row.reminder_count) + 1

      // Never remind a suppressed (hard-bounced / complained) address.
      const supp = await isSuppressed(row.invitee_email, 'transactional')
      if (supp.suppressed) continue

      const inviteUrl = await recoverInviteUrl(row)
      if (!inviteUrl) continue

      const claim = await client.query(
        `
          UPDATE account_invite
          SET reminder_count = reminder_count + 1,
              last_reminder_at = now()
          WHERE id = $1
            AND used_at IS NULL
            AND reminder_count = $2
          RETURNING *
        `,
        [row.id, row.reminder_count],
      )
      if (claim.rows.length === 0) continue

      const invite = claim.rows[0]
      const minorName = `${row.minor_first_name || ''} ${row.minor_last_name || ''}`.trim() || 'Your athlete'
      toSend.push({ inviteId: invite.id, to: invite.invitee_email, inviteUrl, minorName, weekNumber })
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
    await pool.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID])
  }

  let sent = 0
  for (const item of toSend) {
    try {
      const result = await sendAccountInviteReminderEmail({
        to: item.to,
        inviteUrl: item.inviteUrl,
        minorName: item.minorName,
        weekNumber: item.weekNumber,
      })
      if (result.sent) sent += 1
    } catch (err) {
      console.warn('[accountInviteReminders] send failed for invite', item.inviteId, err?.message || err)
      await pool.query(
        `
          UPDATE account_invite
          SET reminder_count = GREATEST(reminder_count - 1, 0),
              last_reminder_at = NULL
          WHERE id = $1 AND used_at IS NULL
        `,
        [item.inviteId],
      )
    }
  }

  return { processed: toSend.length, sent }
}

export function startAccountInviteReminderScheduler(pool) {
  const run = () => {
    void processAccountInviteReminders(pool).then((result) => {
      if (result.sent > 0) {
        console.log(`[accountInviteReminders] sent ${result.sent} reminder(s)`)
      }
    }).catch((err) => {
      console.warn('[accountInviteReminders] job failed:', err?.message || err)
    })
  }

  setTimeout(run, 60 * 1000)
  const timer = setInterval(run, REMINDER_JOB_INTERVAL_MS)
  if (typeof timer.unref === 'function') timer.unref()
}
