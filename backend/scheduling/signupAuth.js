import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { resolveJwtSecret } from '../auth/jwtSecret.js'

export function issueSignupAuthToken({ formId, memberId, email, programsId = null }) {
  const payload = {
    type: 'scheduling_signup',
    formId: Number(formId),
    memberId: Number(memberId),
    email,
  }
  if (programsId != null) {
    payload.programsId = Number(programsId)
  }
  return jwt.sign(payload, resolveJwtSecret(), { expiresIn: '30m' })
}

export function verifySignupAuthToken(token, formId, { programsId = null } = {}) {
  const decoded = jwt.verify(token, resolveJwtSecret())
  if (decoded.type !== 'scheduling_signup') {
    throw new Error('Invalid signup session')
  }
  if (Number(decoded.formId) === Number(formId)) {
    return decoded
  }
  if (
    decoded.programsId != null &&
    programsId != null &&
    Number(decoded.programsId) === Number(programsId)
  ) {
    return decoded
  }
  throw new Error('Signup session is for a different form')
}

export function generateMagicToken() {
  return crypto.randomBytes(32).toString('hex')
}

export async function storeMagicToken(pool, { token, email, formId, memberId }) {
  const tokenHash = await bcrypt.hash(token, 10)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  await pool.query(
    `
    INSERT INTO scheduling_auth_token (token_hash, email, form_id, member_id, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [tokenHash, email.trim().toLowerCase(), formId, memberId, expiresAt],
  )
}

export async function verifyMagicToken(pool, { token, formId, email }) {
  const res = await pool.query(
    `
    SELECT * FROM scheduling_auth_token
    WHERE LOWER(email) = LOWER($1) AND form_id = $2
      AND used_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 10
    `,
    [email.trim(), formId],
  )
  for (const row of res.rows) {
    if (await bcrypt.compare(token, row.token_hash)) {
      await pool.query('UPDATE scheduling_auth_token SET used_at = now() WHERE id = $1', [row.id])
      return row
    }
  }
  throw new Error('Invalid or expired sign-in link')
}

export async function verifyMemberPassword(memberRow, password) {
  if (!password) return false
  const memberHash = memberRow?.password_hash
  if (memberHash) {
    const memberOk = await bcrypt.compare(password, memberHash)
    if (memberOk) return true
  }
  const appUserHash = memberRow?.app_user_password_hash
  if (appUserHash) {
    return bcrypt.compare(password, appUserHash)
  }
  return false
}
