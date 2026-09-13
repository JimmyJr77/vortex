/**
 * Planning boundary for the Vortex AI Programming Staff.
 * This is not a completed-workout validator or a legacy phase conversion.
 * See docs/workout-generator/AI_PROGRAMMING_STAFF_PLAN.md.
 */
import { CANONICAL_WORKOUT_LEGACY_EQUIPMENT_KEYS } from './canonicalWorkoutContract.js'
import { resolveEquipmentV2Key } from './taxonomyV2.js'

export const SESSION_COMPONENT_SCHEMA_VERSION = '1.0.0'
export const SESSION_COMPONENT_ORDER = Object.freeze([
  'prepare_and_access',
  'explosiveness',
  'strength',
  'capacity_competition',
  'body_control',
])

export const SESSION_COMPONENT_LABELS = Object.freeze({
  prepare_and_access: 'Prepare & Access',
  explosiveness: 'Explosiveness',
  strength: 'Strength',
  capacity_competition: 'Capacity / Competition',
  body_control: 'Body Control / Tumbling',
})

function object(value, path, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${path} must be a plain object`)
  }
  if (allowedKeys) {
    const unknown = Object.keys(value).filter((key) => !allowedKeys.includes(key))
    if (unknown.length) throw new TypeError(`${path} contains unknown fields: ${unknown.join(', ')}`)
  }
  return value
}

function integer(value, path, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${path} must be an integer from ${min} to ${max}`)
  }
  return value
}

function equipmentKey(value, path) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${path} must be an equipment key`)
  const resolved = resolveEquipmentV2Key(value)
  const key = resolved.key ?? (
    CANONICAL_WORKOUT_LEGACY_EQUIPMENT_KEYS.includes(resolved.source) ? resolved.source : null
  )
  if (!key) throw new TypeError(`${path} contains ${resolved.status} equipment: ${value}`)
  return key
}

function equipmentList(value, path) {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array of equipment keys`)
  return [...new Set(value.map((entry, index) => equipmentKey(entry, `${path}[${index}]`)))]
}

function exclusions(value, path) {
  const keys = equipmentList(value, path)
  if (keys.includes('none')) {
    throw new RangeError(`${path} cannot exclude the no-equipment sentinel; use exercise exclusions for bodyweight exercises`)
  }
  return keys
}

function normalizeEquipment(raw) {
  object(raw, 'equipment', ['available', 'quantities', 'excluded'])
  // "none" is a taxonomy sentinel, not a physical resource needing inventory.
  const available = ['none', ...equipmentList(raw.available, 'equipment.available').filter((key) => key !== 'none')]
  const excluded = exclusions(raw.excluded === undefined ? [] : raw.excluded, 'equipment.excluded')
  const suppliedQuantities = raw.quantities === undefined ? {} : object(raw.quantities, 'equipment.quantities')
  const quantities = new Map()
  for (const [rawKey, value] of Object.entries(suppliedQuantities)) {
    const key = equipmentKey(rawKey, 'equipment.quantities')
    if (key === 'none') throw new RangeError('equipment.quantities cannot assign a quantity to no equipment')
    if (!available.includes(key)) throw new RangeError(`equipment.quantities refers to unavailable equipment: ${key}`)
    if (quantities.has(key)) throw new RangeError(`equipment.quantities contains duplicate aliases for ${key}`)
    quantities.set(key, value === null ? null : integer(value, `equipment.quantities.${key}`, 0, 1000))
  }
  return Object.freeze({
    available: Object.freeze(available),
    excluded: Object.freeze(excluded),
    quantities: Object.freeze(Object.fromEntries(available.filter((key) => key !== 'none').map((key) => [
      key, quantities.get(key) ?? null,
    ]))),
  })
}

