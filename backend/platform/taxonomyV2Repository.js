import { assertIndependentReviewer } from './canonicalCardAuthoring.js'

const REQUIRED_FACETS_SQL = `
  VALUES
    ('definition', 'training_family'),
    ('definition', 'movement_character'),
    ('variant', 'movement_character'),
    ('variant', 'force_velocity'),
    ('delivery_profile', 'tenet'),
    ('delivery_profile', 'methodology'),
    ('delivery_profile', 'athletic_niche'),
    ('delivery_profile', 'programming_set_structure'),
    ('delivery_profile', 'programming_clock_structure'),
    ('delivery_profile', 'conditioning_protocol'),
    ('delivery_profile', 'physiology_mechanism')
`

export async function loadTaxonomyV2Catalog(pool) {
  const [terms, aliases] = await Promise.all([
    pool.query(
      `SELECT id, facet_type, key, name, domain, description, allowed_scopes,
              status, sort_order, metadata_json
       FROM coaching.taxonomy_term_v2
       ORDER BY facet_type, sort_order, key`,
    ),
    pool.query(
      `SELECT alias.facet_type, alias.alias_key, alias.is_ambiguous,
              alias.source, alias.notes, term.key AS term_key
       FROM coaching.taxonomy_alias_v2 alias
       JOIN coaching.taxonomy_term_v2 term ON term.id = alias.term_id
       ORDER BY alias.facet_type, alias.alias_key, term.key`,
    ),
  ])
  const facets = {}
  for (const row of terms.rows) {
    if (!facets[row.facet_type]) facets[row.facet_type] = []
    facets[row.facet_type].push({
      id: Number(row.id),
      key: row.key,
      name: row.name,
      domain: row.domain,
      description: row.description,
      scopes: row.allowed_scopes,
      status: row.status,
      sortOrder: Number(row.sort_order),
      metadata: row.metadata_json ?? {},
    })
  }
  return {
    version: '2.0.0',
    facets,
    aliases: aliases.rows.map((row) => ({
      facetType: row.facet_type,
      aliasKey: row.alias_key,
      termKey: row.term_key,
      ambiguous: row.is_ambiguous,
      source: row.source,
      notes: row.notes,
    })),
  }
}

