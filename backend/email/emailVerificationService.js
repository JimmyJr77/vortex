import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { sendVerifyEmailEmail } from './verifyEmailEmail.js'
import { publicAppUrl } from './publicAppUrl.js'

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim())

/**
 * Create a single-use email verification token for an app_user and email it.
 * Returns { sent, skipped, reason }. Never throws on send failure when
 * `bestEffort` is true (logs instead) so it can be used inside signup flows.
 *
 * @param {import('pg').Pool} pool
 * @param {{ userId: number; email: string; name?: string | null; bestEffort?: boolean }} params
 */
export async function issueEmailVerification(pool, { userId, email, name = null, bestEffort = false }) {
  const normalizedEmail = String(email || '').trim()
  if (!Number.isFinite(Number(userId)) || !isValidEmail(normalizedEmail)) {
    return { sent: false, skipped: true, reason: 'invalid_user_or_email' }
  }

  const token = randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(token, 10)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await pool.query(
    `INSERT INTO email_verification_token (user_id, email, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [Number(userId), normalizedEmail, tokenHash, expiresAt],
  )

  const verifyUrl = `${publicAppUrl()}/verify-email?token=${token}`
  const firstName = name ? String(name).trim().split(/\s+/)[0] : null

  try {
    const result = await sendVerifyEmailEmail({ to: normalizedEmail, verifyUrl, name: firstName })
    return { sent: result.sent === true, skipped: false, reason: null, verifyUrl }
  } catch (err) {
    if (bestEffort) {
      console.warn('[emailVerification] best-effort send failed:', err?.message || err)
      return { sent: false, skipped: false, reason: 'send_failed', verifyUrl }
    }
    throw err
  }
}
