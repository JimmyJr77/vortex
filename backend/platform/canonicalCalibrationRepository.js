const DIMENSIONS = new Set([
  'baseOverallDifficulty', 'technicalComplexity', 'supervisionDemand',
  'failureConsequence', 'impact', 'workCapacityDemand',
  'gripDemand', 'spinalLoading', 'eccentricStress',
  'localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity',
  'impactAccumulation',
])
const TIERS = new Set([20, 40, 60, 80])

function normalizeProposal(raw = {}) {
  const dimension = String(raw.dimension || '')
  const proposedScore = Number(raw.proposedScore)
  const anchorTier = Number(raw.anchorTier)
  const rationale = String(raw.rationale || '').trim()
  if (!DIMENSIONS.has(dimension)) throw new RangeError('Unknown calibration dimension.')
  if (!Number.isInteger(proposedScore) || proposedScore < 1 || proposedScore > 100) {
    throw new RangeError('Calibration score must be an integer from 1 to 100.')
  }
  if (!TIERS.has(anchorTier)) throw new RangeError('Anchor tier must be 20, 40, 60, or 80.')
  if (rationale.length < 20 || rationale.length > 2000) {
    throw new RangeError('Calibration rationale must contain 20 to 2000 characters.')
  }
  return { dimension, proposedScore, anchorTier, rationale }
}

export async function listCanonicalCalibrations(pool, facilityId, options = {}) {
  const params = [facilityId]
  const clauses = ['c.facility_id=$1']
  if (options.status) {
    params.push(options.status)
    clauses.push(`c.status=$${params.length}`)
  }
  if (options.dimension) {
    params.push(options.dimension)
    clauses.push(`c.dimension=$${params.length}`)
  }
  const result = await pool.query(
    `SELECT c.*, d.display_name AS exercise_name, v.display_name AS variant_name,
            d.card_version, creator.full_name AS creator_name,
            reviewer.full_name AS reviewer_name
     FROM coaching.exercise_score_calibration_v1 c
     JOIN coaching.exercise_variant_v1 v ON v.id=c.variant_id
     JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id AND d.facility_id=c.facility_id
     LEFT JOIN public.app_user creator ON creator.id=c.created_by
     LEFT JOIN public.app_user reviewer ON reviewer.id=c.reviewed_by
     WHERE ${clauses.join(' AND ')}
     ORDER BY c.status='review' DESC, c.dimension, c.anchor_tier, d.display_name`,
    params,
  )
  return result.rows
}

export async function listCanonicalCalibrationCandidates(pool, facilityId, search = '') {
  const query = String(search || '').trim()
  const params = [facilityId]
  let searchClause = ''
  if (query) {
    params.push(`%${query}%`)
    searchClause = `AND (d.display_name ILIKE $2 OR v.display_name ILIKE $2 OR d.family_key ILIKE $2)`
  }
  const result = await pool.query(
    `SELECT v.id AS variant_id, d.id AS definition_id, d.display_name AS exercise_name,
            v.display_name AS variant_name, d.family_key, d.card_version,
            COALESCE(v.difficulty_json, '{}'::jsonb) AS difficulty_json,
            COALESCE(v.load_profile_json, '{}'::jsonb) AS load_profile_json,
            COALESCE(v.fatigue_profile_json, '{}'::jsonb) AS fatigue_profile_json
     FROM coaching.exercise_variant_v1 v
     JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id
     WHERE d.facility_id=$1 AND d.status='published' AND v.status='published'
       ${searchClause}
     ORDER BY d.display_name, v.display_name
     LIMIT 250`,
    params,
  )
  return result.rows
}

export async function proposeCanonicalCalibration(pool, facilityId, actorUserId, variantId, raw) {
  const proposal = normalizeProposal(raw)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const variant = await client.query(
      `SELECT v.id FROM coaching.exercise_variant_v1 v
       JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id
       WHERE v.id=$1 AND d.facility_id=$2 AND d.status='published' FOR UPDATE`,
      [variantId, facilityId],
    )
    if (variant.rows.length === 0) {
      throw Object.assign(new Error('Published canonical variant not found.'), { status: 404 })
    }
    const version = await client.query(
      `SELECT COALESCE(MAX(version),0)+1 AS version
       FROM coaching.exercise_score_calibration_v1
       WHERE facility_id=$1 AND variant_id=$2 AND dimension=$3`,
      [facilityId, variantId, proposal.dimension],
    )
    const result = await client.query(
      `INSERT INTO coaching.exercise_score_calibration_v1 (
         facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
         status,version,created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,'review',$7,$8) RETURNING *`,
      [
        facilityId, variantId, proposal.dimension, proposal.proposedScore,
        proposal.anchorTier, proposal.rationale, Number(version.rows[0].version), actorUserId,
      ],
    )
    await client.query('COMMIT')
    return result.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function reviewCanonicalCalibration(pool, facilityId, calibrationId, actorUserId, raw = {}) {
  const decision = String(raw.decision || '')
  const notes = String(raw.notes || '').trim()
  if (!['approved', 'rejected'].includes(decision)) throw new RangeError('Decision must be approved or rejected.')
  if (notes.length < 10 || notes.length > 2000) throw new RangeError('Review notes must contain 10 to 2000 characters.')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existing = await client.query(
      `SELECT * FROM coaching.exercise_score_calibration_v1
       WHERE id=$1 AND facility_id=$2 FOR UPDATE`,
      [calibrationId, facilityId],
    )
    if (existing.rows.length === 0) throw Object.assign(new Error('Calibration proposal not found.'), { status: 404 })
    const row = existing.rows[0]
    if (row.status !== 'review') throw Object.assign(new Error('Calibration proposal is no longer awaiting review.'), { status: 409 })
    if (Number(row.created_by) === Number(actorUserId)) {
      throw Object.assign(new Error('Calibration requires an independent reviewer.'), { status: 409 })
    }
    if (decision === 'approved') {
      await client.query(
        `UPDATE coaching.exercise_score_calibration_v1
         SET status='superseded', updated_at=now()
         WHERE facility_id=$1 AND variant_id=$2 AND dimension=$3 AND status='approved'`,
        [facilityId, row.variant_id, row.dimension],
      )
    }
    const updated = await client.query(
      `UPDATE coaching.exercise_score_calibration_v1
       SET status=$3,reviewed_by=$4,review_notes=$5,reviewed_at=now(),updated_at=now()
       WHERE id=$1 AND facility_id=$2 RETURNING *`,
      [calibrationId, facilityId, decision, actorUserId, notes],
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

export const CANONICAL_CALIBRATION_DIMENSIONS = Object.freeze([...DIMENSIONS])
