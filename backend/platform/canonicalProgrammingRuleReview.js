import { programmingValueHash } from './workoutProgrammingRequest.js'
import { parseCanonicalProgrammingExecutionRules } from './canonicalProgrammingRulesContract.js'
import { libraryScopeId } from './coachingLibraryContext.js'

/** Called only while recording the existing independent card-version review. Caller-supplied stamps are overwritten. */
export function canonicalProgrammingReviewRubric(card, input = {}) {
  if ((!input || typeof input !== 'object' || Array.isArray(input)) && !card.variants.some((variant) => variant.programming?.executionRules != null)) return input
  const rubric = input && typeof input === 'object' && !Array.isArray(input) ? structuredClone(input) : {}
  delete rubric.programmingExecutionRules
  const byVariant = {}
  for (const variant of card.variants) if (variant.programming?.executionRules != null) {
    parseCanonicalProgrammingExecutionRules(variant.programming)
    if (!variant.id) throw new TypeError('Programming-rule review requires a persisted exact variant')
    byVariant[variant.id] = programmingValueHash(variant.programming)
  }
  if (Object.keys(byVariant).length) rubric.programmingExecutionRules = { schemaVersion: '1.0.0', byVariant }
  return rubric
}

/** Uses existing review rows; never creates an approval or trusts a client-supplied review flag. */
export async function loadCanonicalProgrammingRuleReviews(client, facilityId, cards) {
  const requested = cards.filter((card) => card.programming?.executionRules != null).map((card) => ({ definitionId: card.id, variantId: card.variantId, cardVersion: card.cardVersion }))
  if (!requested.length) return new Map()
  const result = await client.query(`/* canonical_programming_rule_reviews */
    SELECT DISTINCT ON (v.id) v.id::text AS variant_id, r.id::text AS review_id, r.reviewed_card_version,
      r.reviewer_user_id::text AS reviewer_user_id,
      CASE WHEN r.decision = 'approve' AND length(btrim(r.notes)) >= 20
        AND r.rubric_json->'programmingExecutionRules'->>'schemaVersion' = '1.0.0'
      THEN r.rubric_json->'programmingExecutionRules'->'byVariant'->>v.id::text ELSE NULL END AS source_hash
    FROM jsonb_to_recordset($2::jsonb) AS requested("definitionId" uuid, "variantId" uuid, "cardVersion" integer)
    JOIN coaching.exercise_definition_v1 d ON d.id = requested."definitionId"
    JOIN coaching.exercise_variant_v1 v ON v.id = requested."variantId" AND v.definition_id = d.id
    JOIN coaching.exercise_card_review_v1 r ON r.definition_id = d.id AND r.reviewed_card_version = d.card_version
      AND r.reviewer_user_id = d.approved_by
    WHERE d.facility_id = $1 AND d.card_version = requested."cardVersion" AND d.status = 'published' AND v.status = 'published'
    ORDER BY v.id, r.id DESC`, [libraryScopeId(facilityId, 'facilityId'), JSON.stringify(requested)])
  return new Map(result.rows.map((row) => [String(row.variant_id), { reviewId: String(row.review_id), reviewedCardVersion: Number(row.reviewed_card_version),
    reviewerUserId: String(row.reviewer_user_id), sourceHash: row.source_hash }]))
}
