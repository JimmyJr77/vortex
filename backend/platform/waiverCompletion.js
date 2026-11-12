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
