// Pure dashboard calculations. All money stays in cents until presentation.
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
const known = (rows, field) => rows.map(row => row[field]).filter(value => value != null && Number.isFinite(value))
export function summarizeLossRates(months) {
  return {
    lastMonthLossRate: months.at(-1)?.lossRate ?? null,
    threeMonthLossRate: average(known(months.slice(-3), 'lossRate')),
    threeMonthRateMonths: known(months.slice(-3), 'lossRate').length,
    twelveMonthLossRate: average(known(months, 'lossRate')),
    twelveMonthRateMonths: known(months, 'lossRate').length,
  }
}
export function summarizeMonths(months) {
  const additions = known(months, 'newFamilies'), cancellations = known(months, 'canceledFamilies')
  return {
    newFamilies: additions.length ? additions.reduce((sum, value) => sum + value, 0) : null,
    averageNewFamilies: average(additions), newFamilyMonths: additions.length,
    cancellations: cancellations.length ? cancellations.reduce((sum, value) => sum + value, 0) : null,
    averageCancellations: average(cancellations), cancellationMonths: cancellations.length,
    ...summarizeLossRates(months),
  }
}

export function summarizeQuarters(asOf, months) {
  const year = Number(asOf.slice(0, 4))
  const monthIndex = Number(asOf.slice(5, 7)) - 1
  const quarterStart = monthIndex - monthIndex % 3
  const key = offset => new Date(Date.UTC(year, quarterStart + offset, 1)).toISOString().slice(0, 7)
  const summarize = (start, end, monthCount) => {
    const summary = summarizeMonths(months.filter(month => month.key >= start && month.key <= end))
    return { start, end, monthCount, ...summary,
      averageLossRate: summary.twelveMonthLossRate, lossRateMonths: summary.twelveMonthRateMonths }
  }
  return [
    ...[-9, -6, -3, 0].map(offset => summarize(key(offset), key(offset === 0 ? monthIndex % 3 : offset + 2), offset === 0 ? monthIndex % 3 + 1 : 3)),
    summarize(key(-12), key(-1), 12),
  ]
}

const AGE_BANDS = [[5, 'Under 5'], [8, '5–7'], [12, '8–11'], [16, '12–15'], [18, '16–17'], [Infinity, '18+']]
const AGE_GROUPS = [...AGE_BANDS.map(([, label]) => label), 'Unspecified']
const CLASS_GENDERS = ['Female', 'Male', 'Other / unspecified']
const classAgeGroup = age => age == null ? 'Unspecified' : AGE_BANDS.find(([limit]) => age < limit)[1]
const emptyClassLoad = () => ({ students: 0, classEnrollments: 0, distribution: { one: 0, two: 0, threePlus: 0 } })
const withClassAverage = counts => ({ ...counts, averageClasses: counts.students ? counts.classEnrollments / counts.students : null })

function addClassLoad(counts, classEnrollments) {
  counts.students++
  counts.classEnrollments += classEnrollments
  const bucket = classEnrollments === 1 ? 'one' : classEnrollments === 2 ? 'two' : 'threePlus'
  counts.distribution[bucket]++
}

function addClassCohort(cohorts, ageGroup, gender, classEnrollments) {
  const key = `${ageGroup}:${gender}`
  if (!cohorts.has(key)) cohorts.set(key, { ageGroup, gender, ...emptyClassLoad() })
  addClassLoad(cohorts.get(key), classEnrollments)
}

function classCohorts(classTypeId, cohorts) {
  return [...cohorts.values()]
    .sort((a, b) => AGE_GROUPS.indexOf(a.ageGroup) - AGE_GROUPS.indexOf(b.ageGroup) || CLASS_GENDERS.indexOf(a.gender) - CLASS_GENDERS.indexOf(b.gender))
    .map(cohort => ({ classTypeId, ...withClassAverage(cohort) }))
}

