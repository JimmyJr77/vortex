import {
  approvalAppliesToVersion,
  assertIndependentReviewer,
  assertCardStatusTransition,
  buildCanonicalCardTestPacket,
  evaluateCanonicalCardReadiness,
  findPotentialCanonicalDuplicates,
  validateCanonicalCardDraft,
  validateCanonicalRelationship,
} from './canonicalCardAuthoring.js'

function rowToCard(definition, variants, profiles) {
  const profilesByVariant = new Map()
  for (const profile of profiles) {
    const key = String(profile.variant_id)
    if (!profilesByVariant.has(key)) profilesByVariant.set(key, [])
    profilesByVariant.get(key).push({
      id: String(profile.id),
      profileKey: profile.profile_key,
      phaseKey: profile.phase_key,
      role: profile.role,
      purpose: profile.purpose,
      phaseSuitability: Number(profile.phase_suitability),
      methodologyAlignment: profile.methodology_alignment == null ? null : Number(profile.methodology_alignment),
      objectiveRelevance: profile.objective_relevance_json ?? {},
      dosage: profile.dosage_json ?? {},
      qualityGate: profile.quality_gate,
      stopRules: profile.stop_rules ?? [],
      coachInstructions: profile.coach_instructions,
      athleteInstructions: profile.athlete_instructions,
      expectedAdaptation: profile.expected_adaptation,
      equipmentRequired: profile.equipment_required ?? [],
      logistics: profile.logistics_json ?? {},
      timeModel: profile.time_model_json ?? {},
      doseScaling: profile.dose_scaling_json ?? {},
      measurement: profile.measurement_json ?? {},
      supportPrompts: profile.support_prompts_json ?? {},
      status: profile.status,
    })
  }
  return {
    id: String(definition.id),
    slug: definition.slug,
    canonicalName: definition.canonical_name,
    displayName: definition.display_name,
    description: definition.description,
    aliases: definition.aliases ?? [],
    familyKey: definition.family_key,
    schemaVersion: definition.schema_version,
    cardVersion: Number(definition.card_version),
    status: definition.status,
    contentConfidence: definition.content_confidence == null ? null : Number(definition.content_confidence),
    scoringConfidence: definition.scoring_confidence == null ? null : Number(definition.scoring_confidence),
    mediaConfidence: definition.media_confidence == null ? null : Number(definition.media_confidence),
    movementPatterns: definition.movement_patterns ?? [],
    bodyRegions: definition.body_regions ?? [],
    requiredEquipment: definition.required_equipment ?? [],
    optionalEquipment: definition.optional_equipment ?? [],
    environment: definition.environment_json ?? {},
    population: definition.population_json ?? {},
    athleteSupport: definition.athlete_support_json ?? {},
    coachSupport: definition.coach_support_json ?? {},
    supportOperations: definition.support_operations_json ?? {},
    anatomy: definition.anatomy_json ?? {},
    approvedVideoUrl: definition.approved_video_url,
    createdBy: definition.created_by == null ? null : Number(definition.created_by),
    reviewedBy: definition.reviewed_by == null ? null : Number(definition.reviewed_by),
    approvedBy: definition.approved_by == null ? null : Number(definition.approved_by),
    updatedAt: definition.updated_at,
    variants: variants.map((variant) => ({
      id: String(variant.id),
      variantKey: variant.variant_key,
      displayName: variant.display_name,
      modifierKeys: variant.modifier_keys ?? [],
      difficulty: variant.difficulty_json ?? {},
      requirements: variant.requirements_json ?? {},
      loadProfile: variant.load_profile_json ?? {},
      fatigueProfile: variant.fatigue_profile_json ?? {},
      programming: variant.programming_profile_json ?? {},
      status: variant.status,
      profiles: profilesByVariant.get(String(variant.id)) ?? [],
    })),
  }
}

