import { sendWelcomeMemberEmail } from './welcomeMemberEmail.js'
import { sendFamilyMemberAddedEmail } from './familyMemberAddedEmail.js'
import { issueEnrollmentReceipt } from './enrollmentReceiptService.js'
import { sendPaymentReceiptEmail } from './paymentReceiptEmail.js'
import { sendPaymentFailedEmail } from './paymentFailedEmail.js'
import {
  resolveMemberContactEmail,
  listFamilyGuardianEmails,
  loadMemberRow,
  dedupeEmails,
  resolveAppUserEmail,
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
 *   pricingSummary?: object | null
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
      pricingSummary: rest.pricingSummary ?? null,
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
 * Send a payment receipt to the family billing payer (best-effort).
 * @param {import('pg').Pool} pool
 * @param {{
 *   account: { id:number, family_id?:number, payer_member_id?:number|null, billing_email?:string|null },
 *   payment: { amount_cents:number, method?:string|null, paid_at?:string|Date|null, external_reference?:string|null },
 *   bestEffort?: boolean
 * }} params
 */
/**
 * Resolve the billing payer's email + display name for a family billing account.
 * Prefers the payer member's contact, falls back to the account billing email.
 * @returns {Promise<{ to: string|null, guardianName: string|null }>}
 */
async function resolvePayerRecipient(pool, account) {
  let to = null
  let guardianName = null
  if (account?.payer_member_id != null) {
    const payer = await loadMemberRow(pool, Number(account.payer_member_id))
    if (payer) {
      const contact = await resolveMemberContactEmail(pool, payer)
      to = contact?.email ?? null
      guardianName = contact?.guardianName ?? payer.first_name ?? null
    }
  }
  if (!to && account?.billing_email) to = String(account.billing_email).trim()
  return { to, guardianName }
}

export async function notifyPaymentReceipt(pool, { account, payment, bestEffort = true }) {
  try {
    if (!account?.id || !payment) return { sent: false, skipped: true }

    const { to, guardianName } = await resolvePayerRecipient(pool, account)
    if (!to) return { sent: false, skipped: true, reason: 'no_recipient' }

    // Remaining balance after this payment (charges − payments + refunds).
    let balanceAfterCents = null
    try {
      const bal = await pool.query(
        `
          SELECT
            COALESCE((SELECT SUM(amount_cents) FROM billing_charge WHERE family_billing_account_id = $1), 0)::int
            - COALESCE((SELECT SUM(amount_cents) FROM billing_payment WHERE family_billing_account_id = $1), 0)::int
            + COALESCE((SELECT SUM(amount_cents) FROM billing_refund WHERE family_billing_account_id = $1), 0)::int
            AS balance_cents
        `,
        [account.id],
      )
      balanceAfterCents = Number(bal.rows[0]?.balance_cents ?? 0)
    } catch {
      balanceAfterCents = null
    }

    const result = await sendPaymentReceiptEmail({
      to,
      guardianName,
      amountCents: Number(payment.amount_cents ?? 0),
      method: payment.method ?? null,
      paidAt: payment.paid_at ?? null,
      reference: payment.external_reference ?? null,
      balanceAfterCents,
    })
    return { sent: result.sent === true, email: to }
  } catch (err) {
    if (bestEffort) {
      console.warn('[memberNotifications] payment receipt failed:', err?.message || err)
      return { sent: false, reason: 'error' }
    }
    throw err
  }
}

/**
 * Send a failed-payment / dunning notice to the billing payer (best-effort).
 * @param {import('pg').Pool} pool
 * @param {{
 *   account: { id:number, payer_member_id?:number|null, billing_email?:string|null },
 *   amountCents: number,
 *   reason?: string|null,
 *   updatePaymentUrl?: string|null,
 *   bestEffort?: boolean
 * }} params
 */
export async function notifyPaymentFailed(pool, { account, amountCents, reason = null, updatePaymentUrl = null, idempotencyKey = null, bestEffort = true }) {
  try {
    if (!account?.id) return { sent: false, skipped: true }
    const { to, guardianName } = await resolvePayerRecipient(pool, account)
    if (!to) return { sent: false, skipped: true, reason: 'no_recipient' }
    const result = await sendPaymentFailedEmail({
      to,
      guardianName,
      amountCents: Number(amountCents ?? 0),
      reason,
      updatePaymentUrl,
      idempotencyKey,
    })
    return { sent: result.sent === true, email: to }
  } catch (err) {
    if (bestEffort) {
      console.warn('[memberNotifications] payment failed notice error:', err?.message || err)
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
  const { familyId, newMemberId, familyName = null, addedByUserId = null, bestEffort = true } = params
  try {
    const newMember = await loadMemberRow(pool, newMemberId)
    if (!newMember) return { sent: false, skipped: true }

    let guardianEmails = await listFamilyGuardianEmails(pool, familyId, {
      excludeMemberId: newMemberId,
    })

    const actorEmail = addedByUserId ? await resolveAppUserEmail(pool, addedByUserId) : null
    if (actorEmail) {
      guardianEmails = dedupeEmails([...guardianEmails, actorEmail])
    }

    if (guardianEmails.length === 0) {
      console.warn(
        '[memberNotifications] family_member_added: no guardian emails for family',
        familyId,
        'newMember',
        newMemberId,
      )
      return { sent: false, skipped: true, reason: 'no_guardians' }
    }

    const newMemberName = `${newMember.first_name || ''} ${newMember.last_name || ''}`.trim() || 'New member'
    let familyLabel = familyName
    if (!familyLabel) {
      const fam = await pool.query(`SELECT family_name FROM family WHERE id = $1`, [familyId])
      familyLabel = fam.rows[0]?.family_name || null
    }

    const results = []
    for (const to of dedupeEmails(guardianEmails)) {
      const guardian = await pool.query(
        `
          SELECT m.first_name
          FROM family_member fm
          JOIN member m ON m.id = fm.member_id
          LEFT JOIN app_user au ON au.id = m.app_user_id
          WHERE fm.family_id = $2
            AND LOWER(COALESCE(NULLIF(TRIM(m.email), ''), NULLIF(TRIM(au.email), ''))) = LOWER($1)
          LIMIT 1
        `,
        [to, familyId],
      )
      let guardianFirstName = guardian.rows[0]?.first_name || null
      if (!guardianFirstName && actorEmail && to.toLowerCase() === actorEmail.toLowerCase() && addedByUserId) {
        const actor = await pool.query(
          `SELECT split_part(COALESCE(full_name, ''), ' ', 1) AS first_name FROM app_user WHERE id = $1`,
          [addedByUserId],
        )
        guardianFirstName = actor.rows[0]?.first_name || null
      }
      const r = await sendFamilyMemberAddedEmail({
        to,
        guardianFirstName,
        newMemberName,
        familyName: familyLabel,
      })
      if (r.sent !== true) {
        console.warn('[memberNotifications] family_member_added not sent to', to, r.reason || r.skipped || 'unknown')
      }
      results.push({ to, sent: r.sent === true, reason: r.reason || null })
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