export async function loadTaxonomyV2GovernanceReport(pool, facilityId) {
  const [coverage, assignmentStatus, decisionStatus, mappings, equipmentAliases, structuredProfileStatus] = await Promise.all([
    pool.query(
      `WITH required(subject_scope, facet_type) AS (${REQUIRED_FACETS_SQL}),
       subjects AS (
         SELECT 'definition'::text AS subject_scope, d.id AS subject_id,
                d.canonical_name AS subject_name
         FROM coaching.exercise_definition_v1 d
         WHERE d.facility_id = $1 AND d.status != 'archived'
         UNION ALL
         SELECT 'variant', v.id, d.canonical_name || ' / ' || v.display_name
         FROM coaching.exercise_variant_v1 v
         JOIN coaching.exercise_definition_v1 d ON d.id = v.definition_id
         WHERE d.facility_id = $1 AND d.status != 'archived' AND v.status != 'archived'
         UNION ALL
         SELECT 'delivery_profile', p.id,
                d.canonical_name || ' / ' || v.display_name || ' / ' || p.profile_key
         FROM coaching.exercise_delivery_profile_v1 p
         JOIN coaching.exercise_variant_v1 v ON v.id = p.variant_id
         JOIN coaching.exercise_definition_v1 d ON d.id = v.definition_id
         WHERE d.facility_id = $1 AND d.status != 'archived'
           AND v.status != 'archived' AND p.status != 'archived'
       ),
       evidence AS (
         SELECT s.subject_scope, s.subject_id, r.facet_type,
                EXISTS (
                  SELECT 1
                  FROM coaching.exercise_taxonomy_assignment_v2 a
                  JOIN coaching.taxonomy_term_v2 t ON t.id = a.term_id
                  WHERE t.facet_type = r.facet_type
                    AND ((s.subject_scope = 'definition' AND a.definition_id = s.subject_id)
                      OR (s.subject_scope = 'variant' AND a.variant_id = s.subject_id)
                      OR (s.subject_scope = 'delivery_profile' AND a.delivery_profile_id = s.subject_id))
                    AND a.review_status != 'rejected'
                ) OR EXISTS (
                  SELECT 1 FROM coaching.exercise_taxonomy_decision_v2 decision
                  WHERE decision.subject_scope = s.subject_scope
                    AND decision.facet_type = r.facet_type
                    AND decision.decision = 'not_applicable'
                    AND decision.review_status != 'rejected'
                    AND ((s.subject_scope = 'definition' AND decision.definition_id = s.subject_id)
                      OR (s.subject_scope = 'variant' AND decision.variant_id = s.subject_id)
                      OR (s.subject_scope = 'delivery_profile' AND decision.delivery_profile_id = s.subject_id))
                ) AS has_evidence,
                EXISTS (
                  SELECT 1
                  FROM coaching.exercise_taxonomy_assignment_v2 a
                  JOIN coaching.taxonomy_term_v2 t ON t.id = a.term_id
                  WHERE t.facet_type = r.facet_type AND a.review_status = 'approved'
                    AND a.reviewed_by IS NOT NULL
                    AND EXISTS (
                      SELECT 1
                      FROM coaching.exercise_taxonomy_review_v2 review_evidence
                      WHERE review_evidence.record_type='assignment'
                        AND review_evidence.record_id=a.id
                        AND review_evidence.outcome='approved'
                        AND review_evidence.reviewer_user_id=a.reviewed_by
                        AND length(btrim(review_evidence.notes)) >= 20
                    )
                    AND ((s.subject_scope = 'definition' AND a.definition_id = s.subject_id)
                      OR (s.subject_scope = 'variant' AND a.variant_id = s.subject_id)
                      OR (s.subject_scope = 'delivery_profile' AND a.delivery_profile_id = s.subject_id))
                ) OR EXISTS (
                  SELECT 1 FROM coaching.exercise_taxonomy_decision_v2 decision
                  WHERE decision.subject_scope = s.subject_scope
                    AND decision.facet_type = r.facet_type
                    AND decision.review_status = 'approved'
                    AND decision.reviewed_by IS NOT NULL
                    AND EXISTS (
                      SELECT 1
                      FROM coaching.exercise_taxonomy_review_v2 review_evidence
                      WHERE review_evidence.record_type='decision'
                        AND review_evidence.record_id=decision.id
                        AND review_evidence.outcome='approved'
                        AND review_evidence.reviewer_user_id=decision.reviewed_by
                        AND length(btrim(review_evidence.notes)) >= 20
                    )
                    AND ((s.subject_scope = 'definition' AND decision.definition_id = s.subject_id)
                      OR (s.subject_scope = 'variant' AND decision.variant_id = s.subject_id)
                      OR (s.subject_scope = 'delivery_profile' AND decision.delivery_profile_id = s.subject_id))
                ) AS approved
         FROM subjects s
         JOIN required r ON r.subject_scope = s.subject_scope
       )
       SELECT subject_scope, facet_type, count(*)::int AS subject_count,
              count(*) FILTER (WHERE has_evidence)::int AS evidence_count,
              count(*) FILTER (WHERE approved)::int AS approved_count,
              count(*) FILTER (WHERE NOT has_evidence)::int AS missing_count
       FROM evidence
       GROUP BY subject_scope, facet_type
       ORDER BY subject_scope, facet_type`,
      [facilityId],
    ),
    pool.query(
      `SELECT a.review_status, count(*)::int AS count
       FROM coaching.exercise_taxonomy_assignment_v2 a
       LEFT JOIN coaching.exercise_variant_v1 v ON v.id = a.variant_id
       LEFT JOIN coaching.exercise_delivery_profile_v1 p ON p.id = a.delivery_profile_id
       LEFT JOIN coaching.exercise_variant_v1 pv ON pv.id = p.variant_id
       JOIN coaching.exercise_definition_v1 d
         ON d.id = COALESCE(a.definition_id, v.definition_id, pv.definition_id)
       WHERE d.facility_id = $1
       GROUP BY a.review_status ORDER BY a.review_status`,
      [facilityId],
    ),
    pool.query(
      `SELECT decision.review_status, count(*)::int AS count
       FROM coaching.exercise_taxonomy_decision_v2 decision
       LEFT JOIN coaching.exercise_variant_v1 v ON v.id = decision.variant_id
       LEFT JOIN coaching.exercise_delivery_profile_v1 p ON p.id = decision.delivery_profile_id
       LEFT JOIN coaching.exercise_variant_v1 pv ON pv.id = p.variant_id
       JOIN coaching.exercise_definition_v1 d
         ON d.id = COALESCE(decision.definition_id, v.definition_id, pv.definition_id)
       WHERE d.facility_id = $1
       GROUP BY decision.review_status ORDER BY decision.review_status`,
      [facilityId],
    ),
    pool.query(
      `SELECT mapping_state, count(*)::int AS count
       FROM coaching.taxonomy_legacy_mapping_v2
       GROUP BY mapping_state ORDER BY mapping_state`,
    ),
    pool.query(
      `SELECT resolution_state, count(*)::int AS count
       FROM coaching.equipment_alias_v2
       GROUP BY resolution_state ORDER BY resolution_state`,
    ),
    pool.query(
      `SELECT v.structured_profile_review_status AS review_status, count(*)::int AS count
       FROM coaching.exercise_variant_v1 v
       JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id
       WHERE d.facility_id=$1 AND d.status != 'archived' AND v.status != 'archived'
       GROUP BY v.structured_profile_review_status
       ORDER BY v.structured_profile_review_status`,
      [facilityId],
    ),
  ])
  const coverageRows = coverage.rows.map((row) => ({
    subjectScope: row.subject_scope,
    facetType: row.facet_type,
    subjectCount: Number(row.subject_count),
    evidenceCount: Number(row.evidence_count),
    approvedCount: Number(row.approved_count),
    missingCount: Number(row.missing_count),
  }))
  return {
    version: '2.0.0',
    releaseReady: coverageRows.every((row) => row.missingCount === 0 && row.approvedCount === row.subjectCount)
      && structuredProfileStatus.rows.every((row) => row.review_status === 'approved'),
    coverage: coverageRows,
    assignmentReviewStatus: assignmentStatus.rows,
    decisionReviewStatus: decisionStatus.rows,
    legacyMappings: mappings.rows,
    equipmentAliases: equipmentAliases.rows,
    structuredProfileReviewStatus: structuredProfileStatus.rows,
  }
}

