import { recordBillingActivity } from './billingActivity.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'

function dateOnly(value) {
  const match = String(value ?? '').match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

function positiveInteger(value) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

function memberName(member) {
  return [member?.first_name, member?.last_name].filter(Boolean).join(' ').trim() || 'Family member'
}

function objectValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function identityResponses(value, member) {
  return {
    ...objectValue(value),
    first_name: member.first_name ?? null,
    last_name: member.last_name ?? null,
    email: member.email ?? null,
    phone: member.phone ?? null,
  }
}

export function normalizeCustomerBillingEnrollmentMemberSwapInput(input = {}) {
  const targetMemberId = positiveInteger(input.targetMemberId)
  if (targetMemberId == null) throw new Error('Choose a family member for this enrollment.')
  return { targetMemberId }
}

async function loadSourceEnrollment(db, { signupId, facilityId }) {
  const result = await db.query(
    `SELECT signup.id AS signup_id,
            signup.member_id AS source_member_id,
            signup.status AS signup_status,
            signup.cancel_effective_date,
            signup.enrollment_start_date,
            signup.created_at,
            signup.first_name,
            signup.last_name,
            signup.email,
            signup.phone,
            signup.field_responses,
            signup.responses,
            family.id AS family_id,
            family.facility_id,
            account.id AS account_id,
            form.title AS class_name
       FROM scheduling_signup signup
       JOIN member source_member ON source_member.id = signup.member_id
       JOIN family ON ${canonicalActiveHouseholdMemberPredicate({
         memberAlias: 'source_member',
         familyIdReference: 'family.id',
         membershipAlias: 'source_household_membership',
         historyAlias: 'source_household_membership_history',
       })}
       JOIN family_billing_account account
         ON account.family_id = family.id
        AND account.is_active = TRUE
       LEFT JOIN scheduling_form form ON form.id = signup.form_id
      WHERE signup.id = $1
        AND family.facility_id = $2
      ORDER BY account.id
      LIMIT 1
      FOR UPDATE OF signup`,
    [Number(signupId), Number(facilityId)],
  )
  const source = result.rows[0]
  if (!source) throw new Error('The current enrollment could not be found.')
  if (!['confirmed', 'paused'].includes(source.signup_status)) {
    throw new Error('Only current confirmed or paused enrollments can be reassigned.')
  }
  if (source.cancel_effective_date) {
    throw new Error('An enrollment with a pending cancellation or class move cannot be reassigned.')
  }
  return source
}

async function loadTargetMember(db, { familyId, targetMemberId }) {
  const result = await db.query(
    `SELECT target_member.id, target_member.family_id,
            target_member.first_name, target_member.last_name,
            target_member.email, target_member.phone, target_member.is_active
       FROM member target_member
      WHERE target_member.id = $1
        AND ${canonicalActiveHouseholdMemberPredicate({
          memberAlias: 'target_member',
          familyIdReference: '$2',
          membershipAlias: 'target_household_membership',
          historyAlias: 'target_household_membership_history',
        })}
      LIMIT 1
      FOR KEY SHARE`,
    [targetMemberId, familyId],
  )
  const target = result.rows[0]
  if (!target) throw new Error('Choose a family member from this billing account.')
  return target
}

function replayedMemberSwap(activity) {
  const after = objectValue(activity?.after_value)
  const details = objectValue(activity?.details)
  return {
    replayed: true,
    signupId: positiveInteger(after.signupId ?? details.signupId),
    previousMemberId: positiveInteger(after.previousMemberId ?? details.previousMemberId),
    memberId: positiveInteger(after.memberId ?? details.memberId),
    memberName: after.memberName ?? details.memberName ?? null,
    enrollmentStartDate: dateOnly(after.enrollmentStartDate ?? details.enrollmentStartDate),
  }
}

/**
 * Correct the person assigned to an existing class enrollment. This is
 * intentionally an enrollment-record correction: its original enrollment and
 * creation dates remain intact, and no subscription, charge, payment,
 * adjustment, membership, or pricing row is changed.
 */
export async function reassignCustomerBillingEnrollmentMember(pool, {
  signupId,
  facilityId,
  actorUserId = null,
  requestKey,
  input = {},
}) {
  if (actorUserId == null) throw new Error('Authenticated administrator identity is required.')
  if (!requestKey) throw new Error('An Idempotency-Key header is required.')
  const normalizedSignupId = positiveInteger(signupId)
  const normalizedFacilityId = positiveInteger(facilityId)
  if (normalizedSignupId == null || normalizedFacilityId == null) {
    throw new Error('A valid enrollment and facility are required.')
  }
  const { targetMemberId } = normalizeCustomerBillingEnrollmentMemberSwapInput(input)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [normalizedSignupId])

    const eventKey = `customer-billing-enrollment-member-swap:${requestKey}`
    const existing = await client.query(
      `SELECT after_value, details
         FROM billing_account_activity
        WHERE event_key = $1
        FOR UPDATE`,
      [eventKey],
    )
    if (existing.rows[0]) {
      await client.query('COMMIT')
      return replayedMemberSwap(existing.rows[0])
    }

    const source = await loadSourceEnrollment(client, {
      signupId: normalizedSignupId,
      facilityId: normalizedFacilityId,
    })
    if (Number(source.source_member_id) === targetMemberId) {
      throw new Error('Choose a different family member for this enrollment.')
    }
    const target = await loadTargetMember(client, {
      familyId: Number(source.family_id),
      targetMemberId,
    })
    const fieldResponses = identityResponses(source.field_responses, target)
    const responses = identityResponses(source.responses, target)
    const updated = await client.query(
      `UPDATE scheduling_signup
          SET member_id = $2,
              first_name = $3,
              last_name = $4,
              email = $5,
              phone = $6,
              field_responses = $7::jsonb,
              responses = $8::jsonb
        WHERE id = $1
          AND member_id = $9
        RETURNING id, member_id, enrollment_start_date, created_at`,
      [
        normalizedSignupId,
        Number(target.id),
        target.first_name ?? null,
        target.last_name ?? null,
        target.email ?? null,
        target.phone ?? null,
        JSON.stringify(fieldResponses),
        JSON.stringify(responses),
        Number(source.source_member_id),
      ],
    )
    if (!updated.rows[0]) throw new Error('The enrollment changed before it could be reassigned. Please try again.')

    const previousMember = {
      id: Number(source.source_member_id),
      first_name: source.first_name,
      last_name: source.last_name,
    }
    const result = {
      signupId: normalizedSignupId,
      previousMemberId: Number(source.source_member_id),
      previousMemberName: memberName(previousMember),
      memberId: Number(target.id),
      memberName: memberName(target),
      enrollmentStartDate: dateOnly(updated.rows[0].enrollment_start_date ?? source.enrollment_start_date),
      createdAt: updated.rows[0].created_at ?? source.created_at ?? null,
    }
    await recordBillingActivity(client, {
      eventKey,
      accountId: Number(source.account_id),
      memberId: Number(target.id),
      signupId: normalizedSignupId,
      eventType: 'enrollment_member_reassigned',
      summary: `${source.class_name || 'Class'} enrollment was reassigned from ${result.previousMemberName} to ${result.memberName}. Billing was not changed.`,
      beforeValue: {
        signupId: normalizedSignupId,
        memberId: result.previousMemberId,
        memberName: result.previousMemberName,
        enrollmentStartDate: result.enrollmentStartDate,
      },
      afterValue: result,
      details: {
        ...result,
        className: source.class_name || null,
        assignmentBasis: 'target_member_is_treated_as_enrolled_from_the_original_enrollment_date',
        billingChanged: false,
      },
      actorUserId,
    })
    await client.query('COMMIT')
    return { ...result, replayed: false }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
