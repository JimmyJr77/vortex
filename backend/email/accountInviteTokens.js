import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { publicAppUrl } from './publicAppUrl.js'
import { resolveJwtSecret } from '../auth/jwtSecret.js'

/** @typedef {'active' | 'used'} AccountInviteTokenState */

function inviteCryptoKey(secret = resolveJwtSecret()) {
  return crypto.createHash('sha256').update(secret).digest()
}

export function buildAccountInviteUrl(token) {
  return `${publicAppUrl()}/signup/invite?token=${token}`
}

export function encryptAccountInviteToken(plain) {
  const key = inviteCryptoKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return 'v2.' + Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

export function decryptAccountInviteToken(ciphertext) {
  if (!ciphertext) return null
  const versioned = ciphertext.startsWith('v2.')
  // Legacy decryption is confined to stored, unversioned invitation ciphertext.
  // It is never used for authentication or for encrypting new invitations.
  const keys = [inviteCryptoKey()]
  if (!versioned) keys.push(inviteCryptoKey('dev-insecure-jwt-secret'))
  for (const key of keys) {
    try {
      const buf = Buffer.from(versioned ? ciphertext.slice(3) : ciphertext, 'base64url')
      const iv = buf.subarray(0, 12)
      const tag = buf.subarray(12, 28)
      const encrypted = buf.subarray(28)
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    } catch {
      // Try the narrowly scoped legacy format, if applicable.
    }
  }
  return null
}

export async function createAccountInviteTokenRecord() {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(token, 10)
  const tokenCiphertext = encryptAccountInviteToken(token)
  return { token, tokenHash, tokenCiphertext }
}

/**
 * Resolve an account invite from a raw magic-link token (bcrypt compare; no row cap).
 *
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} token
 * @param {{ withMinor?: boolean }} [options]
 * @returns {Promise<{ invite: Record<string, unknown>, state: AccountInviteTokenState } | null>}
 */
export async function findAccountInviteByToken(db, token, { withMinor = false } = {}) {
  const raw = String(token || '').trim()
  if (!raw) return null

  const minorJoin = withMinor ? 'JOIN member m ON m.id = ai.inviter_member_id' : ''
  const minorSelect = withMinor
    ? ', m.first_name AS minor_first_name, m.last_name AS minor_last_name, m.date_of_birth AS minor_dob'
    : ''

  async function scan(usedOnly) {
    const whereUsed = usedOnly ? 'ai.used_at IS NOT NULL' : 'ai.used_at IS NULL'
    const res = await db.query(
      `
        SELECT ai.*${minorSelect}
        FROM account_invite ai
        ${minorJoin}
        WHERE ${whereUsed}
        ORDER BY ai.created_at DESC
      `,
    )
    for (const row of res.rows) {
      if (await bcrypt.compare(raw, row.token_hash)) {
        return { invite: row, state: usedOnly ? 'used' : 'active' }
      }
    }
    return null
  }

  const active = await scan(false)
  if (active) return active
  return scan(true)
}
