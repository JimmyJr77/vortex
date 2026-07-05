import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { sendEnrollmentReceiptEmail } from './enrollmentReceiptEmail.js'
import { publicAppUrl } from './publicAppUrl.js'

/**
 * @param {import('pg').Pool} pool
 * @param {string} token
 */
export async function verifyEnrollmentReceiptToken(pool, token) {
  const raw = String(token || '').trim()
  if (!raw) {
    return { ok: false, message: 'Missing receipt token.' }
  }

  const candidates = await pool.query(
    `SELECT * FROM enrollment_receipt_token
     WHERE expires_at > now()
     ORDER BY created_at DESC
     LIMIT 100`,
  )

  let row = null
  for (const candidate of candidates.rows) {
    if (await bcrypt.compare(raw, candidate.token_hash)) {
      row = candidate
      break
    }
  }

  if (!row) {
    return { ok: false, message: 'This registration receipt link is invalid or has expired.' }
  }

  if (!row.viewed_at) {
    await pool.query(
      `UPDATE enrollment_receipt_token SET viewed_at = now() WHERE id = $1`,
      [row.id],
    )
  }

  return {
    ok: true,
    data: {
      athleteName: row.payload?.athleteName ?? null,
      programName: row.payload?.programName ?? null,
      slotLabel: row.payload?.slotLabel ?? null,
      status: row.payload?.status ?? 'confirmed',
      selectedDays: row.payload?.selectedDays ?? [],
      pricing: row.payload?.pricing ?? null,
      viewedAt: row.viewed_at || new Date().toISOString(),
    },
  }
}

/**
 * Mint token and send enrollment receipt email.
 * @param {import('pg').Pool} pool
 * @param {{
 *   memberId: number
 *   recipientEmail: string
 *   athleteName: string
 *   programName: string
 *   slotLabel?: string
 *   status?: string
 *   selectedDays?: string[]
 *   schedulingSignupId?: number | null
 *   memberProgramId?: number | null
 *   guardianName?: string | null
 *   pricingSummary?: object | null
 *   bestEffort?: boolean
 * }} params
 */
export async function issueEnrollmentReceipt(pool, params) {
  const {
    memberId,
    recipientEmail,
    athleteName,
    programName,
    slotLabel = '',
    status = 'confirmed',
    selectedDays = [],
    schedulingSignupId = null,
    memberProgramId = null,
    guardianName = null,
    pricingSummary = null,
    bestEffort = true,
  } = params

  const to = String(recipientEmail || '').trim()
  if (!to || !Number.isFinite(Number(memberId))) {
    return { sent: false, skipped: true, reason: 'invalid_recipient_or_member' }
  }

  const token = randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(token, 10)
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  const payload = {
    athleteName,
    programName,
    slotLabel,
    status,
    selectedDays: Array.isArray(selectedDays) ? selectedDays : [],
    pricing: pricingSummary ?? null,
  }

  await pool.query(
    `INSERT INTO enrollment_receipt_token (
      member_id, scheduling_signup_id,
      recipient_email, token_hash, payload, expires_at
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [
      Number(memberId),
      schedulingSignupId != null ? Number(schedulingSignupId) : null,
      to,
      tokenHash,
      JSON.stringify(payload),
      expiresAt,
    ],
  )

  const receiptUrl = `${publicAppUrl()}/registration/receipt?token=${token}`

  try {
    const result = await sendEnrollmentReceiptEmail({
      to,
      athleteName,
      programName,
      slotLabel,
      status,
      selectedDays,
      receiptUrl,
      guardianName,
      pricingSummary,
    })
    return { sent: result.sent === true, receiptUrl, skipped: false }
  } catch (err) {
    if (bestEffort) {
      console.warn('[enrollmentReceipt] send failed:', err?.message || err)
      return { sent: false, receiptUrl, reason: 'send_failed' }
    }
    throw err
  }
}
