import { coachFetch } from './api'

// ============================================================
// Canonical training taxonomy.
//
// The database (coaching schema, migration 011) is the source of truth for
// the coach portal. These typed constants mirror the seeded values exactly
// so the prerendered marketing site (AthleticismAccelerator) renders without
// a network round-trip. The portal can additionally call fetchTaxonomy() to
// pull live ids needed for tagging/filtering.
// ============================================================

export type FacetType =
  | 'tenet'
  | 'methodology'
  | 'physiology'
  | 'pattern'
  | 'equipment'
  | 'sport'
  /** @deprecated Legacy exercise_tag facet; use exercise_phase_profile instead */
  | 'intent'
  | 'body_region'

export interface Tenet {
  id?: number
  key: string
  name: string
  description: string
  detail?: string
}

export interface Methodology {
  id?: number
  key: string
  name: string
  description: string
}

export interface PhysiologicalEmphasis {
  id?: number
  key: string
  name: string
  systems: string
  purpose: string
  outcomes: string[]
  is_optional?: boolean
}

export interface TaxonomyItem {
  id: number
  key: string
  name: string
  sort_order?: number
}

export type TaxonomyV2Scope = 'definition' | 'variant' | 'delivery_profile'

export interface TaxonomyV2Term {
  id: number
  key: string
  name: string
  domain: string | null
  description: string | null
  scopes: TaxonomyV2Scope[]
  status: 'active' | 'deprecated'
  sortOrder: number
  metadata: Record<string, unknown>
}

export interface TaxonomyV2Catalog {
  version: '2.0.0'
  facets: Record<string, TaxonomyV2Term[]>
  aliases: Array<{
    facetType: string
    aliasKey: string
    termKey: string
    ambiguous: boolean
    source: string
    notes: string | null
  }>
}

export interface Taxonomy {
  tenets: Tenet[]
  methodologies: Methodology[]
  physiology: PhysiologicalEmphasis[]
  patterns: TaxonomyItem[]
  equipment: TaxonomyItem[]
  sports: TaxonomyItem[]
  /** @deprecated Empty; session placement uses sessionPhases + exercise_phase_profile */
  intents: TaxonomyItem[]
  bodyRegions: TaxonomyItem[]
  sessionPhases?: SessionPhaseTaxonomyItem[]
  phaseOrderSlots?: PhaseOrderSlotTaxonomyItem[]
  phaseSubroles?: PhaseSubroleTaxonomyItem[]
  taxonomyV2?: TaxonomyV2Catalog
}

export interface SessionPhaseTaxonomyItem {
  id: number
  key: string
  name: string
  description?: string | null
  order_index: number
  freshness_required?: boolean
  can_be_daily?: boolean
  default_min_percent?: number | null
  default_max_percent?: number | null
  fatigue_sensitivity?: number | null
}

export interface PhaseOrderSlotTaxonomyItem {
  id: number
  key: string
  name: string
  description?: string | null
  phase_id: number
  phase_key?: string
  order_index: number
  freshness_sensitivity?: number | null
  subrole_key?: string | null
}

export interface PhaseSubroleTaxonomyItem {
  id: number
  key: string
  name: string
  description?: string | null
  phase_key?: string
  order_index: number
  why_it_exists?: string | null
  what_belongs_here?: string | null
  what_to_avoid?: string | null
  fatigue_guidance?: string | null
  coach_guidance?: string | null
}

const PREPARE_AND_ACCESS = 'prepare_and_access'
const MOVEMENT_INTELLIGENCE = 'movement_intelligence'

export function subroleForOrderSlot(
  taxonomy: Taxonomy | null | undefined,
  phaseKey: string | null | undefined,
  orderSlotKey: string | null | undefined,
): string | null {
  if (!taxonomy || !phaseKey || !orderSlotKey) return null
  const slot = taxonomy.phaseOrderSlots?.find((s) => s.phase_key === phaseKey && s.key === orderSlotKey)
  return slot?.subrole_key ?? null
}

export function orderSlotsForSubrole(
  taxonomy: Taxonomy | null | undefined,
  phaseKey: string,
  subroleKey: string,
): PhaseOrderSlotTaxonomyItem[] {
  return (taxonomy?.phaseOrderSlots ?? [])
    .filter((s) => s.phase_key === phaseKey && s.subrole_key === subroleKey)
    .sort((a, b) => a.order_index - b.order_index)
}

