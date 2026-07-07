const FAMILY_RULES = [
  { key: 'pogo', pattern: /pogo|ankle bounce|line bounce/i },
  { key: 'bound', pattern: /bound|scissor jump|split jump/i },
  { key: 'broad_jump', pattern: /broad jump|long jump/i },
  { key: 'hurdle_hop', pattern: /hurdle hop|hurdle jump/i },
  { key: 'med_ball_throw', pattern: /med(?:icine)? ball.*(?:throw|toss|slam)|rotational.*throw|scoop toss/i },
  { key: 'box_jump', pattern: /box jump|burpee.*box/i },
]

export function normalizeSlugStem(slug) {
  return String(slug ?? '')
    .toLowerCase()
    .replace(/-(progression|regression|beginner|advanced|v\d+)$/i, '')
    .trim()
}

export function movementFamilyKey(exercise) {
  if (exercise.movement_family) {
    const family = String(exercise.movement_family).toLowerCase()
    if (family.includes('pogo')) return 'pogo'
    if (family.includes('bound')) return 'bound'
    if (family.includes('jump')) return 'broad_jump'
  }

  const slug = String(exercise.slug ?? '')
  const name = String(exercise.name ?? '')
  for (const rule of FAMILY_RULES) {
    if (rule.pattern.test(slug) || rule.pattern.test(name)) return rule.key
  }
  return null
}

export function movementFamilyLimit(phaseKey) {
  if (phaseKey === 'output') return 2
  if (phaseKey === 'prepare_and_access' || phaseKey === 'restore') return 1
  return null
}

export function movementFamilyBlocked(familyKey, phaseKey, familyCounts, sessionFamilyCounts) {
  if (!familyKey) return false

  const phaseLimit = movementFamilyLimit(phaseKey)
  if (phaseLimit != null) {
    const phaseCount = familyCounts.get(phaseKey)?.get(familyKey) ?? 0
    if (phaseCount >= phaseLimit) return true
  }

  if (phaseKey === 'prepare_and_access' || phaseKey === 'restore') {
    const sessionCount = sessionFamilyCounts.get(familyKey) ?? 0
    if (sessionCount >= 1) return true
  }

  return false
}

export function recordMovementFamily(familyKey, phaseKey, familyCounts, sessionFamilyCounts) {
  if (!familyKey) return
  const phaseMap = familyCounts.get(phaseKey) ?? new Map()
  phaseMap.set(familyKey, (phaseMap.get(familyKey) ?? 0) + 1)
  familyCounts.set(phaseKey, phaseMap)
  sessionFamilyCounts.set(familyKey, (sessionFamilyCounts.get(familyKey) ?? 0) + 1)
}
