/** Fields required before a scheduling stub is considered complete (mirrors MemberFormSection essentials). */
export function isMemberProfileComplete(member) {
  if (!member) return false
  const phone = String(member.phone || '').trim()
  const gender = String(member.gender || '').trim()
  const dob = member.date_of_birth
  const medical = String(member.medical_concerns ?? member.medicalConcerns ?? '').trim()
  const noInjury = Boolean(member.no_injury_history ?? member.noInjuryHistory)
  const injuryOk =
    noInjury ||
    (String(member.injury_history_body_part ?? member.injuryHistoryBodyPart ?? '').trim() &&
      String(member.injury_history_notes ?? member.injuryHistoryNotes ?? '').trim())

  return Boolean(phone && gender && dob && medical && injuryOk)
}
