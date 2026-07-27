import {
  buildCanonicalDuplicateIndex,
  findPotentialCanonicalDuplicatesFromIndex,
} from './canonicalCardAuthoring.js'

const RESOLVED_DECISIONS = new Set([
  'distinct_exercises',
  'duplicate_consolidated',
])

function positiveInteger(value, field, fallback) {
  if (value == null) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new TypeError(`${field} must be a positive integer`)
  }
  return parsed
}

function similarityThreshold(value) {
  const parsed = positiveInteger(value, 'threshold', 72)
  if (parsed > 100) throw new RangeError('threshold must be at most 100')
  return parsed
}

function identityPairKey(leftId, rightId) {
  return [String(leftId), String(rightId)].sort().join(':')
}

export async function buildCanonicalIdentityQueue(pool, {
  facilityId,
  threshold = 72,
  limit = 50,
} = {}) {
  const normalizedFacilityId = positiveInteger(facilityId, 'facilityId')
  const normalizedThreshold = similarityThreshold(threshold)
  const normalizedLimit = positiveInteger(limit, 'limit', 50)

  const [definitionsResult, resolutionsResult] = await Promise.all([
    pool.query(
      `SELECT
         id, slug, canonical_name, display_name, aliases, family_key
       FROM coaching.exercise_definition_v1
       WHERE facility_id=$1 AND status!='archived'
       ORDER BY slug`,
      [normalizedFacilityId],
    ),
    pool.query(
      `SELECT
         id, survivor_definition_id, resolved_definition_id, decision,
         resolution_source, reviewed_by, resolved_at
       FROM coaching.exercise_identity_resolution_v1
       WHERE facility_id=$1`,
      [normalizedFacilityId],
    ),
  ])

  const definitions = definitionsResult.rows
  const duplicateIndex = buildCanonicalDuplicateIndex(definitions)
  const resolutions = new Map(resolutionsResult.rows.map((resolution) => [
    identityPairKey(
      resolution.survivor_definition_id,
      resolution.resolved_definition_id,
    ),
    resolution,
  ]))
  const seenPairs = new Set()
  const unresolvedPairs = []

  for (const definition of definitions) {
    const matches = findPotentialCanonicalDuplicatesFromIndex(
      definition,
      duplicateIndex,
      normalizedThreshold,
    )
    for (const match of matches) {
      const pairKey = identityPairKey(definition.id, match.id)
      if (seenPairs.has(pairKey)) continue
      seenPairs.add(pairKey)
      const resolution = resolutions.get(pairKey) ?? null
      if (RESOLVED_DECISIONS.has(resolution?.decision)) continue
      unresolvedPairs.push({
        pairKey,
        score: match.score,
        exactCollision: match.exactCollision,
        left: {
          id: String(definition.id),
          slug: definition.slug,
          displayName: definition.display_name,
          familyKey: definition.family_key,
        },
        right: {
          id: String(match.id),
          slug: match.slug,
          displayName: match.displayName,
          familyKey: match.familyKey,
        },
        priorDecision: resolution?.decision ?? null,
        resolutionSource: resolution?.resolution_source ?? null,
        reviewedBy: resolution?.reviewed_by == null
          ? null
          : String(resolution.reviewed_by),
        resolvedAt: resolution?.resolved_at ?? null,
      })
    }
  }

  unresolvedPairs.sort((left, right) => (
    right.score - left.score
    || left.left.displayName.localeCompare(right.left.displayName)
    || left.right.displayName.localeCompare(right.right.displayName)
  ))

  return {
    generatedAt: new Date().toISOString(),
    facilityId: normalizedFacilityId,
    threshold: normalizedThreshold,
    activeDefinitions: definitions.length,
    unresolvedPairCount: unresolvedPairs.length,
    exactCollisionCount: unresolvedPairs.filter((pair) => pair.exactCollision).length,
    scoreCounts: Object.fromEntries(
      [72, 75, 80, 85, 90, 95, 100]
        .filter((score) => score >= normalizedThreshold)
        .map((score) => [
          String(score),
          unresolvedPairs.filter((pair) => pair.score >= score).length,
        ]),
    ),
    pairs: unresolvedPairs.slice(0, normalizedLimit),
  }
}
