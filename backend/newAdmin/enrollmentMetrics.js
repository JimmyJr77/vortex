// Pure dashboard calculations. All money stays in cents until presentation.
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
const known = (rows, field) => rows.map(row => row[field]).filter(value => value != null && Number.isFinite(value))
export function summarizeMonths(months) {
  const additions = known(months, 'newFamilies'), cancellations = known(months, 'canceledFamilies')
  return {
    newFamilies: additions.length ? additions.reduce((sum, value) => sum + value, 0) : null,
    averageNewFamilies: average(additions), newFamilyMonths: additions.length,
    cancellations: cancellations.length ? cancellations.reduce((sum, value) => sum + value, 0) : null,
    averageCancellations: average(cancellations), cancellationMonths: cancellations.length,
    lastMonthLossRate: months.at(-1)?.lossRate ?? null,
    threeMonthLossRate: average(known(months.slice(-3), 'lossRate')),
    threeMonthRateMonths: known(months.slice(-3), 'lossRate').length,
    twelveMonthLossRate: average(known(months, 'lossRate')),
    twelveMonthRateMonths: known(months, 'lossRate').length,
  }
}

export function summarizeCurrent(enrollments, classes, today, subscriptions = null) {
  const students = new Map(), families = new Set(), classCounts = new Map()
  for (const item of classes) classCounts.set(String(item.id), { id: String(item.id), name: item.name, students: new Set() })
  for (const row of enrollments) {
    if (row.member_id == null) continue
    const memberId = String(row.member_id)
    families.add(String(row.family_id))
    const key = String(row.class_id ?? `form-${row.form_id}`)
    const klass = classCounts.get(key) ?? { id: key, name: row.class_name || 'Unnamed class', students: new Set() }
    klass.students.add(memberId)
    classCounts.set(key, klass)
    const teamName = [row.class_name, row.program_name].filter(Boolean).join(' ')
    const isTeam = /\bteam\b/i.test(teamName.replace(/\bnon[ -]?team\b/gi, ''))
    const student = students.get(memberId) ?? { ...row, team: false, classified: false }
    student.team ||= isTeam
    student.classified ||= Boolean(teamName)
    students.set(memberId, student)
  }
  const gender = { Boys: 0, Girls: 0, 'Other / unspecified': 0 }
  const ageCounts = new Map()
  const teams = { Team: 0, 'Non-team': 0, Unspecified: 0 }
  for (const student of students.values()) {
    const value = String(student.gender ?? '').trim().toLowerCase()
    gender[/^(m|male|boy)$/.test(value) ? 'Boys' : /^(f|female|girl)$/.test(value) ? 'Girls' : 'Other / unspecified']++
    const birth = String(student.date_of_birth ?? '').slice(0, 10)
    const validBirth = /^\d{4}-\d{2}-\d{2}$/.test(birth) && Number.isFinite(Date.parse(`${birth}T12:00:00Z`))
      && new Date(`${birth}T12:00:00Z`).toISOString().slice(0, 10) === birth && birth <= today
    const age = validBirth ? Number(today.slice(0, 4)) - Number(birth.slice(0, 4)) - (today.slice(5) < birth.slice(5) ? 1 : 0) : null
    const label = age == null || age > 120 ? 'Unspecified' : String(age)
    ageCounts.set(label, (ageCounts.get(label) ?? 0) + 1)
    teams[student.team ? 'Team' : student.classified ? 'Non-team' : 'Unspecified']++
  }
  const count = students.size
  let membership = null
  if (subscriptions != null) {
    // Only subscriptions tied to currently enrolled students/classes contribute.
    const currentIds = new Map(enrollments.map(row => [String(row.id), row]))
    const bySignup = new Map()
    for (const row of subscriptions) {
      const enrollment = currentIds.get(String(row.source_id))
      if (!enrollment || !students.has(String(row.member_id)) || String(row.member_id) !== String(enrollment.member_id)
        || String(row.family_id) !== String(enrollment.family_id)) continue
      const previous = bySignup.get(String(row.source_id))
      if (!previous || Number(row.id) > Number(previous.id)) bySignup.set(String(row.source_id), row)
    }
    const priced = [...bySignup.values()]
    const monthlyRevenueCents = priced.reduce((sum, row) => sum + (row.status === 'paused' ? 0 : Number(row.net_monthly_cents)), 0)
    membership = { monthlyRevenueCents, pricedStudents: new Set(priced.map(row => String(row.member_id))).size,
      averageMembershipCents: count && priced.length ? monthlyRevenueCents / count : null,
      averageFamilyMembershipCents: families.size && priced.length ? monthlyRevenueCents / families.size : null }
  }
  const breakdown = values => Object.entries(values).map(([label, count]) => ({ label, count }))
  return { families: families.size, students: count, studentsPerFamily: families.size ? count / families.size : null,
    classes: [...classCounts.values()].map(row => ({ id: row.id, name: row.name, count: row.students.size })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    genders: breakdown(gender), teams: breakdown(teams),
    ages: [...ageCounts].sort(([a], [b]) => a === 'Unspecified' ? 1 : b === 'Unspecified' ? -1 : Number(a) - Number(b)).map(([label, count]) => ({ label: label === 'Unspecified' ? label : `Age ${label}`, count })),
    membership }
}

export function acquisitionMetrics(months, spending, current, summary) {
  const byMonth = new Map(spending.map(row => [String(row.month).slice(0, 7), row]))
  const rows = months.map(row => {
    const spend = byMonth.get(row.key)
    const spendCents = spend?.amount_cents == null ? null : Number(spend.amount_cents)
    return { key: row.key, label: row.label, partial: row.partial, newFamilies: row.newFamilies,
      spendCents, version: Number(spend?.version ?? 0),
      cacCents: spendCents != null && row.newFamilies > 0 ? spendCents / row.newFamilies : null }
  })
  // Keep spend and enrollment denominators aligned. A blank month is not zero spend.
  // Months with spending but no new families still contribute to the aggregate cost.
  const included = rows.filter(row => !row.partial && row.spendCents != null && row.newFamilies != null)
  const totalSpendCents = included.reduce((sum, row) => sum + row.spendCents, 0)
  const newFamilies = included.reduce((sum, row) => sum + row.newFamilies, 0)
  const cacCents = included.length && newFamilies > 0 ? totalSpendCents / newFamilies : null
  const retentionMonths = summary.twelveMonthLossRate > 0 ? 100 / summary.twelveMonthLossRate : null
  const tuition = current.membership?.averageMembershipCents
  const familyLifetimeRevenueCents = tuition != null && retentionMonths != null && current.studentsPerFamily != null
    ? tuition * current.studentsPerFamily * retentionMonths : null
  return { rows, includedMonths: included.length, totalSpendCents, newFamilies, cacCents, retentionMonths,
    familyLifetimeRevenueCents, revenuePerDollar: cacCents > 0 && familyLifetimeRevenueCents != null ? familyLifetimeRevenueCents / cacCents : null }
}
