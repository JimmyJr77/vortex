import assert from 'node:assert/strict'
import { compositionFixtures } from './workoutProgrammingBuilderFixtures.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'

export function exerciseGapResearchFixtures({ extra = [], patch = {} } = {}) {
  const state = compositionFixtures()
  const rows = state.options.cards.flatMap((card) => card.deliveryProfiles.map((profile) => ({
    definition_id: card.id, slug: card.slug, canonical_name: card.canonicalName, display_name: card.displayName, aliases: [],
    family_key: card.familyId, description: 'Synthetic canonical content for gap research.', card_version: card.cardVersion,
    definition_status: 'published', movement_patterns: card.movementPatterns, body_regions: card.bodyRegions,
    required_equipment: card.equipment.required, definition_updated_at: '2026-01-01T00:00:00Z',
    variant_id: card.variantId, variant_key: 'default', variant_name: card.displayName, variant_status: 'published',
    profile_id: profile.id, profile_key: 'default', phase_key: profile.phaseKey, role: profile.role,
    purpose: profile.purpose, profile_status: 'published', equipment_required: profile.equipmentRequired,
  }))).concat(extra).sort((a, b) => a.definition_id.localeCompare(b.definition_id))
  const base = state.pool(patch)
  const taxonomy = { movement_pattern: new Set(state.options.cards.flatMap((card) => card.movementPatterns)),
    body_region: new Set(state.options.cards.flatMap((card) => card.bodyRegions)), equipment: new Set(['none', 'bodyweight', 'barbell']) }
  const researchCalls = []
  const pool = { calls: base.calls, async connect() {
    const client = await base.connect()
    return { async query(sql, params = []) {
      researchCalls.push({ sql, params })
      if (sql.includes('canonical_exercise_gap_research')) {
        assert.equal(params[0], SCOPE.facilityId)
        return { rows: rows.slice(params[2], params[2] + params[1]) }
      }
      const table = /^SELECT key FROM coaching\.(movement_pattern|body_region|equipment)$/.exec(sql)?.[1]
      if (table) return { rows: [...taxonomy[table]].map((key) => ({ key })) }
      return client.query(sql, params)
    }, release: (error) => client.release(error) }
  } }
  const { assumptions, ...request } = state.request
  const need = { canonicalName: 'Synthetic new movement concept', description: 'Develop a missing movement stimulus with a reviewed coaching progression.',
    aliases: [], familyKey: null, movementPatterns: [...taxonomy.movement_pattern].slice(0, 1),
    bodyRegions: [...taxonomy.body_region].slice(0, 1), requiredEquipment: [] }
  return { pool, rows, taxonomy, request, need, researchCalls }
}
