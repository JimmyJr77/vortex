/**
 * Email address validation, normalization, and common-domain typo detection.
 * Pure module (no I/O). Never auto-corrects — callers should confirm a suggestion
 * with the user before changing the stored address.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Frequent mistypes -> canonical domain.
const DOMAIN_TYPOS = Object.freeze({
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gnail.com': 'gmail.com',
  'googlemail.con': 'googlemail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'iclould.com': 'icloud.com',
  'icloud.con': 'icloud.com',
  'comcast.net.com': 'comcast.net',
  'aol.con': 'aol.com',
})

/**
 * Trim and lowercase the domain (local part is left as-is per RFC; most providers are
 * case-insensitive but we do not alter it to avoid surprising the user).
 * @returns {string} normalized address (may still be invalid)
 */
export function normalizeEmail(raw) {
  const s = String(raw ?? '').trim()
  const at = s.lastIndexOf('@')
  if (at < 0) return s
  const local = s.slice(0, at)
  const domain = s.slice(at + 1).toLowerCase()
  return `${local}@${domain}`
}

export function isValidEmail(raw) {
  return EMAIL_RE.test(normalizeEmail(raw))
}

export function emailDomain(raw) {
  const s = normalizeEmail(raw)
  const at = s.lastIndexOf('@')
  return at >= 0 ? s.slice(at + 1) : ''
}

/** Extract the bare address from a possibly display-name-wrapped value: `Name <a@b>` -> `a@b`. */
export function extractEmailAddress(value) {
  const s = String(value || '').trim()
  const bracketed = s.match(/<([^>]+)>/)
  if (bracketed) return bracketed[1].trim()
  return s
}

/**
 * @returns {{ normalized: string, valid: boolean, suggestion: string | null, reason: string | null }}
 */
export function inspectEmail(raw) {
  const normalized = normalizeEmail(raw)
  if (!normalized) return { normalized, valid: false, suggestion: null, reason: 'empty' }
  if (!EMAIL_RE.test(normalized)) {
    return { normalized, valid: false, suggestion: null, reason: 'malformed' }
  }
  const domain = emailDomain(normalized)
  const fixed = DOMAIN_TYPOS[domain]
  if (fixed && fixed !== domain) {
    const local = normalized.slice(0, normalized.lastIndexOf('@'))
    return {
      normalized,
      valid: true,
      suggestion: `${local}@${fixed}`,
      reason: 'possible_typo',
    }
  }
  return { normalized, valid: true, suggestion: null, reason: null }
}
