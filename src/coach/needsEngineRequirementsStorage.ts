import { coachFetch } from './api'
import type { CoachNeedsEngineRequirements, CoachPhaseTemplate, NeedsEngineRequirementsSnapshot } from './types'

const REQUIREMENTS_KIND = 'needs_engine_requirements'
const REQUIREMENTS_VERSION = 1

interface RequirementsEnvelope {
  __kind: typeof REQUIREMENTS_KIND
  version: number
  snapshot: NeedsEngineRequirementsSnapshot
}

function isRequirementsEnvelope(value: unknown): value is RequirementsEnvelope {
  return typeof value === 'object'
    && value !== null
    && (value as RequirementsEnvelope).__kind === REQUIREMENTS_KIND
    && typeof (value as RequirementsEnvelope).snapshot === 'object'
}

function envelopeFromSnapshot(snapshot: NeedsEngineRequirementsSnapshot): RequirementsEnvelope {
  return {
    __kind: REQUIREMENTS_KIND,
    version: REQUIREMENTS_VERSION,
    snapshot,
  }
}

function normalizePhasePlan(template: CoachPhaseTemplate & { phase_plan_json?: unknown }): unknown {
  return template.phase_plan ?? template.phase_plan_json
}

function templateToRequirements(template: CoachPhaseTemplate & { phase_plan_json?: unknown }): CoachNeedsEngineRequirements | null {
  const phasePlan = normalizePhasePlan(template)
  if (!isRequirementsEnvelope(phasePlan)) return null
  return {
    id: template.id,
    name: template.name,
    requirements: phasePlan.snapshot,
    created_at: template.created_at,
    updated_at: template.updated_at,
  }
}

function isRouteMissing(err: unknown): boolean {
  const status = (err as Error & { status?: number })?.status
  const message = err instanceof Error ? err.message : String(err)
  return status === 404 || /route not found/i.test(message)
}

export async function listNeedsEngineRequirements(): Promise<CoachNeedsEngineRequirements[]> {
  try {
    return await coachFetch<CoachNeedsEngineRequirements[]>('/api/coach/needs-engine/requirements')
  } catch (err) {
    if (!isRouteMissing(err)) throw err
  }

  const templates = await coachFetch<CoachPhaseTemplate[]>('/api/coach/phase-templates')
  return templates
    .map(templateToRequirements)
    .filter((row): row is CoachNeedsEngineRequirements => row != null)
}

export async function saveNeedsEngineRequirements(
  name: string,
  snapshot: NeedsEngineRequirementsSnapshot,
): Promise<CoachNeedsEngineRequirements> {
  try {
    return await coachFetch<CoachNeedsEngineRequirements>('/api/coach/needs-engine/requirements', {
      method: 'POST',
      body: JSON.stringify({ name, requirements_json: snapshot }),
    })
  } catch (err) {
    if (!isRouteMissing(err)) throw err
  }

  const saved = await coachFetch<CoachPhaseTemplate & { phase_plan_json?: RequirementsEnvelope }>('/api/coach/phase-templates', {
    method: 'POST',
    body: JSON.stringify({
      name,
      phase_plan_json: envelopeFromSnapshot(snapshot),
    }),
  })
  const mapped = templateToRequirements({
    id: Number(saved.id),
    name: saved.name,
    phase_plan: saved.phase_plan ?? saved.phase_plan_json,
    created_at: saved.created_at,
    updated_at: saved.updated_at,
  })
  if (!mapped) {
    throw new Error('Saved session but could not read it back.')
  }
  return mapped
}