export function prepareAccessSubroleSequence(taxonomy: Taxonomy | null | undefined): PhaseSubroleTaxonomyItem[] {
  return subroleSequenceForPhase(taxonomy, PREPARE_AND_ACCESS)
}

export function skillMovementSubroleSequence(taxonomy: Taxonomy | null | undefined): PhaseSubroleTaxonomyItem[] {
  return subroleSequenceForPhase(taxonomy, MOVEMENT_INTELLIGENCE)
}

export function outputSubroleSequence(taxonomy: Taxonomy | null | undefined): PhaseSubroleTaxonomyItem[] {
  return subroleSequenceForPhase(taxonomy, 'output')
}

export function capacitySubroleSequence(taxonomy: Taxonomy | null | undefined): PhaseSubroleTaxonomyItem[] {
  return subroleSequenceForPhase(taxonomy, 'capacity')
}

export function subroleSequenceForPhase(
  taxonomy: Taxonomy | null | undefined,
  phaseKey: string,
): PhaseSubroleTaxonomyItem[] {
  return (taxonomy?.phaseSubroles ?? [])
    .filter((s) => s.phase_key === phaseKey)
    .sort((a, b) => a.order_index - b.order_index)
}

export function orderSlotLabel(
  taxonomy: Taxonomy | null | undefined,
  orderSlotKey: string | null | undefined,
): string | null {
  if (!orderSlotKey) return null
  return taxonomy?.phaseOrderSlots?.find((s) => s.key === orderSlotKey)?.name ?? orderSlotKey.replace(/_/g, ' ')
}

/** Canonical session phase order enforced in builder + validator. */
export const SESSION_PHASE_ORDER = [
  'prepare_and_access',
  'movement_intelligence',
  'output',
  'capacity',
  'resilience',
  'sustained_capacity',
  'restore',
] as const

export type SessionPhaseKey = (typeof SESSION_PHASE_ORDER)[number]

export const TENETS: Tenet[] = [
  { key: 'strength', name: 'Strength', description: 'Ability to exert force against resistance.', detail: 'Building foundational power through resistance training, calisthenics, and bodyweight movements to create a robust athletic base.' },
  { key: 'explosiveness', name: 'Explosiveness', description: 'Exert maximal force in minimal time.', detail: 'Developing explosive movement capability through plyometrics, jumping drills, and fast-twitch muscle activation for superior athletic performance.' },
  { key: 'speed', name: 'Speed', description: 'Rapid execution of movement and reaction.', detail: 'Enhancing neuromuscular response times and quickness through sprint work, agility drills, and reaction training.' },
  { key: 'agility', name: 'Agility', description: 'Rapid direction changes with control.', detail: 'Mastering multi-directional movement with precision and balance through ladder drills, cones, and spatial awareness exercises.' },
  { key: 'flexibility', name: 'Flexibility/Mobility', description: 'Range of motion and muscular elasticity.', detail: 'Improving functional mobility and movement efficiency through targeted stretching, dynamic warm-ups, and range-of-motion exercises.' },
  { key: 'balance', name: 'Balance', description: 'Maintain stability in static or dynamic movement.', detail: 'Building proprioceptive awareness through beam work, stability challenges, and single-leg exercises for superior body control.' },
  { key: 'coordination', name: 'Coordination', description: 'Integrate multiple body parts for fluid motion.', detail: 'Developing seamless movement patterns through complex drills, multi-plane exercises, and neural synchronization training.' },
  { key: 'body_control', name: 'Body Control', description: 'Kinematic awareness - Precise understanding of where the body is in space.', detail: "Achieving exceptional spatial awareness through gymnastics-based training, air sense development, and proprioceptive exercises that translate to any sport." },
]

/**
 * The public-facing v2 methodology layer deliberately excludes training
 * families (for example Calisthenics), adaptations (Hypertrophy), tenets
 * (Balance and Mobility), physiology (Neural), niches (Core/Grip/Rotation),
 * and programming protocols (HIIT). Legacy values remain available through
 * the database taxonomy and migration mapping for source lineage only.
 */
