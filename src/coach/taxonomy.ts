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

export interface Taxonomy {
  tenets: Tenet[]
  methodologies: Methodology[]
  physiology: PhysiologicalEmphasis[]
  patterns: TaxonomyItem[]
  equipment: TaxonomyItem[]
  sports: TaxonomyItem[]
  intents: TaxonomyItem[]
  bodyRegions: TaxonomyItem[]
}

export const TENETS: Tenet[] = [
  { key: 'strength', name: 'Strength', description: 'Ability to exert force against resistance.', detail: 'Building foundational power through resistance training, calisthenics, and bodyweight movements to create a robust athletic base.' },
  { key: 'explosiveness', name: 'Explosiveness', description: 'Exert maximal force in minimal time.', detail: 'Developing explosive movement capability through plyometrics, jumping drills, and fast-twitch muscle activation for superior athletic performance.' },
  { key: 'speed', name: 'Speed', description: 'Rapid execution of movement and reaction.', detail: 'Enhancing neuromuscular response times and quickness through sprint work, agility drills, and reaction training.' },
  { key: 'agility', name: 'Agility', description: 'Rapid direction changes with control.', detail: 'Mastering multi-directional movement with precision and balance through ladder drills, cones, and spatial awareness exercises.' },
  { key: 'flexibility', name: 'Flexibility', description: 'Range of motion and muscular elasticity.', detail: 'Improving functional mobility and movement efficiency through targeted stretching, dynamic warm-ups, and range-of-motion exercises.' },
  { key: 'balance', name: 'Balance', description: 'Maintain stability in static or dynamic movement.', detail: 'Building proprioceptive awareness through beam work, stability challenges, and single-leg exercises for superior body control.' },
  { key: 'coordination', name: 'Coordination', description: 'Integrate multiple body parts for fluid motion.', detail: 'Developing seamless movement patterns through complex drills, multi-plane exercises, and neural synchronization training.' },
  { key: 'body_control', name: 'Body Control', description: 'Kinematic awareness - Precise understanding of where the body is in space.', detail: "Achieving exceptional spatial awareness through gymnastics-based training, air sense development, and proprioceptive exercises that translate to any sport." },
]

export const TRAINING_METHODOLOGIES: Methodology[] = [
  { key: 'resistance_calisthenics', name: 'Resistance & Calisthenics', description: 'Foundational strength and endurance building' },
  { key: 'plyometrics', name: 'Plyometrics', description: 'Explosive power and fast-twitch activation' },
  { key: 'isometrics', name: 'Isometrics', description: 'Tendon loading and joint stability' },
  { key: 'eccentric_negative', name: 'Eccentric/Negative Training', description: 'Controlled force development and injury prevention' },
  { key: 'neural', name: 'Neural Training', description: 'Speed, coordination, and reaction time enhancement' },
  { key: 'balance_stability', name: 'Balance & Stability Work', description: 'Proprioception and spatial control' },
  { key: 'mobility_flexibility', name: 'Mobility & Flexibility Drills', description: 'Full-range functional movement' },
  { key: 'core_body_control', name: 'Core & Body Control Work', description: 'Control, posture, and spatial awareness' },
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
  intent: 'Intent',
  body_region: 'Body Region',
}