async function controlledTaxonomyIssues(client, card) {
  const [patterns, regions, equipment] = await Promise.all([
    client.query(`SELECT key FROM coaching.movement_pattern`),
    client.query(`SELECT key FROM coaching.body_region`),
    client.query(`SELECT key FROM coaching.equipment`),
  ])
  const allowed = {
    movementPatterns: new Set(patterns.rows.map((row) => row.key)),
    bodyRegions: new Set(regions.rows.map((row) => row.key)),
    equipment: new Set(equipment.rows.map((row) => row.key)),
  }
  const invalid = {
    movementPatterns: card.movementPatterns.filter((key) => !allowed.movementPatterns.has(key)),
    bodyRegions: card.bodyRegions.filter((key) => !allowed.bodyRegions.has(key)),
    equipment: [...new Set([
      ...card.requiredEquipment,
      ...card.optionalEquipment,
      ...card.variants.flatMap((variant) => (
        variant.profiles.flatMap((profile) => profile.equipmentRequired)
      )),
    ])].filter((key) => !allowed.equipment.has(key)),
  }
  return invalid
}

async function assertControlledTaxonomies(client, card) {
  const invalid = await controlledTaxonomyIssues(client, card)
  if (Object.values(invalid).some((values) => values.length > 0)) {
    throw Object.assign(new TypeError('Canonical card contains uncontrolled taxonomy keys.'), {
      details: { invalid },
    })
  }
}

async function duplicateCandidates(client, facilityId, card, definitionId = null) {
  const result = await client.query(
    `SELECT id, canonical_name, display_name, aliases, family_key
     FROM coaching.exercise_definition_v1
     WHERE facility_id=$1 AND ($2::uuid IS NULL OR id != $2) AND status != 'archived'`,
    [facilityId, definitionId],
  )
  return findPotentialCanonicalDuplicates({ ...card, id: definitionId }, result.rows)
}

export async function findCanonicalCardDuplicates(pool, facilityId, raw, definitionId = null) {
  const validation = validateCanonicalCardDraft(raw)
  const candidate = validation.normalized ?? raw
  return duplicateCandidates(pool, facilityId, candidate, definitionId)
}

