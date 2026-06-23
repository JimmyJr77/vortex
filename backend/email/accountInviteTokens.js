import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { publicAppUrl } from './publicAppUrl.js'

function inviteCryptoKey() {
  const secret = process.env.JWT_SECRET || 'dev-insecure-jwt-secret'
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
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

export function decryptAccountInviteToken(ciphertext) {
  if (!ciphertext) return null
  try {
    const buf = Buffer.from(ciphertext, 'base64url')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const encrypted = buf.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', inviteCryptoKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export async function createAccountInviteTokenRecord() {
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(token, 10)
  const tokenCiphertext = encryptAccountInviteToken(token)
  return { token, tokenHash, tokenCiphertext }
}
