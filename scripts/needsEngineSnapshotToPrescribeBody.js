/**
 * Convert a Needs Engine saved requirements snapshot to the prescribe API body
 * (same shape as NeedsEnginePanel prescribe()).
 */

export function snapshotToPrescribeBody(snapshot) {
  const ageMin = snapshot.ageMin === '' || snapshot.ageMin == null ? null : Number(snapshot.ageMin)
  const ageMax = snapshot.ageMax === '' || snapshot.ageMax == null ? null : Number(snapshot.ageMax)
  const sportId = snapshot.sportId === '' || snapshot.sportId == null ? null : Number(snapshot.sportId)
  const skillLevel = snapshot.skillLevel || null

  const capsOverride = snapshot.difficultyOverride !== '' && snapshot.difficultyOverride != null
    ? {
      maxOverall: Number(snapshot.difficultyOverride),
      maxTechnical: Number(snapshot.difficultyOverride),
      maxLoad: Number(snapshot.difficultyOverride),
    }
    : null

  const audienceSplits = Array.isArray(snapshot.audienceSplits)
    ? snapshot.audienceSplits.map((s) => ({
      label: s.label,
      ageMin: s.ageMin,
      ageMax: s.ageMax,
      difficultyOverride: s.difficultyOverride ?? null,
    }))
    : []

  const equipmentUseIds = Array.isArray(snapshot.equipmentUse)
    ? snapshot.equipmentUse.map((e) => Number(e.id)).filter(Number.isFinite)
    : []
  const equipmentUsePolicy = snapshot.equipmentUsePolicy
    ?? (snapshot.equipmentMode === 'use' || snapshot.equipmentMode === 'avoid' ? 'must_use' : 'must_use')
  const allowBodyweight = snapshot.allowBodyweight !== false
  const equipmentAvoidIds = equipmentUsePolicy === 'use_only'
    ? []
    : (Array.isArray(snapshot.equipmentAvoid)
      ? snapshot.equipmentAvoid.map((e) => Number(e.id)).filter(Number.isFinite)
      : [])

  const phasePlan = (snapshot.phaseRows ?? snapshot.phasePlan ?? []).map((r) => ({
    phaseKey: r.phaseKey,
    label: r.label,
    minutes: r.minutes,
    focusTargets: r.focusTargets ?? [],
    otherKind: r.otherKind,
    otherItemIds: r.otherItemIds ?? [],
    contains_tumbling: r.contains_tumbling,
    pinned: r.pinned,
  }))

  return {
    workMode: snapshot.workMode ?? 'exercise',
    sportId,
    skillLevel,
    ageMin,
    ageMax,
    capsOverride,
    audienceSplits,
    equipmentUseIds,
    equipmentUsePolicy,
    allowBodyweight,
    equipmentAvoidIds,
    sessionObjective: snapshot.sessionObjective ?? null,
    durationMinutes: Number(snapshot.sessionMinutes) || null,
    phasePlan,
  }
}

export async function loadSavedRequirementsBody(pool, name) {
  const row = await pool.query(
    `SELECT id, name, requirements_json, updated_at
     FROM coaching.coach_needs_engine_requirements
     WHERE archived = FALSE AND name = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [name],
  )
  if (!row.rows[0]?.requirements_json) {
    throw new Error(`Saved requirements not found: ${name}`)
  }
  return {
    savedId: Number(row.rows[0].id),
    savedName: row.rows[0].name,
    savedUpdatedAt: row.rows[0].updated_at,
    body: snapshotToPrescribeBody(row.rows[0].requirements_json),
    snapshot: row.rows[0].requirements_json,
  }
}
