import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { resolveJwtSecret } from '../auth/jwtSecret.js'

const SIGNUP_AUTHORITY_VERSION = 1
const SIGNUP_AUTHORITY_GRANTS = new Set([
  'self',
  'household_payer',
  'pending_checkout',
])

function invalidSignupSession() {
  const error = new Error('Invalid signup session')
  error.name = 'JsonWebTokenError'
  return error
}

function requiredPositiveInteger(value) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number <= 0) throw invalidSignupSession()
  return number
}

export function signupAuthorityFromDecodedToken(decoded) {
  const authority = decoded?.signupAuthority
  if (!authority || Number(authority.version) !== SIGNUP_AUTHORITY_VERSION) {
    throw invalidSignupSession()
  }
  const actorMemberId = requiredPositiveInteger(authority.actorMemberId)
  const targetMemberId = requiredPositiveInteger(authority.targetMemberId)
  const tokenMemberId = requiredPositiveInteger(decoded.memberId)
  if (targetMemberId !== tokenMemberId || !SIGNUP_AUTHORITY_GRANTS.has(authority.grant)) {
    throw invalidSignupSession()
  }
  const familyBillingAccountId =
    authority.familyBillingAccountId == null
      ? null
      : requiredPositiveInteger(authority.familyBillingAccountId)
  if (actorMemberId !== targetMemberId && authority.grant === 'self') {
    throw invalidSignupSession()
  }
  if (authority.grant !== 'self' && familyBillingAccountId == null) {
    throw invalidSignupSession()
  }
  return {
    version: SIGNUP_AUTHORITY_VERSION,
    actorMemberId,
    targetMemberId,
    familyBillingAccountId,
    grant: authority.grant,
  }
}

export function issueSignupAuthToken({
  formId,
  memberId,
  email,
  programsId = null,
  actorMemberId = memberId,
  familyBillingAccountId = null,
  authorityGrant = Number(actorMemberId) === Number(memberId) ? 'self' : 'household_payer',
}) {
  const normalizedMemberId = requiredPositiveInteger(memberId)
  const normalizedActorMemberId = requiredPositiveInteger(actorMemberId)
  if (!SIGNUP_AUTHORITY_GRANTS.has(authorityGrant)) throw invalidSignupSession()
  const normalizedAccountId =
    familyBillingAccountId == null
      ? null
      : requiredPositiveInteger(familyBillingAccountId)
  if (normalizedActorMemberId !== normalizedMemberId && authorityGrant === 'self') {
    throw invalidSignupSession()
  }
  if (authorityGrant !== 'self' && normalizedAccountId == null) {
    throw invalidSignupSession()
  }
  const payload = {
    type: 'scheduling_signup',
    formId: Number(formId),
    memberId: normalizedMemberId,
    email,
    signupAuthority: {
      version: SIGNUP_AUTHORITY_VERSION,
      actorMemberId: normalizedActorMemberId,
      targetMemberId: normalizedMemberId,
      grant: authorityGrant,
      ...(normalizedAccountId != null
        ? { familyBillingAccountId: normalizedAccountId }
        : {}),
    },
  }
  if (programsId != null) {
    payload.programsId = Number(programsId)
  }
  return jwt.sign(payload, resolveJwtSecret(), { expiresIn: '30m' })
}

export function verifySignupAuthToken(token, formId, { programsId = null } = {}) {
  const decoded = jwt.verify(token, resolveJwtSecret())
  if (decoded.type !== 'scheduling_signup') {
    throw invalidSignupSession()
  }
  decoded.signupAuthority = signupAuthorityFromDecodedToken(decoded)
  if (formId != null && Number(decoded.formId) === Number(formId)) {
    return decoded
  }
  if (
    decoded.programsId != null &&
    programsId != null &&
    Number(decoded.programsId) === Number(programsId)
  ) {
    return decoded
  }
  throw invalidSignupSession()
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
