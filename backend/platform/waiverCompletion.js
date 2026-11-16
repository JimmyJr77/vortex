/** Check each authorized member's existing signatures as well as this submission. */
export async function missingRequiredWaiverIds(pool, {
  facilityId,
  memberIds,
  requiredIds,
  acceptedTemplateIds,
}) {
  const unsubmitted = requiredIds.filter(id => !acceptedTemplateIds.includes(id))
  if (unsubmitted.length === 0) return []

  const existing = await pool.query(
    `SELECT acceptance.member_id, acceptance.waiver_template_id
     FROM member_waiver_acceptance acceptance
     JOIN member m ON m.id = acceptance.member_id
     JOIN waiver_template template ON template.id = acceptance.waiver_template_id
       AND template.facility_id = m.facility_id
     WHERE m.facility_id = $1
       AND m.id = ANY($2::bigint[])
       AND template.id = ANY($3::bigint[])`,
    [facilityId, memberIds, unsubmitted],
  )
  const signed = new Set(existing.rows.map(row => `${Number(row.member_id)}:${Number(row.waiver_template_id)}`))
  return unsubmitted.filter(id => memberIds.some(memberId => !signed.has(`${Number(memberId)}:${id}`)))
}

/** A booking must be covered by the athlete's own current, completed signatures. */
export async function assertCurrentMemberWaivers(client, memberId, facilityId, bookingLabel = 'drop-in') {
  const result = await client.query(
    `SELECT template.id, template.waiver_type, acceptance.member_id,
            acceptance.signature_name, acceptance.payment_policy_acknowledged
       FROM waiver_template template
       LEFT JOIN member_waiver_acceptance acceptance
         ON acceptance.waiver_template_id = template.id AND acceptance.member_id = $1
      WHERE template.facility_id = $2 AND template.is_required = TRUE
        AND template.active_from <= now() AND (template.active_to IS NULL OR template.active_to > now())`,
    [memberId, facilityId],
  )
  if (!result.rows.length) {
    throw Object.assign(new Error('Required waivers are unavailable. Please contact the team before booking.'), { statusCode: 400 })
  }
  if (result.rows.some(row => !row.member_id || !String(row.signature_name ?? '').trim()
      || (row.waiver_type === 'PAYMENT_POLICY' && row.payment_policy_acknowledged !== true))) {
    throw Object.assign(new Error(`All current required waivers must be signed for this athlete before the ${bookingLabel} is confirmed.`), {
      statusCode: 400,
      code: 'DROP_IN_WAIVERS_REQUIRED',
    })
  }
}