function componentEquipment(raw, globalEquipment, path) {
  object(raw, path, ['allowed', 'preferred', 'excluded'])
  const globalUsable = globalEquipment.available.filter((key) => (
    !globalEquipment.excluded.includes(key) && globalEquipment.quantities[key] !== 0
  ))
  const restricted = raw.allowed !== undefined
  const allowed = restricted ? equipmentList(raw.allowed, `${path}.allowed`) : globalUsable
  for (const key of allowed) {
    if (!globalUsable.includes(key)) throw new RangeError(`${path}.allowed cannot select unavailable or excluded equipment: ${key}`)
  }
  const excluded = exclusions(raw.excluded === undefined ? [] : raw.excluded, `${path}.excluded`)
  // Explicit [] means no physical equipment; it must not inherit the facility.
  const effective = ['none', ...allowed.filter((key) => key !== 'none' && !excluded.includes(key))]
  const preferred = equipmentList(raw.preferred === undefined ? [] : raw.preferred, `${path}.preferred`)
  for (const key of preferred) {
    if (!effective.includes(key)) throw new RangeError(`${path}.preferred cannot select unavailable or excluded equipment: ${key}`)
  }
  return Object.freeze({
    scope: restricted ? 'restricted' : 'inherit',
    allowed: Object.freeze(effective),
    preferred: Object.freeze(preferred),
    excluded: Object.freeze(excluded),
    quantities: Object.freeze(Object.fromEntries(effective.filter((key) => key !== 'none').map((key) => [
      key, globalEquipment.quantities[key],
    ]))),
    unknownQuantityKeys: Object.freeze(effective.filter((key) => key !== 'none' && globalEquipment.quantities[key] === null)),
  })
}

/**
 * Validate allocated component controls against the total booked duration.
 * Missing components and reserveSeconds are planning work still to be resolved.
 * Unknown quantities are retained for the later resource scheduler to resolve.
 * @param {unknown} raw
 * @returns {import('./sessionComponentContract.js').SessionComponentPlan}
 */
export function normalizeSessionComponentPlan(raw) {
  object(raw, 'componentPlan', ['schemaVersion', 'durationMinutes', 'equipment', 'components'])
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== SESSION_COMPONENT_SCHEMA_VERSION) {
    throw new TypeError(`componentPlan.schemaVersion must be ${SESSION_COMPONENT_SCHEMA_VERSION}`)
  }
  const durationMinutes = integer(raw.durationMinutes, 'durationMinutes', 15, 240)
  const bookedSeconds = durationMinutes * 60
  const equipment = normalizeEquipment(raw.equipment)
  if (!Array.isArray(raw.components) || raw.components.length === 0 || raw.components.length > SESSION_COMPONENT_ORDER.length) {
    throw new TypeError('components must contain one to five component controls')
  }
  let priorIndex = -1
  let allocatedSeconds = 0
  const components = raw.components.map((component, index) => {
    const path = `components[${index}]`
    object(component, path, ['key', 'budgetSeconds', 'equipment'])
    const componentIndex = SESSION_COMPONENT_ORDER.indexOf(component.key)
    if (componentIndex < 0) throw new TypeError(`${path}.key is not a Vortex session component`)
    if (componentIndex <= priorIndex) throw new RangeError('components must be unique and follow Vortex session order')
    priorIndex = componentIndex
    const budgetSeconds = integer(component.budgetSeconds, `${path}.budgetSeconds`, 1, bookedSeconds)
    allocatedSeconds += budgetSeconds
    return Object.freeze({
      key: component.key,
      budgetSeconds,
      equipment: componentEquipment(component.equipment === undefined ? {} : component.equipment, equipment, `${path}.equipment`),
    })
  })
  if (allocatedSeconds > bookedSeconds) {
    throw new RangeError(`component budgets exceed booked duration by ${allocatedSeconds - bookedSeconds} seconds`)
  }
  return Object.freeze({
    schemaVersion: SESSION_COMPONENT_SCHEMA_VERSION,
    durationMinutes,
    bookedSeconds,
    allocatedSeconds,
    reserveSeconds: bookedSeconds - allocatedSeconds,
    equipment,
    components: Object.freeze(components),
  })
}
