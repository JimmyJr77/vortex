export const MEMBER_PORTAL_TAB_KEYS = [
  'home',
  'profile',
  'classes',
  'training',
  'progress',
  'messages',
  'events',
  'billing',
  'waivers',
]

export const COACH_PORTAL_TAB_KEYS = [
  'home',
  'sessions',
  'needs',
  'library',
  'workout',
  'warmup',
  'programs',
  'challenges',
  'assess',
  'skills',
  'assign',
  'messages',
  'reviews',
  'insights',
  'roster',
]

export const MEMBER_PORTAL_LOCKED_TABS = new Set(['home'])
export const COACH_PORTAL_LOCKED_TABS = new Set(['home'])

export const MEMBER_PORTAL_TAB_LABELS = {
  home: 'Home',
  profile: 'Profile',
  classes: 'Classes',
  training: 'Training',
  progress: 'Progress',
  messages: 'Messages',
  events: 'Events',
  billing: 'Billing',
  waivers: 'Waivers',
}

export const COACH_PORTAL_TAB_LABELS = {
  home: 'Home',
  sessions: 'Today',
  needs: 'Needs Engine',
  library: 'Library',
  workout: 'Workouts',
  warmup: 'Warmups',
  programs: 'Programs',
  challenges: 'Challenges',
  assess: 'Assess',
  skills: 'Skill Tree',
  assign: 'Assign',
  messages: 'Messages',
  reviews: 'Form Review',
  insights: 'Insights',
  roster: 'Roster',
}

async function getDefaultFacilityId(pool) {
  const res = await pool.query('SELECT id FROM facility LIMIT 1')
  return res.rows[0]?.id ?? null
}

export async function ensurePortalConfigSchema(pool) {
  await pool.query(`
    ALTER TABLE facility
      ADD COLUMN IF NOT EXISTS portal_config JSONB NOT NULL DEFAULT '{}'::jsonb
  `)
}

function normalizeHiddenTabs(portal, hiddenTabs) {
  const valid = portal === 'member' ? MEMBER_PORTAL_TAB_KEYS : COACH_PORTAL_TAB_KEYS
  const locked = portal === 'member' ? MEMBER_PORTAL_LOCKED_TABS : COACH_PORTAL_LOCKED_TABS
  if (!Array.isArray(hiddenTabs)) return []
  return [...new Set(hiddenTabs.map(String))].filter((tab) => valid.includes(tab) && !locked.has(tab))
}

export function normalizePortalConfig(raw = {}) {
  return {
    member: { hiddenTabs: normalizeHiddenTabs('member', raw?.member?.hiddenTabs) },
    coach: { hiddenTabs: normalizeHiddenTabs('coach', raw?.coach?.hiddenTabs) },
  }
}

export async function loadPortalConfig(pool, facilityId = null) {
  await ensurePortalConfigSchema(pool)
  const fid = facilityId ?? (await getDefaultFacilityId(pool))
  if (!fid) return normalizePortalConfig({})
  const res = await pool.query('SELECT portal_config FROM facility WHERE id = $1', [fid])
  return normalizePortalConfig(res.rows[0]?.portal_config ?? {})
}

export async function savePortalConfig(pool, partialConfig, facilityId = null) {
  await ensurePortalConfigSchema(pool)
  const fid = facilityId ?? (await getDefaultFacilityId(pool))
  if (!fid) {
    throw new Error('No facility found')
  }
  const current = await loadPortalConfig(pool, fid)
  const next = normalizePortalConfig({
    member: partialConfig.member ?? current.member,
    coach: partialConfig.coach ?? current.coach,
  })
  await pool.query(
    `UPDATE facility SET portal_config = $2::jsonb, updated_at = now() WHERE id = $1`,
    [fid, JSON.stringify(next)],
  )
  return next
}

export function getHiddenTabsForPortal(portal, config) {
  return portal === 'member' ? config.member.hiddenTabs : config.coach.hiddenTabs
}