export async function loadCanonicalCard(pool, facilityId, definitionId, client = pool) {
  const [definition, variants, profiles, mediaReview, reviews, revisions, relationships] = await Promise.all([
    client.query(
      `SELECT * FROM coaching.exercise_definition_v1 WHERE id = $1 AND facility_id = $2`,
      [definitionId, facilityId],
    ),
    client.query(
      `SELECT v.* FROM coaching.exercise_variant_v1 v
       JOIN coaching.exercise_definition_v1 d ON d.id = v.definition_id
       WHERE v.definition_id = $1 AND d.facility_id = $2 AND v.status != 'archived'
       ORDER BY v.variant_key`,
      [definitionId, facilityId],
    ),
    client.query(
      `SELECT p.* FROM coaching.exercise_delivery_profile_v1 p
       JOIN coaching.exercise_variant_v1 v ON v.id = p.variant_id
       JOIN coaching.exercise_definition_v1 d ON d.id = v.definition_id
       WHERE v.definition_id = $1 AND d.facility_id = $2 AND p.status != 'archived'
       ORDER BY v.variant_key, p.phase_key, p.profile_key`,
      [definitionId, facilityId],
    ),
    client.query(
      `SELECT url, exact_variant_match, demonstration_quality_score, link_status,
              reviewed_card_version,
              reviewer_user_id, reviewed_at, next_review_at, notes
       FROM coaching.exercise_media_review_v1
       WHERE definition_id = $1 ORDER BY reviewed_at DESC NULLS LAST LIMIT 1`,
      [definitionId],
    ),
    client.query(
      `SELECT * FROM coaching.exercise_card_review_v1
       WHERE definition_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [definitionId],
    ),
    client.query(
      `SELECT id, revision_number, action, from_status, to_status, change_summary,
              actor_user_id, created_at
       FROM coaching.exercise_card_revision_v1
       WHERE definition_id = $1 ORDER BY revision_number DESC LIMIT 50`,
      [definitionId],
    ),
    client.query(
      `SELECT r.*, fv.display_name AS from_name, tv.display_name AS to_name
       FROM coaching.exercise_relationship_v1 r
       JOIN coaching.exercise_variant_v1 fv ON fv.id = r.from_variant_id
       JOIN coaching.exercise_variant_v1 tv ON tv.id = r.to_variant_id
       WHERE fv.definition_id = $1 OR tv.definition_id = $1
       ORDER BY r.updated_at DESC`,
      [definitionId],
    ),
  ])
  if (definition.rows.length === 0) return null
  const card = {
    ...rowToCard(definition.rows[0], variants.rows, profiles.rows),
    mediaReview: mediaReview.rows[0] ? {
      url: mediaReview.rows[0].url,
      exactVariantMatch: mediaReview.rows[0].exact_variant_match,
      demonstrationQualityScore: mediaReview.rows[0].demonstration_quality_score == null
        ? null
        : Number(mediaReview.rows[0].demonstration_quality_score),
      linkStatus: mediaReview.rows[0].link_status,
      reviewedCardVersion: Number(mediaReview.rows[0].reviewed_card_version),
      reviewerUserId: mediaReview.rows[0].reviewer_user_id,
      reviewedAt: mediaReview.rows[0].reviewed_at,
      nextReviewAt: mediaReview.rows[0].next_review_at,
      notes: mediaReview.rows[0].notes,
    } : null,
    reviews: reviews.rows,
    revisions: revisions.rows,
    relationships: relationships.rows,
  }
  const [duplicates, invalidTaxonomy] = await Promise.all([
    duplicateCandidates(client, facilityId, card, definitionId),
    controlledTaxonomyIssues(client, card),
  ])
  const activeMediaReview = card.mediaReview?.reviewedCardVersion === card.cardVersion
    ? card.mediaReview
    : null
  return {
    ...card,
    duplicateCandidates: duplicates,
    readiness: evaluateCanonicalCardReadiness(card, { mediaReview: activeMediaReview }),
    testPacket: buildCanonicalCardTestPacket(card, {
      mediaReview: activeMediaReview,
      duplicates,
      invalidTaxonomyKeys: Object.entries(invalidTaxonomy).flatMap(([group, keys]) => (
        keys.map((key) => `${group}:${key}`)
      )),
      relationships: relationships.rows,
    }),
  }
}

export async function listCanonicalCards(pool, facilityId, filters = {}) {
  const status = filters.status ? String(filters.status) : null
  const search = filters.search ? String(filters.search).trim() : ''
  const result = await pool.query(
    `SELECT d.id, d.slug, d.canonical_name, d.display_name, d.family_key, d.status,
            d.card_version, d.content_confidence, d.scoring_confidence,
            d.media_confidence, d.approved_video_url, d.updated_at,
            COUNT(DISTINCT v.id)::int AS variant_count,
            COUNT(DISTINCT p.id)::int AS profile_count
     FROM coaching.exercise_definition_v1 d
     LEFT JOIN coaching.exercise_variant_v1 v ON v.definition_id = d.id AND v.status != 'archived'
     LEFT JOIN coaching.exercise_delivery_profile_v1 p ON p.variant_id = v.id AND p.status != 'archived'
     WHERE d.facility_id = $1
       AND ($2::text IS NULL OR d.status = $2)
       AND ($3::text = '' OR d.canonical_name ILIKE '%' || $3 || '%'
         OR d.display_name ILIKE '%' || $3 || '%'
         OR d.slug ILIKE '%' || $3 || '%' OR d.family_key ILIKE '%' || $3 || '%'
         OR EXISTS (
           SELECT 1 FROM unnest(d.aliases) alias
           WHERE alias ILIKE '%' || $3 || '%'
         ))
     GROUP BY d.id
     ORDER BY d.updated_at DESC, d.canonical_name
     LIMIT 200`,
    [facilityId, status, search],
  )
  return result.rows
}

async function insertRevision(client, facilityId, definitionId, actorUserId, action, fromStatus, toStatus, snapshot, changeSummary) {
  await client.query(
    `INSERT INTO coaching.exercise_card_revision_v1 (
       definition_id, facility_id, revision_number, action, from_status,
       to_status, snapshot_json, change_summary, actor_user_id
     )
     SELECT $1, $2, COALESCE(MAX(revision_number), 0) + 1, $3, $4, $5,
            $6::jsonb, $7, $8
     FROM coaching.exercise_card_revision_v1 WHERE definition_id = $1`,
    [
      definitionId, facilityId, action, fromStatus, toStatus,
      JSON.stringify(snapshot), changeSummary || null, actorUserId,
    ],
  )
}

async function writeVariantsAndProfiles(client, definitionId, card, status) {
  const activeVariantIds = []
  for (const variant of card.variants) {
    const savedVariant = await client.query(
      `INSERT INTO coaching.exercise_variant_v1 (
         definition_id, variant_key, display_name, modifier_keys,
         difficulty_json, requirements_json, load_profile_json,
         fatigue_profile_json, programming_profile_json, status
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10)
       ON CONFLICT (definition_id, variant_key) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         modifier_keys = EXCLUDED.modifier_keys,
         difficulty_json = EXCLUDED.difficulty_json,
         requirements_json = EXCLUDED.requirements_json,
         load_profile_json = EXCLUDED.load_profile_json,
         fatigue_profile_json = EXCLUDED.fatigue_profile_json,
         programming_profile_json = EXCLUDED.programming_profile_json,
         status = EXCLUDED.status,
         updated_at = now()
       RETURNING id`,
      [
        definitionId, variant.variantKey, variant.displayName, variant.modifierKeys,
        JSON.stringify(variant.difficulty), JSON.stringify(variant.requirements),
        JSON.stringify(variant.loadProfile), JSON.stringify(variant.fatigueProfile),
        JSON.stringify(variant.programming), status,
      ],
    )
    const variantId = savedVariant.rows[0].id
    activeVariantIds.push(variantId)
    const activeProfileIds = []
    for (const profile of variant.profiles) {
      const savedProfile = await client.query(
        `INSERT INTO coaching.exercise_delivery_profile_v1 (
           variant_id, profile_key, phase_key, role, purpose, phase_suitability,
           methodology_alignment, objective_relevance_json, dosage_json,
           quality_gate, stop_rules, coach_instructions, athlete_instructions,
           expected_adaptation, equipment_required, logistics_json, time_model_json,
           dose_scaling_json, measurement_json, support_prompts_json, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,
                   $16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20::jsonb,$21)
         ON CONFLICT (variant_id, profile_key) DO UPDATE SET
           phase_key = EXCLUDED.phase_key, role = EXCLUDED.role,
           purpose = EXCLUDED.purpose, phase_suitability = EXCLUDED.phase_suitability,
           methodology_alignment = EXCLUDED.methodology_alignment,
           objective_relevance_json = EXCLUDED.objective_relevance_json,
           dosage_json = EXCLUDED.dosage_json, quality_gate = EXCLUDED.quality_gate,
           stop_rules = EXCLUDED.stop_rules, coach_instructions = EXCLUDED.coach_instructions,
           athlete_instructions = EXCLUDED.athlete_instructions,
           expected_adaptation = EXCLUDED.expected_adaptation,
           equipment_required = EXCLUDED.equipment_required,
           logistics_json = EXCLUDED.logistics_json,
           time_model_json = EXCLUDED.time_model_json,
           dose_scaling_json = EXCLUDED.dose_scaling_json,
           measurement_json = EXCLUDED.measurement_json,
           support_prompts_json = EXCLUDED.support_prompts_json,
           status = EXCLUDED.status,
           updated_at = now()
         RETURNING id`,
        [
          variantId, profile.profileKey, profile.phaseKey, profile.role,
          profile.purpose, profile.phaseSuitability, profile.methodologyAlignment,
          JSON.stringify(profile.objectiveRelevance), JSON.stringify(profile.dosage),
          profile.qualityGate, profile.stopRules, profile.coachInstructions,
          profile.athleteInstructions, profile.expectedAdaptation,
          profile.equipmentRequired, JSON.stringify(profile.logistics),
          JSON.stringify(profile.timeModel), JSON.stringify(profile.doseScaling),
          JSON.stringify(profile.measurement), JSON.stringify(profile.supportPrompts), status,
        ],
      )
      activeProfileIds.push(savedProfile.rows[0].id)
    }
    await client.query(
      `UPDATE coaching.exercise_delivery_profile_v1
       SET status = 'archived', updated_at = now()
       WHERE variant_id = $1 AND NOT (id = ANY($2::uuid[]))`,
      [variantId, activeProfileIds],
    )
  }
  await client.query(
    `UPDATE coaching.exercise_variant_v1
     SET status = 'archived', updated_at = now()
     WHERE definition_id = $1 AND NOT (id = ANY($2::uuid[]))`,
    [definitionId, activeVariantIds],
  )
}

export async function saveCanonicalCardDraft(pool, facilityId, actorUserId, raw, options = {}) {
  const draftValidation = validateCanonicalCardDraft(raw)
  if (!draftValidation.valid) {
    throw Object.assign(new TypeError('Canonical card draft is invalid.'), { details: draftValidation })
  }
  const card = draftValidation.normalized
  const definitionId = options.definitionId ?? null
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('canonical-card:' || $1::text))`, [facilityId])
    await assertControlledTaxonomies(client, card)
    const duplicates = await duplicateCandidates(client, facilityId, card, definitionId)
    const blockingDuplicates = duplicates.filter((match) => match.score >= 90)
    if (blockingDuplicates.length > 0) {
      throw Object.assign(new Error('A canonical card or alias is too similar to an existing card.'), {
        status: 409,
        details: { duplicates: blockingDuplicates },
      })
    }
    let id = definitionId
    let fromStatus = null
    if (definitionId) {
      const existing = await client.query(
        `SELECT * FROM coaching.exercise_definition_v1
         WHERE id = $1 AND facility_id = $2 FOR UPDATE`,
        [definitionId, facilityId],
      )
      if (existing.rows.length === 0) throw Object.assign(new Error('Canonical card not found.'), { status: 404 })
      const row = existing.rows[0]
      fromStatus = row.status
      if (!['draft', 'review'].includes(row.status)) {
        throw new RangeError('Published, deprecated, and archived cards are immutable; create a reviewed revision instead.')
      }
      if (!options.expectedUpdatedAt || new Date(options.expectedUpdatedAt).getTime() !== new Date(row.updated_at).getTime()) {
        throw Object.assign(new Error('This card changed after it was opened. Reload before saving.'), { status: 409 })
      }
      await client.query(
        `UPDATE coaching.exercise_definition_v1 SET
           slug=$3, canonical_name=$4, display_name=$5, aliases=$6,
           description=$7, family_key=$8, content_confidence=$9,
           scoring_confidence=$10, media_confidence=$11,
           movement_patterns=$12, body_regions=$13, required_equipment=$14,
           optional_equipment=$15, environment_json=$16::jsonb,
           population_json=$17::jsonb, anatomy_json=$18::jsonb,
           athlete_support_json=$19::jsonb, coach_support_json=$20::jsonb,
           support_operations_json=$21::jsonb, approved_video_url=$22,
           status='draft', reviewed_by=NULL,
           card_version=card_version + 1, updated_at=now()
         WHERE id=$1 AND facility_id=$2`,
        [
          definitionId, facilityId, card.slug, card.canonicalName, card.displayName,
          card.aliases, card.description, card.familyKey, card.contentConfidence,
          card.scoringConfidence, card.mediaConfidence, card.movementPatterns,
          card.bodyRegions, card.requiredEquipment, card.optionalEquipment,
          JSON.stringify(card.environment), JSON.stringify(card.population),
          JSON.stringify(card.anatomy), JSON.stringify(card.athleteSupport),
          JSON.stringify(card.coachSupport), JSON.stringify(card.supportOperations),
          card.approvedVideoUrl,
        ],
      )
    } else {
      const created = await client.query(
        `INSERT INTO coaching.exercise_definition_v1 (
           facility_id, slug, canonical_name, display_name, aliases, description,
           family_key, status, content_confidence, scoring_confidence,
           media_confidence, movement_patterns, body_regions, required_equipment,
           optional_equipment, environment_json, population_json,
           anatomy_json, athlete_support_json, coach_support_json,
           support_operations_json, approved_video_url, provenance_json, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10,$11,$12,$13,$14,
                   $15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20::jsonb,
                   $21,'{"source":"canonical_authoring"}'::jsonb,$22)
         RETURNING id`,
        [
          facilityId, card.slug, card.canonicalName, card.displayName, card.aliases,
          card.description, card.familyKey, card.contentConfidence,
          card.scoringConfidence, card.mediaConfidence, card.movementPatterns,
          card.bodyRegions, card.requiredEquipment, card.optionalEquipment,
          JSON.stringify(card.environment), JSON.stringify(card.population),
          JSON.stringify(card.anatomy), JSON.stringify(card.athleteSupport),
          JSON.stringify(card.coachSupport), JSON.stringify(card.supportOperations),
          card.approvedVideoUrl, actorUserId,
        ],
      )
      id = created.rows[0].id
    }
    await writeVariantsAndProfiles(client, id, card, 'draft')
    if (definitionId) {
      await client.query(
        `UPDATE coaching.exercise_media_review_v1
         SET exact_variant_match=FALSE, link_status='pending', updated_at=now()
         WHERE definition_id=$1`,
        [definitionId],
      )
    }
    await insertRevision(
      client, facilityId, id, actorUserId,
      definitionId && fromStatus === 'review' ? 'returned_to_draft' : definitionId ? 'updated' : 'created',
      fromStatus, 'draft', card, options.changeSummary,
    )
    await client.query('COMMIT')
    return loadCanonicalCard(pool, facilityId, id)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function transitionCanonicalCard(pool, facilityId, definitionId, actorUserId, toStatus, options = {}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const card = await loadCanonicalCard(pool, facilityId, definitionId, client)
    if (!card) throw Object.assign(new Error('Canonical card not found.'), { status: 404 })
    assertCardStatusTransition(card.status, toStatus)
    if (!options.expectedUpdatedAt || new Date(options.expectedUpdatedAt).getTime() !== new Date(card.updatedAt).getTime()) {
      throw Object.assign(new Error('This card changed after it was opened. Reload before changing status.'), { status: 409 })
    }
    if (toStatus === 'published') {
      assertIndependentReviewer(card.createdBy, actorUserId, 'publishing')
      const approval = card.reviews.find((review) => approvalAppliesToVersion(review, card.cardVersion, actorUserId))
      if (!approval) throw Object.assign(new Error('The publishing reviewer must first record an approval.'), { status: 409 })
      const readiness = evaluateCanonicalCardReadiness(card, {
        mediaReview: card.mediaReview?.reviewedCardVersion === card.cardVersion ? card.mediaReview : null,
      })
      if (!readiness.ready || card.testPacket?.status === 'failed') {
        throw Object.assign(new Error('Canonical card is not publication-ready.'), {
          status: 422,
          details: { readiness, testPacket: card.testPacket },
        })
      }
    }
    await client.query(
      `UPDATE coaching.exercise_definition_v1 SET
         status=$3,
         reviewed_by=CASE WHEN $3='review' THEN NULL ELSE reviewed_by END,
         approved_by=CASE WHEN $3='published' THEN $4 ELSE approved_by END,
         last_reviewed_at=CASE WHEN $3 IN ('review','published') THEN now() ELSE last_reviewed_at END,
         updated_at=now()
       WHERE id=$1 AND facility_id=$2`,
      [definitionId, facilityId, toStatus, actorUserId],
    )
    await client.query(
      `UPDATE coaching.exercise_variant_v1 SET status=$2, updated_at=now()
       WHERE definition_id=$1 AND status != 'archived'`,
      [definitionId, toStatus],
    )
    await client.query(
      `UPDATE coaching.exercise_delivery_profile_v1 p SET status=$2, updated_at=now()
       FROM coaching.exercise_variant_v1 v
       WHERE p.variant_id=v.id AND v.definition_id=$1 AND p.status != 'archived'`,
      [definitionId, toStatus],
    )
    const action = toStatus === 'review'
      ? 'submitted_for_review'
      : toStatus === 'draft'
        ? 'returned_to_draft'
        : toStatus
    await insertRevision(
      client, facilityId, definitionId, actorUserId, action,
      card.status, toStatus, card, options.changeSummary,
    )
    await client.query('COMMIT')
    return loadCanonicalCard(pool, facilityId, definitionId)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function recordCanonicalCardReview(pool, facilityId, definitionId, reviewerUserId, body = {}) {
  const decision = body.decision === 'approve' ? 'approve' : body.decision === 'request_changes' ? 'request_changes' : null
  const notes = String(body.notes || '').trim()
  if (!decision || !notes) throw new TypeError('Review decision and notes are required.')
  const card = await loadCanonicalCard(pool, facilityId, definitionId)
  if (!card) throw Object.assign(new Error('Canonical card not found.'), { status: 404 })
  if (card.status !== 'review') throw new RangeError('Reviews can only be recorded while a card is in review.')
  assertIndependentReviewer(card.createdBy, reviewerUserId)
  const result = await pool.query(
    `INSERT INTO coaching.exercise_card_review_v1 (
       definition_id, reviewer_user_id, reviewed_card_version, decision, rubric_json, notes
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING *`,
    [definitionId, reviewerUserId, card.cardVersion, decision, JSON.stringify(body.rubric ?? {}), notes],
  )
  return result.rows[0]
}

export async function recordCanonicalMediaReview(pool, facilityId, definitionId, reviewerUserId, body = {}) {
  const card = await loadCanonicalCard(pool, facilityId, definitionId)
  if (!card) throw Object.assign(new Error('Canonical card not found.'), { status: 404 })
  assertIndependentReviewer(card.createdBy, reviewerUserId, 'media')
  const url = String(body.url || '').trim()
  if (!url || url !== card.approvedVideoUrl) throw new TypeError('Media review URL must match the card approved video.')
  const score = Number(body.demonstrationQualityScore)
  if (!Number.isInteger(score) || score < 1 || score > 100) throw new RangeError('Media quality must be an integer from 1 to 100.')
  const linkStatus = ['healthy', 'broken', 'mismatched'].includes(body.linkStatus) ? body.linkStatus : null
  if (!linkStatus) throw new TypeError('A valid media link status is required.')
  const result = await pool.query(
    `INSERT INTO coaching.exercise_media_review_v1 (
       definition_id, url, exact_variant_match, reviewed_card_version, demonstration_quality_score,
       link_status, reviewer_user_id, reviewed_at, next_review_at, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now() + interval '180 days',$8)
     ON CONFLICT (definition_id, url) DO UPDATE SET
       exact_variant_match=EXCLUDED.exact_variant_match,
       reviewed_card_version=EXCLUDED.reviewed_card_version,
       demonstration_quality_score=EXCLUDED.demonstration_quality_score,
       link_status=EXCLUDED.link_status, reviewer_user_id=EXCLUDED.reviewer_user_id,
       reviewed_at=EXCLUDED.reviewed_at, next_review_at=EXCLUDED.next_review_at,
       notes=EXCLUDED.notes, updated_at=now()
     RETURNING *`,
    [
      definitionId, url, body.exactVariantMatch === true, card.cardVersion, score,
      linkStatus, reviewerUserId, String(body.notes || '').trim() || null,
    ],
  )
  return result.rows[0]
}

export async function saveCanonicalRelationship(pool, facilityId, reviewerUserId, raw) {
  const validation = validateCanonicalRelationship(raw)
  if (!validation.valid) throw Object.assign(new TypeError('Invalid canonical relationship.'), { details: validation })
  const relationship = validation.normalized
  const ownership = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM coaching.exercise_variant_v1 v
     JOIN coaching.exercise_definition_v1 d ON d.id=v.definition_id
     WHERE v.id=ANY($1::uuid[]) AND d.facility_id=$2`,
    [[relationship.fromVariantId, relationship.toVariantId], facilityId],
  )
  if (Number(ownership.rows[0]?.count) !== 2) {
    throw Object.assign(new Error('Both relationship variants must belong to this facility.'), { status: 404 })
  }
  const result = await pool.query(
    `INSERT INTO coaching.exercise_relationship_v1 (
       from_variant_id, to_variant_id, relationship, similarity_score,
       dimensions, reason, conditions_json, review_status, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'review',$8)
     ON CONFLICT (from_variant_id,to_variant_id,relationship) DO UPDATE SET
       similarity_score=EXCLUDED.similarity_score, dimensions=EXCLUDED.dimensions,
       reason=EXCLUDED.reason, conditions_json=EXCLUDED.conditions_json,
       review_status='review', reviewed_by=NULL, reviewed_at=NULL, updated_at=now()
     RETURNING *`,
    [
      relationship.fromVariantId, relationship.toVariantId,
      relationship.relationship, relationship.similarityScore,
      relationship.dimensions, relationship.reason,
      JSON.stringify(relationship.conditions), reviewerUserId,
    ],
  )
  return result.rows[0]
}

export async function reviewCanonicalRelationship(pool, facilityId, relationshipId, reviewerUserId, decision) {
  if (!['approved', 'rejected'].includes(decision)) throw new TypeError('Relationship decision must be approved or rejected.')
  const existing = await pool.query(
    `SELECT r.created_by
     FROM coaching.exercise_relationship_v1 r
     JOIN coaching.exercise_variant_v1 fv ON fv.id=r.from_variant_id
     JOIN coaching.exercise_definition_v1 d ON d.id=fv.definition_id
     WHERE r.id=$1 AND d.facility_id=$2`,
    [relationshipId, facilityId],
  )
  if (existing.rows.length === 0) throw Object.assign(new Error('Canonical relationship not found.'), { status: 404 })
  if (Number(existing.rows[0].created_by) === Number(reviewerUserId)) {
    throw Object.assign(new Error('Two-person control requires a different relationship reviewer.'), { status: 409 })
  }
  const result = await pool.query(
    `UPDATE coaching.exercise_relationship_v1 r SET
       review_status=$3, reviewed_by=$4, reviewed_at=now(), updated_at=now()
     FROM coaching.exercise_variant_v1 fv
     JOIN coaching.exercise_definition_v1 d ON d.id=fv.definition_id
     WHERE r.id=$1 AND r.from_variant_id=fv.id AND d.facility_id=$2
     RETURNING r.*`,
    [relationshipId, facilityId, decision, reviewerUserId],
  )
  if (result.rows.length === 0) throw Object.assign(new Error('Canonical relationship not found.'), { status: 404 })
  return result.rows[0]
}