export function summarizeCurrent(enrollments, classes, today, subscriptions = null) {
  const students = new Map(), families = new Set(), classCounts = new Map()
  const classTypeBySection = new Map(), classTypeLabels = new Map()
  for (const item of classes) classCounts.set(String(item.id), { id: String(item.id), name: item.name, students: new Set(), families: new Set() })
  for (const row of enrollments) {
    if (row.member_id == null) continue
    const memberId = String(row.member_id)
    families.add(String(row.family_id))
    const key = String(row.class_id ?? `form-${row.form_id}`)
    const klass = classCounts.get(key) ?? { id: key, name: row.class_name || 'Unnamed class', students: new Set(), families: new Set() }
    klass.students.add(memberId)
    klass.families.add(String(row.family_id))
    classCounts.set(key, klass)
    const teamName = [row.class_name, row.program_name].filter(Boolean).join(' ')
    const isTeam = /\bteam\b/i.test(teamName.replace(/\bnon[ -]?team\b/gi, ''))
    const student = students.get(memberId) ?? { ...row, team: false, classified: false, sectionIds: new Set() }
    student.team ||= isTeam
    student.classified ||= Boolean(teamName)
    // A student can sign up for multiple scheduled sections of the same class.
    const sectionId = row.slot_group_id != null ? `group-${row.slot_group_id}` : row.time_slot_id != null ? `slot-${row.time_slot_id}`
      : row.class_id != null || row.form_id != null ? key : null
    if (sectionId != null) {
      student.sectionIds.add(sectionId)
      if (row.program_id != null) {
        const typeId = String(row.program_id)
        classTypeBySection.set(sectionId, typeId)
        classTypeLabels.set(typeId, row.program_name?.trim() || 'Unnamed class type')
      }
    }
    students.set(memberId, student)
  }
  const gender = { Boys: 0, Girls: 0, 'Other / unspecified': 0 }
  const ageCounts = new Map()
  const teams = { Team: 0, 'Non-team': 0, Unspecified: 0 }
  const familyGroups = { genders: new Map(), ages: new Map(), teams: new Map() }
  const overallClassLoad = emptyClassLoad(), overallCohorts = new Map(), classTypes = new Map()
  function countFamily(groups, label, familyId) {
    const matches = groups.get(label) ?? new Set()
    matches.add(String(familyId))
    groups.set(label, matches)
  }
  for (const student of students.values()) {
    const value = String(student.gender ?? '').trim().toLowerCase()
    const genderLabel = /^(m|male|boy)$/.test(value) ? 'Boys' : /^(f|female|girl)$/.test(value) ? 'Girls' : 'Other / unspecified'
    gender[genderLabel]++
    countFamily(familyGroups.genders, genderLabel, student.family_id)
    const birth = String(student.date_of_birth ?? '').slice(0, 10)
    const validBirth = /^\d{4}-\d{2}-\d{2}$/.test(birth) && Number.isFinite(Date.parse(`${birth}T12:00:00Z`))
      && new Date(`${birth}T12:00:00Z`).toISOString().slice(0, 10) === birth && birth <= today
    const age = validBirth ? Number(today.slice(0, 4)) - Number(birth.slice(0, 4)) - (today.slice(5) < birth.slice(5) ? 1 : 0) : null
    const currentAge = age == null || age > 120 ? null : age
    const label = currentAge == null ? 'Unspecified' : String(currentAge)
    ageCounts.set(label, (ageCounts.get(label) ?? 0) + 1)
    const teamLabel = student.team ? 'Team' : student.classified ? 'Non-team' : 'Unspecified'
    teams[teamLabel]++
    countFamily(familyGroups.ages, label, student.family_id)
    countFamily(familyGroups.teams, teamLabel, student.family_id)
    if (student.sectionIds.size) {
      const ageGroup = classAgeGroup(currentAge)
      const classGender = genderLabel === 'Boys' ? 'Male' : genderLabel === 'Girls' ? 'Female' : genderLabel
      addClassLoad(overallClassLoad, student.sectionIds.size)
      addClassCohort(overallCohorts, ageGroup, classGender, student.sectionIds.size)
      const countsByType = new Map()
      for (const sectionId of student.sectionIds) {
        const typeId = classTypeBySection.get(sectionId) ?? 'unspecified'
        countsByType.set(typeId, (countsByType.get(typeId) ?? 0) + 1)
      }
      for (const [id, count] of countsByType) {
        if (!classTypes.has(id)) classTypes.set(id, { id, label: classTypeLabels.get(id) ?? 'Unspecified class type', counts: emptyClassLoad(), cohorts: new Map() })
        const type = classTypes.get(id)
        addClassLoad(type.counts, count)
        addClassCohort(type.cohorts, ageGroup, classGender, count)
      }
    }
  }
  const sortedTypes = [...classTypes.values()].sort((a, b) => (a.id === 'unspecified') - (b.id === 'unspecified') || a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
  const classLoad = {
    overall: withClassAverage(overallClassLoad),
    classTypes: sortedTypes.map(({ id, label, counts }) => ({ id, label, ...withClassAverage(counts) })),
    cohorts: [...classCohorts(null, overallCohorts), ...sortedTypes.flatMap(type => classCohorts(type.id, type.cohorts))],
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
  const classBreakdown = population => [...classCounts.values()]
    .map(row => ({ id: row.id, name: row.name, count: row[population].size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  const ageBreakdown = values => [...values]
    .sort(([a], [b]) => a === 'Unspecified' ? 1 : b === 'Unspecified' ? -1 : Number(a) - Number(b))
    .map(([label, count]) => ({ label: label === 'Unspecified' ? label : `Age ${label}`, count }))
  const familyBreakdown = (groups, labels) => labels.map(label => ({ label, count: groups.get(label)?.size ?? 0 }))
  return { families: families.size, students: count, studentsPerFamily: families.size ? count / families.size : null,
    classes: classBreakdown('students'), genders: breakdown(gender), teams: breakdown(teams), ages: ageBreakdown(ageCounts),
    familyBreakdowns: {
      classes: classBreakdown('families'),
      genders: familyBreakdown(familyGroups.genders, Object.keys(gender)),
      ages: ageBreakdown([...familyGroups.ages].map(([label, matches]) => [label, matches.size])),
      teams: familyBreakdown(familyGroups.teams, Object.keys(teams)),
    },
    membership, classLoad }
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
