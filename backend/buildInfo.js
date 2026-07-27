/** Bumped when backend behavior changes — visible on GET /api/health and admin email status. */
export const API_BUILD_ID = 'household-checkout-totals-2026-07-27'

/** Advertised on GET /api/health → apiFeatures for frontend capability checks. */
export const API_FEATURES = {
  programPricingCostOptions: true,
  multiClassPassPackages: true,
  evergreenOfferings: true,
  memberEnrollments: true,
  needsEngineTemplates: true,
  needsEngineRequirements: true,
}
