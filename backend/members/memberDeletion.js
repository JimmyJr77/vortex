const historyChecks = [
  {
    message: 'Enrollment or booking history is linked to this member. Keep the member archived to preserve it.',
    references: [
      ['scheduling_signup', 'member_id'],
      ['drop_in_registration', 'member_id'],
      ['member_missed_class', 'member_id'],
      ['stripe_pending_enrollment', 'member_id'],
    ],
  },
  {
    message: 'Billing history is linked to this member. Keep the member archived to preserve it.',
    references: [
      ['billing_charge', 'member_id'],
      ['billing_subscription', 'member_id'],
      ['billing_account_activity', 'member_id'],
      ['billing_statement_line', 'member_id'],
      ['billing_monthly_invoice_line', 'member_id'],
      ['billing_pause_credit', 'member_id'],
      ['billing_account_migration_item', 'member_id'],
      ['enrollment_price_adjustment', 'member_id'],
      ['annual_membership_checkout_request', 'payer_member_id'],
      ['annual_membership_checkout_promo_reservation', 'member_id'],
      ['annual_membership_renewal_pricing', 'member_id'],
      ['additional_fee_redemption', 'member_id'],
      ['discount_redemption', 'member_id'],
      ['drop_in_credit_adjustment', 'member_id'],
      ['free_pass_redemption', 'member_id'],
      ['member_multi_class_pass', 'member_id'],
      ['multi_class_pass_redemption', 'member_id'],
      ['store_order', 'member_id'],
    ],
  },
  {
    message: 'Signed waiver evidence is linked to this member. Keep the member archived to preserve it.',
    references: [
      ['member_waiver_acceptance', 'member_id'],
      ['member_waiver_acceptance', 'accepted_by_member_id'],
    ],
  },
  {
    message: 'Imported history or a converted inquiry is linked to this member. Keep the member archived to preserve it.',
    references: [
      ['jackrabbit_history_record', 'member_id'],
      ['registrations', 'converted_member_id'],
    ],
  },
]

function blocked(message, code = 'MEMBER_DELETE_BLOCKED', blockers = [{ message }]) {
  return Object.assign(new Error(message), { statusCode: 409, code, blockers })
}

/** Permanently remove an archived member and their unused, member-only login. */
export async function deleteArchivedMember(pool, { memberId, facilityId }) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const { rows: [member] } = await db.query(
      `SELECT is_active, app_user_id, EXISTS (
         SELECT 1 FROM facility WHERE owner_user_id = member.app_user_id
       ) AS is_owner
       FROM member
       WHERE id = $1 AND facility_id = $2
       FOR UPDATE`,
      [memberId, facilityId],
    )
    if (!member) throw Object.assign(new Error('Member not found.'), { statusCode: 404 })
    if (member.is_owner) throw blocked('The facility Owner account cannot be deleted.', 'OWNER_ACCOUNT_PROTECTED')
    if (member.is_active === true) {
      throw blocked('Archive this member before permanently deleting the record.', 'MEMBER_ARCHIVE_REQUIRED')
    }

    // All identifiers come from the fixed schema list above. Locking the member
    // before these checks prevents new foreign-key links until deletion commits.
    const checks = historyChecks.map(({ references }) => references
      .map(([table, column]) => `EXISTS (SELECT 1 FROM ${table} WHERE ${column} = $1)`)
      .join(' OR '))
    const { rows: [{ history }] } = await db.query(
      `SELECT ARRAY[
         ${checks.join(',\n         ')},
         EXISTS (
           SELECT 1
           FROM parent_guardian_authority authority
           JOIN member child ON child.id = authority.child_member_id AND child.is_active = TRUE
           WHERE authority.parent_member_id = $1 AND authority.has_legal_authority = TRUE
         )
       ] AS history`,
      [memberId],
    )
    const messages = [
      ...historyChecks.map(({ message }) => message),
      'This member has legal authority for an active child. Update the child’s guardian records before deleting this member.',
    ]
    const blockers = messages.flatMap((message, index) => history[index] ? [{ message }] : [])
    if (blockers.length) throw blocked('Linked records prevent permanent deletion.', undefined, blockers)

    if (member.app_user_id != null) {
      await db.query('SELECT id FROM app_user WHERE id = $1 AND facility_id = $2 FOR UPDATE', [member.app_user_id, facilityId])
    }

    await db.query('DELETE FROM member WHERE id = $1 AND facility_id = $2', [memberId, facilityId])
    if (member.app_user_id != null) {
      await db.query(
        `DELETE FROM app_user login
          WHERE login.id = $1 AND login.facility_id = $2
            AND login.role::text = 'MEMBER_ATHLETE'
            AND NOT EXISTS (
              SELECT 1 FROM app_user_role WHERE user_id = login.id AND role::text <> 'MEMBER_ATHLETE'
            )
            AND NOT EXISTS (SELECT 1 FROM member WHERE app_user_id = login.id)
            AND NOT EXISTS (SELECT 1 FROM facility WHERE owner_user_id = login.id)`,
        [member.app_user_id, facilityId],
      )
    }
    await db.query('COMMIT')
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    if (error.code === '23503') {
      throw blocked('This member or login is still linked to records that must be retained. Keep the member archived.')
    }
    throw error
  } finally {
    db.release()
  }
}