export async function loadTaxonomyV2ReviewQueue(pool, facilityId, { limit = 100 } = {}) {
  const boundedLimit = Math.max(1, Math.min(250, Number(limit) || 100))
  const [assignments, decisions] = await Promise.all([
    pool.query(
      `SELECT a.id, a.subject_scope, a.assignment_role, a.weight, a.confidence,
              a.review_status, a.provenance_json, a.created_by,
              term.facet_type, term.key AS term_key, term.name AS term_name,
              definition.canonical_name,
              variant.display_name AS variant_name,
              profile.profile_key
       FROM coaching.exercise_taxonomy_assignment_v2 a
       JOIN coaching.taxonomy_term_v2 term ON term.id = a.term_id
       LEFT JOIN coaching.exercise_variant_v1 variant ON variant.id = a.variant_id
       LEFT JOIN coaching.exercise_delivery_profile_v1 profile ON profile.id = a.delivery_profile_id
       LEFT JOIN coaching.exercise_variant_v1 profile_variant ON profile_variant.id = profile.variant_id
       JOIN coaching.exercise_definition_v1 definition
         ON definition.id = COALESCE(a.definition_id, variant.definition_id, profile_variant.definition_id)
       WHERE definition.facility_id = $1 AND a.review_status IN ('suggested', 'review')
       ORDER BY a.confidence DESC, a.id
       LIMIT $2`,
      [facilityId, boundedLimit],
    ),
    pool.query(
      `SELECT decision.id, decision.subject_scope, decision.facet_type,
              decision.decision, decision.rationale, decision.confidence,
              decision.review_status, decision.provenance_json, decision.created_by,
              definition.canonical_name,
              variant.display_name AS variant_name,
              profile.profile_key
       FROM coaching.exercise_taxonomy_decision_v2 decision
       LEFT JOIN coaching.exercise_variant_v1 variant ON variant.id = decision.variant_id
       LEFT JOIN coaching.exercise_delivery_profile_v1 profile ON profile.id = decision.delivery_profile_id
       LEFT JOIN coaching.exercise_variant_v1 profile_variant ON profile_variant.id = profile.variant_id
       JOIN coaching.exercise_definition_v1 definition
         ON definition.id = COALESCE(decision.definition_id, variant.definition_id, profile_variant.definition_id)
       WHERE definition.facility_id = $1 AND decision.review_status IN ('suggested', 'review')
       ORDER BY decision.confidence DESC, decision.id
       LIMIT $2`,
      [facilityId, boundedLimit],
    ),
  ])
  const subjectName = (row) => [row.canonical_name, row.variant_name, row.profile_key].filter(Boolean).join(' / ')
  return [
    ...assignments.rows.map((row) => ({
      recordType: 'assignment', id: String(row.id), subjectScope: row.subject_scope,
      subjectName: subjectName(row), facetType: row.facet_type, termKey: row.term_key,
      termName: row.term_name, role: row.assignment_role, weight: Number(row.weight),
      confidence: Number(row.confidence), reviewStatus: row.review_status,
      provenance: row.provenance_json ?? {}, createdBy: row.created_by == null ? null : Number(row.created_by),
    })),
    ...decisions.rows.map((row) => ({
      recordType: 'decision', id: String(row.id), subjectScope: row.subject_scope,
      subjectName: subjectName(row), facetType: row.facet_type, decision: row.decision,
      rationale: row.rationale, confidence: Number(row.confidence), reviewStatus: row.review_status,
      provenance: row.provenance_json ?? {}, createdBy: row.created_by == null ? null : Number(row.created_by),
    })),
  ].sort((left, right) => right.confidence - left.confidence
    || left.subjectName.localeCompare(right.subjectName)
    || Number(left.id) - Number(right.id)).slice(0, boundedLimit)
}

