import Joi from 'joi'

const emailFormat = Joi.string().max(254).email({ tlds: { allow: false } })

export function normalizeSignupEmail(value) {
  const email = String(value ?? '').trim().toLowerCase()
  return emailFormat.validate(email).error ? null : email
}

export function normalizeLoginPhone(value) {
  const phone = String(value ?? '').trim()
  if (!/^\+?[\d().\s-]+$/.test(phone)) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits.length === 10 && !phone.startsWith('+') ? digits : null
}

export async function findActiveMemberLoginCandidates(db, identifier) {
  const login = String(identifier ?? '').trim()
  if (!login) return []
  const phone = normalizeLoginPhone(login)
  const normalizedStoredPhone = "regexp_replace(BTRIM(u.phone), '[^0-9]', '', 'g')"
  const result = await db.query(`
    SELECT u.*
    FROM app_user u
    WHERE u.is_active = TRUE
      AND (${login.includes('@') ? 'LOWER(BTRIM(u.email))' : 'LOWER(BTRIM(u.username))'} = LOWER($1)
        OR ($2::text IS NOT NULL AND BTRIM(u.phone) ~ '^[+]?[0-9().[:space:]-]+$'
          AND (${normalizedStoredPhone} = '1' || $2
            OR (BTRIM(u.phone) NOT LIKE '+%' AND ${normalizedStoredPhone} = $2))))
    ORDER BY u.id
    LIMIT 2
  `, [login, phone])
  return result.rows
}
