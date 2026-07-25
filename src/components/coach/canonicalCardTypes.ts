export type CanonicalCardStatus = 'draft' | 'review' | 'published' | 'deprecated' | 'archived'

export interface CanonicalDeliveryProfile {
  id?: string | null
  profileKey: string
  phaseKey: string
  role: string
  purpose: string
  phaseSuitability: number
  methodologyAlignment: number
  objectiveRelevance: Record<string, number>
  dosage: Record<string, unknown>
  qualityGate: string
  stopRules: string[]
  coachInstructions: string
  athleteInstructions: string
  expectedAdaptation: string
  equipmentRequired: string[]
  logistics: Record<string, unknown>
  timeModel: Record<string, unknown>
  doseScaling: Record<string, unknown>
  measurement: Record<string, unknown>
  supportPrompts: Record<string, unknown>
}

export interface CanonicalVariant {
  id?: string | null
  variantKey: string
  displayName: string
  modifierKeys: string[]
  difficulty: Record<string, number>
  loadProfile: {
    gripDemand: number
    spinalLoading: number
    eccentricStress: number
    landingContactsPerRep: number
    externalLoadMethod: string
  }
  fatigueProfile: {
    localMuscleFatigue: number
    gripFatigue: number
    technicalFatigueSensitivity: number
    impactAccumulation: number
    recoveryHours: number
  }
  requirements: Record<string, unknown>
  programming: Record<string, unknown>
  profiles: CanonicalDeliveryProfile[]
}

export interface CanonicalCard {
  id?: string
  slug: string
  canonicalName: string
  displayName: string
  description: string | null
  aliases: string[]
  familyKey: string
  status: CanonicalCardStatus
  contentConfidence: number | null
  scoringConfidence: number | null
  mediaConfidence: number | null
  movementPatterns: string[]
  bodyRegions: string[]
  requiredEquipment: string[]
  optionalEquipment: string[]
  environment: Record<string, unknown>
  population: Record<string, unknown>
  athleteSupport: Record<string, unknown>
  coachSupport: Record<string, unknown>
  supportOperations: Record<string, unknown>
  anatomy: {
    primaryMuscles: string[]
    secondaryMuscles: string[]
    stabilizers: string[]
    joints: string[]
    jointActions: string[]
    planes: string[]
    laterality: string
  }
  approvedVideoUrl: string | null
  createdBy?: number | null
  updatedAt?: string
  variants: CanonicalVariant[]
  mediaReview?: {
    url: string
    exactVariantMatch: boolean
    demonstrationQualityScore: number | null
    linkStatus: 'pending' | 'healthy' | 'broken' | 'mismatched'
    notes?: string | null
  } | null
  readiness?: {
    ready: boolean
    issues: Array<{ code: string; path: string; message: string }>
  }
  testPacket?: {
    status: 'passed' | 'warning' | 'failed'
    checks: Array<{
      id: string
      category: string
      priority: 'P0' | 'P1' | 'P2'
      status: 'passed' | 'failed'
      message: string
      evidence: unknown
    }>
    summary: {
      total: number
      passed: number
      failed: number
      p0Failures: number
      p1Failures: number
      p2Failures: number
    }
  }
  reviews?: Array<{
    id: string
    decision: 'approve' | 'request_changes'
    notes: string
    reviewer_user_id: number
    created_at: string
  }>
  revisions?: Array<{
    id: string
    revision_number: number
    action: string
    change_summary: string | null
    created_at: string
  }>
  relationships?: Array<{
    id: string
    from_variant_id: string
    to_variant_id: string
    from_name: string
    to_name: string
    relationship: string
    similarity_score: number
    dimensions: string[]
    reason: string
    review_status: 'review' | 'approved' | 'rejected'
  }>
}

export interface CanonicalCardSummary {
  id: string
  slug: string
  canonical_name: string
  display_name: string
  family_key: string
  status: CanonicalCardStatus
  card_version: number
  variant_count: number
  profile_count: number
  updated_at: string
}
