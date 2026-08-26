import bcrypt from 'bcryptjs'

import {
  generateTemporaryPassword,
  sendTemporaryPasswordEmail,
} from '../scheduling/tempPasswordEmail.js'

export class MemberPasswordResetDeliveryError extends Error {
  constructor(message, { cause, userId, reason } = {}) {
    super(message, { cause })
    this.name = 'MemberPasswordResetDeliveryError'
    this.code = 'MEMBER_PASSWORD_RESET_DELIVERY_FAILED'
    this.userId = userId ?? null
    this.reason = reason || cause?.reason || cause?.code || 'send_error'
  }
}

/**
 * Replace a member login password only when the temporary-password email is
 * accepted by SMTP. The database changes stay uncommitted while delivery is
 * attempted, so a skipped or failed message leaves the current password intact.
 */
export async function resetMemberPasswordByEmail(
  pool,
  email,
  {
    createTemporaryPassword = generateTemporaryPassword,
    hashPassword = (password) => bcrypt.hash(password, 10),
    sendTemporaryEmail = sendTemporaryPasswordEmail,
  } = {},
) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const userResult = await client.query(
      `SELECT id, email, full_name
       FROM app_user
       WHERE LOWER(email) = $1
         AND is_active = TRUE
       LIMIT 1
       FOR UPDATE`,
      [normalizedEmail],
    )

    const user = userResult.rows[0]
    if (!user) {
      await client.query('COMMIT')
      return { accountFound: false, sent: false, userId: null }
    }

    const temporaryPassword = createTemporaryPassword(12)
    const passwordHash = await hashPassword(temporaryPassword)

    await client.query(
      `UPDATE app_user
       SET password_hash = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id, passwordHash],
    )
    await client.query(
      `UPDATE member
       SET must_change_password = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE app_user_id = $1`,
      [user.id],
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
      throw new MemberPasswordResetDeliveryError(
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
