const EQUIPMENT_ALIASES = Object.freeze({
  kettlebell: ['kettle bell', 'kettle bells', 'kettlebells'],
  jump_rope: ['jump rope', 'jump ropes', 'skipping rope', 'skipping ropes'],
  dumbbell: ['dumb bell', 'dumb bells', 'dumbbells'],
  medicine_ball: ['medicine ball', 'medicine balls', 'med ball', 'med balls'],
})

export function normalizeEquipmentName(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function equipmentAliases(row) {
  const key = String(row?.key ?? '').toLowerCase()
  return [...new Set([
    row?.name,
    key,
    key.replaceAll('_', ' '),
    ...(EQUIPMENT_ALIASES[key] ?? []),
  ].map(normalizeEquipmentName).filter(Boolean))]
}

export function textMentionsEquipment(text, row) {
  const normalizedText = normalizeEquipmentName(text)
  return equipmentAliases(row).some((alias) => normalizedText.includes(alias))
}
