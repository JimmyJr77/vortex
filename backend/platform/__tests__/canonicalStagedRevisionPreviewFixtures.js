import { stagedSourceFixture } from './canonicalCardStagedRevisionFixtures.js'
import { TAXONOMY_V2_FACETS } from '../taxonomyV2.js'
import { stagedReviewEvidenceFixture } from './canonicalStagedReviewEvidenceFixtures.js'
import { uuid } from './workoutProgrammingLibrarianFixtures.js'

// Synthetic SQL rows for browser verification. Real services perform all staging,
// hashing, validation and transitions. PostgreSQL constraints are tested separately.
const jsonFields = new Set(['environment', 'population', 'athleteSupport', 'coachSupport', 'supportOperations', 'anatomy', 'provenance',
  'difficulty', 'movementGeometry', 'anatomyProfile', 'equipmentRoles', 'taskDemands', 'stressProfile', 'scalingHandles', 'compositionProfile',
  'requirements', 'loadProfile', 'fatigueProfile', 'objectiveRelevance', 'dosage', 'logistics', 'timeModel', 'doseScaling', 'measurement', 'supportPrompts'])
const row = (value) => Object.fromEntries(Object.entries(value).map(([key, item]) => [
  key === 'programming' ? 'programming_profile_json' : key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) + (jsonFields.has(key) ? '_json' : ''), item,
]))

export function stagedRevisionPreviewFixture(state) {
  let source = stagedSourceFixture(state)
  const events = new Map()
  const taxonomyRows = (kind) => [source, ...source.variants, ...source.variants.flatMap((variant) => variant.profiles)]
    .flatMap((subject) => (subject.taxonomyV2?.[kind] ?? []).map((record) => ({ ...row(record),
      [`${record.scope}_id`]: subject.id, subject_scope: record.scope, assignment_role: record.role,
      term_key: record.key, term_name: record.name ?? record.key, term_id: 1,
    }))).map((record, index) => ({ ...record, id: uuid(95000 + index) }))
  return { events, get source() { return source }, reset() { source = stagedSourceFixture(state); events.clear() },
    useCompleteSyntheticSource() {
      if (events.size) throw new Error('Configure the complete synthetic source before staging')
      const complete = stagedReviewEvidenceFixture().event.sourceCard
      complete.id = source.id; complete.slug = source.slug; complete.variants[0].id = source.variants[0].id
      complete.variants[0].variantKey = source.variants[0].variantKey
      complete.variants[0].profiles[0].id = source.variants[0].profiles[0].id
      complete.variants[0].profiles[0].profileKey = source.variants[0].profiles[0].profileKey
      source = complete
      for (const key of source.movementPatterns) state.taxonomy.movement_pattern.add(key)
      for (const key of source.bodyRegions) state.taxonomy.body_region.add(key)
      for (const key of [...source.requiredEquipment, ...source.optionalEquipment]) state.taxonomy.equipment.add(key)
    },
    connect() {
      const pending = new Map()
      return async (sql, params = []) => {
        if (sql.includes('/* staged_revision_taxonomy_terms */')) return { rows: JSON.parse(params[0]).filter((entry) =>
          TAXONOMY_V2_FACETS[entry.facet_type]?.some((term) => term.key === entry.key && term.scopes.includes(entry.subject_scope))) }
        if (sql.startsWith('SELECT * FROM coaching.exercise_card_revision_v1')) {
          const rows = [...events.values(), ...pending.values()].filter((event) => event.facility_id === params[0]
            && (sql.includes("'{origin,draftAuditId}'") ? event.snapshot_json.origin.draftAuditId === params[1] : event.staged_revision_id === params[1]))
            .sort((a, b) => b.revision_number - a.revision_number)
          return { rows: rows.slice(0, 1) }
        }
        if (sql.startsWith('INSERT INTO coaching.exercise_card_revision_v1') && sql.includes('staged_revision_id')) {
          const event = { id: params[0], definition_id: params[1], facility_id: params[2], action: params[3], from_status: params[4], to_status: params[5],
            snapshot_json: JSON.parse(params[6]), change_summary: params[7], actor_user_id: params[8], staged_revision_id: params[9], source_card_version: params[10],
            revision_number: events.size + pending.size + 1, created_at: new Date() }
          pending.set(event.id, event); return { rows: [event] }
        }
        if (sql.startsWith('SELECT * FROM coaching.exercise_definition_v1 WHERE id')) return { rows: params[0] === source.id && params[1] === '9' ? [row(source)] : [] }
        if (sql.startsWith('SELECT v.* FROM coaching.exercise_variant_v1 v')) return { rows: params[0] === source.id && params[1] === '9'
          ? source.variants.map((variant) => ({ ...row(variant), definition_id: source.id,
            structured_profile_review_status: variant.structuredProfileReview.reviewStatus,
            structured_profile_provenance_json: variant.structuredProfileReview.provenance,
            structured_profile_reviewed_by: variant.structuredProfileReview.reviewedBy,
            structured_profile_reviewed_at: variant.structuredProfileReview.reviewedAt,
          })) : [] }
        if (sql.startsWith('SELECT p.* FROM coaching.exercise_delivery_profile_v1 p')) return { rows: params[0] === source.id && params[1] === '9'
          ? source.variants.flatMap((variant) => variant.profiles.map((profile) => ({ ...row(profile), variant_id: variant.id }))) : [] }
        if (sql.startsWith('SELECT id, revision_number')) return { rows: [...events.values()].filter((event) => event.definition_id === params[0]) }
        if (sql.startsWith('SELECT assignment.*, term.facet_type')) return { rows: params[0] === source.id ? taxonomyRows('assignments') : [] }
        if (sql.startsWith('SELECT decision.*')) return { rows: params[0] === source.id ? taxonomyRows('decisions') : [] }
        if (sql.startsWith('SELECT url, exact_variant_match') || sql.startsWith('SELECT * FROM coaching.exercise_card_review_v1')
          || sql.startsWith('SELECT r.*, fv.display_name')) return { rows: [] }
        if (sql === 'COMMIT') { for (const [id, event] of pending) events.set(id, event); pending.clear() }
        if (sql === 'ROLLBACK') pending.clear()
        return null
      }
    },
  }
}
