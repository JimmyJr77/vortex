import bcrypt from 'bcryptjs'

import {
  generateTemporaryPassword,
  sendTemporaryPasswordEmail,
} from '../scheduling/tempPasswordEmail.js'

export class StaffPasswordResetDeliveryError extends Error {
  constructor(message, { cause, userId, reason } = {}) {
    super(message, { cause })
    this.name = 'StaffPasswordResetDeliveryError'
    this.code = 'STAFF_PASSWORD_RESET_DELIVERY_FAILED'
    this.userId = userId ?? null
    this.reason = reason || cause?.reason || cause?.code || 'send_error'
  }
}

/**
 * Replace one canonical staff login password only after its temporary-password
 * email is accepted for delivery. Unknown and ambiguous email addresses share
 * the same result, and no password change is committed when delivery fails.
 */
export async function resetStaffPasswordByEmail(
  pool,
  email,
  {
    createTemporaryPassword = generateTemporaryPassword,
    hashPassword = (password) => bcrypt.hash(password, 10),
    sendTemporaryEmail = (params) => sendTemporaryPasswordEmail(params, { requirePasswordChange: false }),
  } = {},
) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const userResult = await client.query(
      `SELECT account.id, account.email, account.full_name
       FROM app_user account
       JOIN v_app_user_access_context access
         ON access.user_id = account.id
       WHERE LOWER(BTRIM(account.email)) = $1
         AND access.is_active = TRUE
         AND access.staff_access_active = TRUE
         AND (
           access.can_access_admin_portal = TRUE
           OR access.can_access_coach_portal = TRUE
         )
       ORDER BY account.id
       LIMIT 2
       FOR UPDATE OF account`,
      [normalizedEmail],
    )

    if (userResult.rows.length !== 1) {
      await client.query('COMMIT')
      return { accountFound: false, sent: false, userId: null }
    }
    const user = userResult.rows[0]

    const temporaryPassword = createTemporaryPassword(12)
    const passwordHash = await hashPassword(temporaryPassword)
    await client.query(
      `UPDATE app_user
       SET password_hash = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id, passwordHash],
    )

    try {
      const delivery = await sendTemporaryEmail({
        registrantFirstName: String(user.full_name || '').split(' ')[0] || 'there',
        registrantEmail: user.email,
        temporaryPassword,
      })
      if (!delivery?.sent) {
        const error = new Error('Temporary password email was not accepted for delivery.')
        error.code = 'TEMPORARY_PASSWORD_EMAIL_NOT_SENT'
        error.reason = delivery?.reason || 'not_sent'
        throw error
      }
    } catch (error) {
      throw new StaffPasswordResetDeliveryError(
        'The temporary-password email could not be delivered.',
        { cause: error, userId: user.id, reason: error?.reason },
      )
    }

    await client.query('COMMIT')
    return { accountFound: true, sent: true, userId: Number(user.id) }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
