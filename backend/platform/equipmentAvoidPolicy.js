/** Equipment avoid expansion, semantic inference, and audit helpers. */

export const EQUIPMENT_AVOID_ALIASES = {
  bar: ['pull_up_bar', 'barbell', 'squat_rack', 'rings'],
  box: ['bench_or_box', 'low_step', 'plyo_box'],
}

const BOX_RELATED_AVOID_KEYS = new Set([
  'box',
  ...(EQUIPMENT_AVOID_ALIASES.box ?? []),
  'bench_or_box',
  'plyo_box',
  'low_step',
])

/** Breathing / restore cards whose slug contains "box" but are not plyo-box work. */
export function isBoxSemanticWhitelist(exercise) {
  const text = `${exercise.slug ?? ''} ${exercise.name ?? ''}`.toLowerCase()
  return /box[- ]?breath|breathing[- ]?hold|breath.*hold/.test(text)
}

function avoidKeysForSemanticScan(exercise, avoidKeys) {
  if (!isBoxSemanticWhitelist(exercise)) return avoidKeys
  return avoidKeys.filter((key) => !BOX_RELATED_AVOID_KEYS.has(key))
}

const SEMANTIC_AVOID_PATTERNS = {
  bar: /\b(bar|barbell|pull[- ]?up|chin[- ]?up|hang|muscle[- ]?up|dip)\b/i,
  box: /\b(box|plyo|platform|step[- ]?up|drop[- ]?landing|step[- ]?down)\b/i,
  pull_up_bar: /\b(pull[- ]?up|chin[- ]?up|hang|muscle[- ]?up)\b/i,
  barbell: /\b(barbell|squat|deadlift|bench press|overhead press|clean|snatch)\b/i,
  bench_or_box: /\b(box|bench|step)\b/i,
}

function parseJson(val) {
  if (val == null) return {}
  if (typeof val === 'object') return val
  try {
    return JSON.parse(val)
  } catch {
    return {}
  }
}

export async function expandEquipmentAvoidIds(pool, avoidIds) {
  if (!avoidIds?.length) return { expandedIds: new Set(), keyById: new Map() }

  const rows = await pool.query(
    `SELECT id, key, name FROM coaching.equipment WHERE id = ANY($1::bigint[])`,
    [avoidIds],
  )

  const expandedIds = new Set(avoidIds.map(Number))
  const keyById = new Map()
  const avoidKeys = new Set()

  for (const row of rows.rows) {
    keyById.set(Number(row.id), row.key)
    avoidKeys.add(row.key)
    for (const alias of EQUIPMENT_AVOID_ALIASES[row.key] ?? []) {
      avoidKeys.add(alias)
    }
  }

  if (avoidKeys.size > 0) {
    const aliasRows = await pool.query(
      `SELECT id, key FROM coaching.equipment WHERE key = ANY($1::text[])`,
      [[...avoidKeys]],
    )
    for (const row of aliasRows.rows) {
      expandedIds.add(Number(row.id))
      keyById.set(Number(row.id), row.key)
    }
  }

  return { expandedIds, keyById, avoidKeys: [...avoidKeys] }
}

export function exerciseTextBlob(exercise) {
  const req = parseJson(exercise.movement_requirements)
  const setup = Array.isArray(req.setup_requirements) ? req.setup_requirements.join(' ') : ''
  return `${exercise.slug ?? ''} ${exercise.name ?? ''} ${setup}`.toLowerCase()
}

export function inferAvoidedEquipmentKeys(exercise, avoidKeys) {
  if (!avoidKeys?.length) return []
  const keysToScan = avoidKeysForSemanticScan(exercise, avoidKeys)
  if (keysToScan.length === 0) return []
  const text = exerciseTextBlob(exercise)
  const matched = new Set()
  for (const key of keysToScan) {
    const pattern = SEMANTIC_AVOID_PATTERNS[key]
    if (pattern?.test(text)) matched.add(key)
    for (const alias of EQUIPMENT_AVOID_ALIASES[key] ?? []) {
      const aliasPattern = SEMANTIC_AVOID_PATTERNS[alias]
      if (aliasPattern?.test(text)) matched.add(key)
    }
  }
  return [...matched]
}

export function exerciseViolatesEquipmentAvoid(exercise, equipTags, expandedAvoidIds, avoidKeys) {
  const onlyBoxRelatedAvoid = isBoxSemanticWhitelist(exercise)
    && avoidKeysForSemanticScan(exercise, avoidKeys ?? []).length === 0

  if (!onlyBoxRelatedAvoid && expandedAvoidIds.size > 0 && equipTags.some((t) => expandedAvoidIds.has(t.facetId))) {
    return true
  }
  if (avoidKeys?.length > 0) {
    const inferred = inferAvoidedEquipmentKeys(exercise, avoidKeys)
    if (inferred.length > 0) return true
  }
  return false
}

export function auditPrescriptionEquipmentAvoid(resultBlocks, tagMap, expandedAvoidIds, avoidKeys, idToExercise = new Map()) {
  const violations = []
  for (const block of resultBlocks) {
    for (const item of block.items ?? []) {
      const ids = [item.exercise_id, ...(item.per_split ?? item.split_alternates_json ?? []).map((s) => s.exercise_id)].filter(Boolean)
      for (const eid of ids) {
        const tags = tagMap.get(String(eid)) ?? []
        const equipTags = tags.filter((t) => t.facetType === 'equipment')
        const exercise = idToExercise.get(Number(eid)) ?? { id: eid, name: item.exercise_name, slug: '' }
        if (exerciseViolatesEquipmentAvoid(exercise, equipTags, expandedAvoidIds, avoidKeys)) {
          violations.push({
            exercise_id: Number(eid),
            exercise_name: exercise.name ?? item.exercise_name,
            phase_key: block.phase_key,
            block_label: block.label,
          })
        }
      }
    }
  }
  return violations
}

export function equipmentTagMismatchWarning(exercise, equipTagKeys) {
  const text = exerciseTextBlob(exercise)
  const warnings = []
  const hasBarHint = SEMANTIC_AVOID_PATTERNS.bar.test(text) || SEMANTIC_AVOID_PATTERNS.pull_up_bar.test(text)
  const hasBoxHint = SEMANTIC_AVOID_PATTERNS.box.test(text)
  const keys = new Set(equipTagKeys ?? [])
  if (hasBarHint && !keys.has('bar') && !keys.has('pull_up_bar') && !keys.has('barbell') && keys.has('none')) {
    warnings.push('Name/slug suggests bar work but equipment is tagged None only.')
  }
  if (hasBoxHint && !keys.has('box') && !keys.has('bench_or_box') && !keys.has('low_step') && keys.has('none')) {
    warnings.push('Name/slug suggests box/platform work but equipment is tagged None only.')
  }
  return warnings
}
