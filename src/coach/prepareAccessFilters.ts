/** Canonical session_need keys for Prepare & Access pairing_logic.good_for_sessions */
export const PREPARE_SESSION_NEED_OPTIONS = [
  { key: 'tumbling_prep', label: 'Tumbling prep' },
  { key: 'sprint_prep', label: 'Sprint prep' },
  { key: 'squat_prep', label: 'Squat prep' },
  { key: 'overhead_prep', label: 'Overhead prep' },
  { key: 'landing_prep', label: 'Landing prep' },
  { key: 'crawling_prep', label: 'Crawling prep' },
  { key: 'general_warmup', label: 'General warmup' },
  { key: 'low_readiness_reset', label: 'Low readiness reset' },
] as const
