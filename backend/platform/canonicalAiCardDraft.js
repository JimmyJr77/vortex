import { evaluateCanonicalCardReadiness, validateCanonicalCardDraft } from './canonicalCardAuthoring.js'

export function quarantineAiExerciseCardDraft(raw, metadata = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('AI card draft must be a structured object.')
  }
  const prohibited = ['status', 'approvedBy', 'approved_by', 'reviewedBy', 'reviewed_by', 'approvedVideoUrl', 'approved_video_url']
  const present = prohibited.filter((field) => raw[field] != null)
  if (present.length > 0) {
    throw new TypeError(`AI card draft contains prohibited production fields: ${present.join(', ')}`)
  }
  const prepared = {
    ...raw,
    contentConfidence: Math.min(60, Number(raw.contentConfidence) || 40),
    scoringConfidence: Math.min(60, Number(raw.scoringConfidence) || 40),
    mediaConfidence: null,
    approvedVideoUrl: null,
    requiredEquipment: raw.requiredEquipment ?? [],
    optionalEquipment: raw.optionalEquipment ?? [],
    environment: {},
    population: {},
    variants: (raw.variants ?? []).map((variant) => ({
      ...variant,
      modifierKeys: [],
      requirements: {},
      profiles: (variant.profiles ?? []).map((profile) => ({
        ...profile,
        role: 'primary',
        objectiveRelevance: { default: 50 },
        dosage: {
          sets: [profile.dosage?.setsMin, profile.dosage?.setsMax],
          reps: profile.dosage?.repsMin == null ? null : [profile.dosage.repsMin, profile.dosage.repsMax],
          workSeconds: profile.dosage?.workSeconds,
          restSeconds: profile.dosage?.restSeconds,
        },
        equipmentRequired: raw.requiredEquipment ?? [],
        logistics: {},
      })),
    })),
  }
  const validation = validateCanonicalCardDraft(prepared)
  if (!validation.valid) {
    throw Object.assign(new TypeError('AI card draft failed canonical draft validation.'), {
      details: validation,
    })
  }
  const draft = {
    ...validation.normalized,
    status: 'draft',
    provenance: {
      source: 'ai_assisted_draft',
      modelVersion: metadata.modelVersion ?? null,
      humanReviewRequired: true,
      assumptions: Array.isArray(raw.assumptions) ? raw.assumptions : [],
      uncertainties: Array.isArray(raw.uncertainties) ? raw.uncertainties : [],
    },
  }
  return {
    draft,
    readiness: evaluateCanonicalCardReadiness(draft),
  }
}
