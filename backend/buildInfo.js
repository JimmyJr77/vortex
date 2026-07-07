/** Bumped when backend behavior changes — visible on GET /api/health and admin email status. */
export const API_BUILD_ID = 'needs-engine-schema-repair-2026-07-07-b'

/** Advertised on GET /api/health → apiFeatures for frontend capability checks. */
export const API_FEATURES = {
  programPricingCostOptions: true,
  multiClassPassPackages: true,
  evergreenOfferings: true,
  memberEnrollments: true,
  needsEngineTemplates: true,
  needsEngineRequirements: true,
}
