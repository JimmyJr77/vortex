import { sendWelcomeMemberEmail } from './welcomeMemberEmail.js'
import { sendFamilyMemberAddedEmail } from './familyMemberAddedEmail.js'
import { issueEnrollmentReceipt } from './enrollmentReceiptService.js'
import {
  resolveMemberContactEmail,
  listFamilyGuardianEmails,
  loadMemberRow,
  dedupeEmails,
} from './memberContact.js'

/**
 * @param {import('pg').Pool} pool
 * @param {number} memberId
 * @param {{ context?: string; bestEffort?: boolean }} options
 */
export async function notifyWelcomeNewMember(pool, memberId, { context = 'signup', bestEffort = true } = {}) {
  try {
    const member = await loadMemberRow(pool, memberId)
    if (!member) return { sent: false, skipped: true }

    const contact = await resolveMemberContactEmail(pool, member)
    if (!contact?.email) return { sent: false, skipped: true, reason: 'no_contact_email' }

    const hasLogin = Boolean(member.username)
    const result = await sendWelcomeMemberEmail({
      to: contact.email,
      firstName: member.first_name,
      username: member.username,
      hasLogin,
    })
    return { sent: result.sent === true, email: contact.email, context }
  } catch (err) {
    if (bestEffort) {
      console.warn(`[memberNotifications] welcome failed (member ${memberId}, ${context}):`, err?.message || err)
      return { sent: false, reason: 'error' }
    }
    throw err
  }
}

/**
 * Send welcome to multiple new members; dedupe by email within batch.
 * @param {import('pg').Pool} pool
 * @param {number[]} memberIds
 */
export async function notifyWelcomeNewMembers(pool, memberIds, options = {}) {
  const sentTo = new Set()
  const results = []
  for (const memberId of memberIds) {
    const member = await loadMemberRow(pool, memberId)
    if (!member) continue
    const contact = await resolveMemberContactEmail(pool, member)
    if (!contact?.email) continue
    const key = contact.email.toLowerCase()
    if (sentTo.has(key)) continue
    sentTo.add(key)
    results.push(await notifyWelcomeNewMember(pool, memberId, options))
  }
  return results
}

/**
 * @param {import('pg').Pool} pool
 * @param {{
 *   memberId: number
 *   athleteName?: string
 *   programName: string
 *   slotLabel?: string
 *   status?: string
 *   selectedDays?: string[]
 *   schedulingSignupId?: number | null
 *   memberProgramId?: number | null
 *   bestEffort?: boolean
 * }} params
 */
export async function notifyEnrollmentReceipt(pool, params) {
  const { memberId, bestEffort = true, ...rest } = params
  try {
    const member = await loadMemberRow(pool, memberId)
    if (!member) return { sent: false, skipped: true }

    const contact = await resolveMemberContactEmail(pool, member)
    if (!contact?.email) return { sent: false, skipped: true, reason: 'no_contact_email' }

    const athleteName =
      rest.athleteName ||
      `${member.first_name || ''} ${member.last_name || ''}`.trim() ||
      'Athlete'

    return await issueEnrollmentReceipt(pool, {
      memberId: Number(memberId),
      recipientEmail: contact.email,
      athleteName,
      guardianName: contact.guardianName,
      programName: rest.programName,
      slotLabel: rest.slotLabel || '',
      status: rest.status || 'confirmed',
      selectedDays: rest.selectedDays || [],
      schedulingSignupId: rest.schedulingSignupId ?? null,
      memberProgramId: rest.memberProgramId ?? null,
      bestEffort,
    })
  } catch (err) {
    if (bestEffort) {
      console.warn(`[memberNotifications] enrollment receipt failed (member ${memberId}):`, err?.message || err)
      return { sent: false, reason: 'error' }
    }
    throw err
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ familyId: number; newMemberId: number; addedByMemberId?: number | null; familyName?: string | null; bestEffort?: boolean }} params
 */
export async function notifyFamilyGuardiansNewMember(pool, params) {
  const { familyId, newMemberId, familyName = null, bestEffort = true } = params
  try {
    const newMember = await loadMemberRow(pool, newMemberId)
    if (!newMember) return { sent: false, skipped: true }

    const guardianEmails = await listFamilyGuardianEmails(pool, familyId, {
      excludeMemberId: newMemberId,
    })
    if (guardianEmails.length === 0) return { sent: false, skipped: true, reason: 'no_guardians' }

    const newMemberName = `${newMember.first_name || ''} ${newMember.last_name || ''}`.trim() || 'New member'
    let familyLabel = familyName
    if (!familyLabel) {
      const fam = await pool.query(`SELECT family_name FROM family WHERE id = $1`, [familyId])
      familyLabel = fam.rows[0]?.family_name || null
    }

    const results = []
    for (const to of dedupeEmails(guardianEmails)) {
      const guardian = await pool.query(
        `SELECT first_name FROM member WHERE LOWER(email) = LOWER($1) AND family_id = $2 LIMIT 1`,
        [to, familyId],
      )
      const r = await sendFamilyMemberAddedEmail({
        to,
        guardianFirstName: guardian.rows[0]?.first_name || null,
        newMemberName,
        familyName: familyLabel,
      })
      results.push({ to, sent: r.sent === true })
    }
    return { sent: results.some((r) => r.sent), results }
  } catch (err) {
    if (bestEffort) {
      console.warn('[memberNotifications] family guardian alert failed:', err?.message || err)
      return { sent: false, reason: 'error' }
    }
    throw err
  }
}