async function loadReviewSubject(client, facilityId, recordType, recordId) {
  const table = recordType === 'assignment'
    ? 'coaching.exercise_taxonomy_assignment_v2'
    : 'coaching.exercise_taxonomy_decision_v2'
  const result = await client.query(
    `SELECT record.*
     FROM ${table} record
     LEFT JOIN coaching.exercise_variant_v1 variant ON variant.id = record.variant_id
     LEFT JOIN coaching.exercise_delivery_profile_v1 profile ON profile.id = record.delivery_profile_id
     LEFT JOIN coaching.exercise_variant_v1 profile_variant ON profile_variant.id = profile.variant_id
     JOIN coaching.exercise_definition_v1 definition
       ON definition.id = COALESCE(record.definition_id, variant.definition_id, profile_variant.definition_id)
     WHERE record.id = $1 AND definition.facility_id = $2
     FOR UPDATE OF record`,
    [recordId, facilityId],
  )
  return result.rows[0] ?? null
}

export async function reviewTaxonomyV2Record(
  pool,
  facilityId,
  reviewerUserId,
  recordType,
  recordId,
  body = {},
) {
  if (!['assignment', 'decision'].includes(recordType)) throw new TypeError('Unknown taxonomy review record type.')
  const outcome = body.outcome === 'approve' ? 'approved' : body.outcome === 'reject' ? 'rejected' : null
  const notes = String(body.notes || '').trim()
  if (!outcome || notes.length < 20) {
    throw new TypeError('Taxonomy review outcome and at least 20 characters of observed evidence are required.')
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const record = await loadReviewSubject(client, facilityId, recordType, recordId)
    if (!record) throw Object.assign(new Error('Taxonomy review record not found.'), { status: 404 })
    assertIndependentReviewer(record.created_by, reviewerUserId, 'taxonomy')
    await client.query(
      `INSERT INTO coaching.exercise_taxonomy_review_v2 (
         record_type, record_id, outcome, notes, reviewer_user_id, snapshot_json
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [recordType, recordId, outcome, notes, reviewerUserId, JSON.stringify(record)],
    )
    const table = recordType === 'assignment'
      ? 'coaching.exercise_taxonomy_assignment_v2'
      : 'coaching.exercise_taxonomy_decision_v2'
    const updated = await client.query(
      `UPDATE ${table}
       SET review_status=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now()
       WHERE id=$1 RETURNING *`,
      [recordId, outcome, reviewerUserId],
    )
    await client.query('COMMIT')
    return updated.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