export const TRAINING_METHODOLOGIES: Methodology[] = [
  { key: 'plyometric', name: 'Plyometric', description: 'Uses a controlled stretch–shortening cycle for elastic output.' },
  { key: 'ballistic', name: 'Ballistic', description: 'Accelerates an implement or body segment through the intended finish.' },
  { key: 'isometric', name: 'Isometric', description: 'Uses a deliberate static contraction at a defined position and intent.' },
  { key: 'eccentric_emphasis', name: 'Eccentric Emphasis', description: 'Prioritizes controlled lowering and force absorption.' },
  { key: 'eccentric_only', name: 'Eccentric-Only', description: 'Uses a deliberately isolated lowering or absorption task with an approved return method.' },
  { key: 'eccentric_overload', name: 'Eccentric Overload', description: 'Uses an approved overload only in the lowering phase.' },
  { key: 'concentric_only', name: 'Concentric-Only', description: 'Removes or minimizes the lowering phase for a specific intent.' },
  { key: 'tempo_controlled', name: 'Tempo-Controlled', description: 'Uses prescribed cadence to control time under tension or learning.' },
  { key: 'paused', name: 'Paused', description: 'Uses a deliberate stop at a defined position before continuing.' },
  { key: 'resisted', name: 'Resisted', description: 'Adds externally directed resistance while preserving the movement identity.' },
  { key: 'assisted_overspeed', name: 'Assisted/Overspeed', description: 'Uses approved assistance or overspeed only when readiness and safety fit.' },
  { key: 'accommodating_resistance', name: 'Accommodating Resistance', description: 'Varying resistance changes across the range through an approved tool.' },
  { key: 'variable_resistance', name: 'Variable Resistance', description: 'Resistance varies intentionally across a repetition or task.' },
  { key: 'perturbation', name: 'Perturbation', description: 'A controlled disturbance challenges an organized position or response.' },
  { key: 'instability', name: 'Instability', description: 'A constrained, intentional instability changes the control demand.' },
  { key: 'blood_flow_restriction', name: 'Blood-Flow Restriction', description: 'A specialized, governed method requiring its own safeguards.' },
  { key: 'velocity_based', name: 'Velocity-Based', description: 'Velocity targets or feedback govern load, intent, or stop decisions.' },
]

export const PHYSIOLOGICAL_EMPHASIS: PhysiologicalEmphasis[] = [
  { key: 'neural_output_readiness', name: 'Neural Output & Readiness', systems: 'Central Nervous System, Reflex Arc', purpose: 'Maximize motor unit recruitment and firing speed', outcomes: ['Faster reaction time', 'Improved rate of force development', 'Enhanced movement intent and explosiveness'] },
  { key: 'force_tissue_capacity', name: 'Force Capacity & Tissue Capacity', systems: 'Muscle, Tendon, Joint', purpose: 'Build structural tolerance and force production capability', outcomes: ['Strength and hypertrophy', 'Joint integrity and durability', 'Improved force absorption and expression'] },
  { key: 'ssc_stiffness', name: 'SSC & Stiffness (Elastic Energy)', systems: 'Tendons, Fascia, Muscle-Tendon Unit', purpose: 'Optimize stretch–shortening cycle efficiency', outcomes: ['Reactive power', 'Shorter ground contact times', 'Improved elastic resilience'] },
  { key: 'control_stability', name: 'Control & Stability', systems: 'Core, Proprioceptors, Stabilizing Musculature', purpose: 'Maintain positional integrity under load and speed', outcomes: ['Balance and postural control', 'Precision in deceleration and landing', 'Reduced injury risk'] },
  { key: 'perception_action_skill', name: 'Perception–Action Skill (Movement Intelligence)', systems: 'Brain–Body Integration', purpose: 'Improve movement patterning and adaptability', outcomes: ['Better timing and coordination', 'Enhanced spatial awareness', 'Transferable athletic skill across sports'] },
  { key: 'energy_systems_repeatability', name: 'Energy Systems & Repeatability', systems: 'Aerobic and Anaerobic Energy Pathways', purpose: 'Sustain movement quality over repeated efforts', outcomes: ['Improved work capacity', 'Faster recovery between actions', 'Consistent performance under fatigue'], is_optional: true },
]

let cached: Taxonomy | null = null

/** Fetch live taxonomy (with ids) for the coach portal. Cached per session. */
export async function fetchTaxonomy(force = false): Promise<Taxonomy> {
  if (cached && !force) return cached
  const data = await coachFetch<Taxonomy>('/api/coach/taxonomy')
  cached = data
  return data
}

export const FACET_LABELS: Record<FacetType, string> = {
  tenet: 'Tenet',
  methodology: 'Methodology',
  physiology: 'Physiological Emphasis',
  pattern: 'Movement Pattern',
  equipment: 'Equipment',
  sport: 'Sport',
  intent: 'Legacy intent',
  body_region: 'Body Region',
}
