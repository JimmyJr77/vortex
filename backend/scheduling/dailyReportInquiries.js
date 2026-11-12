import { calendarDateParts } from '../members/dateOnlyAge.js'

function cleanText(value) {
  return String(value ?? '').trim()
}

function fullName(firstName, lastName) {
  return [firstName, lastName].map(cleanText).filter(Boolean).join(' ')
}

function childAge(birthday, inquiryDate) {
  const birth = calendarDateParts(birthday)
  if (!birth || !inquiryDate) return null

  const beforeBirthday = inquiryDate.month < birth.month
    || (inquiryDate.month === birth.month && inquiryDate.day < birth.day)
  const age = inquiryDate.year - birth.year - Number(beforeBirthday)
  return age >= 0 ? age : null
}

function inquiryChildren(row) {
  const inquiryDate = calendarDateParts(row.received_date)
  const campers = Array.isArray(row.campers) ? row.campers : []
  const children = campers.map((camper) => ({
    name: fullName(camper?.firstName, camper?.lastName),
    age: childAge(camper?.dateOfBirth, inquiryDate),
  })).filter(({ name, age }) => name || age != null)
  if (children.length) return children

  const reportedAges = (row.child_ages || []).filter((age) => Number.isInteger(age) && age >= 0)
  if (!reportedAges.length && Number.isInteger(row.athlete_age) && row.athlete_age >= 0) {
    reportedAges.push(row.athlete_age)
  }
  return reportedAges.map((age) => ({ name: '', age }))
}

function inquiryInterest(row) {
  const interests = (row.interests_array || []).map(cleanText).filter(Boolean)
  const selections = [
    ...(interests.length ? interests : [row.interests]),
    row.interest,
    ...(row.class_types || []),
  ].map(cleanText).filter(Boolean)
  const unique = new Map(selections.map((selection) => [selection.toLowerCase(), selection]))
  return [...unique.values()].join(', ') || cleanText(row.message).replace(/\s+/g, ' ')
}

export async function loadDailyReportInquiries(pool, { since, through }) {
  const { rows } = await pool.query(`
    SELECT r.id, r.first_name, r.last_name, r.email, r.phone, r.submitter_role,
           r.campers, r.child_ages, r.athlete_age, r.interests_array, r.interests,
           r.interest, r.class_types, r.message,
           r.created_at AT TIME ZONE 'UTC' AS received_at,
           ((r.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::date::text AS received_date
      FROM registrations r
     WHERE r.archived IS NOT TRUE
       AND r.created_at >= ($1::timestamptz AT TIME ZONE 'UTC')
       AND r.created_at < ($2::timestamptz AT TIME ZONE 'UTC')
     ORDER BY r.created_at DESC, r.id DESC
  `, [since, through])

  const inquiries = []
  const seen = new Set()
  for (const row of rows) {
    const inquiry = {
      id: Number(row.id),
      receivedAt: row.received_at,
      contactName: fullName(row.first_name, row.last_name),
      contactEmail: cleanText(row.email),
      contactPhone: cleanText(row.phone),
      contactRole: cleanText(row.submitter_role),
      children: inquiryChildren(row),
      interest: inquiryInterest(row),
    }
    // Keep distinct requests, even when a family uses the same email address.
    const key = JSON.stringify([
      inquiry.contactEmail.toLowerCase(), inquiry.contactName.toLowerCase(), inquiry.contactPhone,
      inquiry.contactRole, row.campers, row.child_ages, row.athlete_age, inquiry.interest, cleanText(row.message),
    ])
    if (seen.has(key)) continue
    seen.add(key)
    inquiries.push(inquiry)
  }
  return inquiries
}
