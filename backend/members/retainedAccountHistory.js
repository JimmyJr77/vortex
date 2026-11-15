/** An archive is the original account, not a disposable snapshot. Payment-free
 * setup records may be removed, but participation and coaching history may not. */
export async function assertNoRetainedAccountHistory(db, { familyId, memberIds }) {
  const { rows: [history] } = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM account_enrollment_current
       WHERE (record_family_id=$1 OR member_id=ANY($2::bigint[]))
         AND (historical_only OR status IS DISTINCT FROM 'pending_setup')
     ) OR EXISTS (
       SELECT 1 FROM scheduling_signup s
       JOIN account_invite i ON i.id=s.account_invite_id
       LEFT JOIN registrations r ON r.id=i.registration_id
       WHERE (i.pending_family_id=$1 OR r.member_id=ANY($2::bigint[]) OR r.converted_member_id=ANY($2::bigint[]))
         AND s.status IS DISTINCT FROM 'pending_setup'
     ) OR EXISTS (
       SELECT 1 FROM member_waiver_acceptance WHERE accepted_by_member_id=ANY($2::bigint[])
         AND NOT (member_id=ANY($2::bigint[]))
     ) OR EXISTS (
       SELECT 1 FROM drop_in_registration WHERE member_id=ANY($2::bigint[])
         AND status NOT IN ('account_required','payment_pending')
     ) OR EXISTS (
       SELECT 1 FROM member_missed_class WHERE member_id=ANY($2::bigint[])
     ) OR EXISTS (
       SELECT 1 FROM jackrabbit_history_record
       WHERE (family_id=$1 OR member_id=ANY($2::bigint[]))
         AND record_kind IN ('enrollment','attendance')
     ) AS retained`, [familyId, memberIds],
  )
  if (history.retained) throw historyProtected()

  // These modules are optional on older installations. Identifiers are a fixed
  // allowlist; absence of a module must not break unrelated account cleanup.
  const tables = ['public.member_program', 'coaching.session_attendance',
    'coaching.completion_log', 'coaching.assessment_result', 'coaching.athlete_skill_progress',
    'coaching.personal_record', 'coaching.wellness_checkin', 'coaching.goal', 'coaching.achievement']
  const { rows: present } = await db.query(
    'SELECT name FROM unnest($1::text[]) name WHERE to_regclass(name) IS NOT NULL', [tables],
  )
  for (const { name } of present) {
    if (!tables.includes(name)) continue
    const { rowCount } = await db.query(`SELECT 1 FROM ${name} WHERE member_id=ANY($1::bigint[]) LIMIT 1`, [memberIds])
    if (rowCount) throw historyProtected()
  }
}

function historyProtected() {
  const message = 'This is the original account and has class, attendance, coaching history, or signed evidence for another member. Restore it to keep using it, or keep it archived to retain the history. An unpaid account is not necessarily an empty duplicate.'
  return Object.assign(new Error(message), {
    statusCode: 409, code: 'ACCOUNT_HISTORY_PROTECTED',
    blockers: [{ type: 'retained_account_history', message }],
  })
}
