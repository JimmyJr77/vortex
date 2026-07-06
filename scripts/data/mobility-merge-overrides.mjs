/**
 * Slug renames and merge rules for Prepare & Access mobility cards that overlap
 * existing exercise slugs with different phase intent.
 */

/** Integrate-card slug preserved; mobility variant gets a distinct slug. */
export const SLUG_RENAMES = {
  'squat-to-stand-with-reach': 'squat-to-stand-mobility-reach',
}

/** Existing slugs enriched by mobility hydration (no new insert). */
export const MERGE_SLUGS = new Set([
  'deep-squat-pry-with-reach',
  'quadruped-wrist-pronation-supination-shifts',
  'rocking-plank-to-down-dog',
])
