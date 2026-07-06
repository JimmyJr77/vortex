const PREPARE_ACCESS = 'prepare_access'

let slotMapCache = null
let slotMapCacheAt = 0
const CACHE_MS = 60_000

/**
 * Load order_slot key → subrole_key map for a session phase.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} phaseKey
 * @returns {Promise<Map<string, string>>}
 */
export async function loadSubroleMapForPhase(db, phaseKey = PREPARE_ACCESS) {
  const now = Date.now()
  if (phaseKey === PREPARE_ACCESS && slotMapCache && now - slotMapCacheAt < CACHE_MS) {
    return slotMapCache
  }
  const result = await db.query(
    `
      SELECT pos.key AS order_slot_key, pos.subrole_key
      FROM coaching.phase_order_slot pos
      JOIN coaching.session_phase sp ON sp.id = pos.phase_id
      WHERE sp.key = $1 AND pos.subrole_key IS NOT NULL
    `,
    [phaseKey],
  )
  const map = new Map()
  for (const row of result.rows) {
    if (row.order_slot_key && row.subrole_key) {
      map.set(row.order_slot_key, row.subrole_key)
    }
  }
  if (phaseKey === PREPARE_ACCESS) {
    slotMapCache = map
    slotMapCacheAt = now
  }
  return map
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {string} phaseKey
 * @param {string|null|undefined} orderSlotKey
 * @returns {Promise<string|null>}
 */
export async function resolveSubroleFromOrderSlot(db, phaseKey, orderSlotKey) {
  if (!orderSlotKey || !phaseKey) return null
  const map = await loadSubroleMapForPhase(db, phaseKey)
  return map.get(orderSlotKey) ?? null
}

/**
 * Derive phase_subrole for an exercise from primary phase profile order_slot.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {object|null} primaryProfile
 * @param {boolean} subroleOverride
 * @param {string|null|undefined} explicitSubrole
 * @returns {Promise<string|null>}
 */
export async function deriveExerciseSubrole(db, primaryProfile, subroleOverride, explicitSubrole) {
  if (subroleOverride && explicitSubrole) return explicitSubrole
  const phaseKey = primaryProfile?.phaseKey ?? primaryProfile?.phase_key
  const orderSlot = primaryProfile?.orderSlot ?? primaryProfile?.order_slot
  if (phaseKey !== PREPARE_ACCESS || !orderSlot) {
    return subroleOverride ? (explicitSubrole ?? null) : null
  }
  return resolveSubroleFromOrderSlot(db, phaseKey, orderSlot)
}

export { PREPARE_ACCESS }
