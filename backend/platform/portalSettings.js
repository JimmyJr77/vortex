/** Keep in sync with MEMBER_PORTAL_TAB_OPTIONS in src/utils/portalTabConfig.ts */
export const MEMBER_PORTAL_TAB_KEYS = [
  'home',
  'profile',
  'classes',
  'training',
  'progress',
  'messages',
  'faqs',
  'events',
  'billing',
  'waivers',
  'preferences',
]

/** Keep in sync with COACH_PORTAL_TAB_OPTIONS in src/utils/portalTabConfig.ts */
export const COACH_PORTAL_TAB_KEYS = [
  'home',
  'sessions',
  'needs',
  'library',
  'framework',
  'workout',
  'warmup',
  'programs',
  'training-blocks',
  'regimens',
  'challenges',
  'assess',
  'skills',
  'assign',
  'messages',
  'faqs',
  'reviews',
  'insights',
  'roster',
  'preferences',
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
  faqs: 'FAQs',
  events: 'Events',
  billing: 'Billing',
  waivers: 'Waivers',
  preferences: 'Preferences',
}

export const COACH_PORTAL_TAB_LABELS = {
  home: 'Home',
  sessions: 'Today',
  needs: 'Needs Engine',
  library: 'Library',
  framework: 'Philosophy',
  workout: 'Workouts',
  warmup: 'Warmups',
  programs: 'Programs',
  'training-blocks': 'Blocks',
  regimens: 'Regimens',
  challenges: 'Challenges',
  assess: 'Assess',
  skills: 'Skill Tree',
  assign: 'Assign',
  messages: 'Messages',
  faqs: 'FAQ library',
  reviews: 'Form Review',
  insights: 'Insights',
  roster: 'Roster',
  preferences: 'Preferences',
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

function normalizeTabOrder(portal, tabOrder) {
  const valid = portal === 'member' ? MEMBER_PORTAL_TAB_KEYS : COACH_PORTAL_TAB_KEYS
  if (!Array.isArray(tabOrder)) return [...valid]
  const selected = [...new Set(tabOrder.map(String))].filter((tab) => valid.includes(tab))
  return [...selected, ...valid.filter((tab) => !selected.includes(tab))]
}

function normalizeNavLayout(portal, navLayout, tabOrder) {
  const valid = portal === 'member' ? MEMBER_PORTAL_TAB_KEYS : COACH_PORTAL_TAB_KEYS
  const fallbackOrder = normalizeTabOrder(portal, tabOrder)
  if (!Array.isArray(navLayout) || navLayout.length === 0) {
    return fallbackOrder.map((key) => ({ type: 'tab', key }))
  }

  const seen = new Set()
  const result = []

  for (const entry of navLayout) {
    if (entry && typeof entry === 'object' && entry.type === 'section') {
      const label = String(entry.label ?? '').trim().slice(0, 60)
      if (!label) continue
      const id =
        typeof entry.id === 'string' && entry.id.trim()
          ? entry.id.trim().slice(0, 80)
          : `section-${result.length + 1}`
      result.push({ type: 'section', id, label })
      continue
    }

    const keyRaw =
      entry && typeof entry === 'object' && entry.type === 'tab'
        ? entry.key
        : entry && typeof entry === 'object'
          ? entry.key
          : entry
    const key = String(keyRaw ?? '')
    if (!valid.includes(key) || seen.has(key)) continue
    seen.add(key)
    result.push({ type: 'tab', key })
  }

  for (const key of fallbackOrder) {
    if (!seen.has(key)) {
      result.push({ type: 'tab', key })
    }
  }

  return result
}

function normalizePortalSidebar(portal, raw = {}) {
  const tabOrder = normalizeTabOrder(portal, raw?.tabOrder)
  const navLayout = normalizeNavLayout(portal, raw?.navLayout, tabOrder)
  return {
    hiddenTabs: normalizeHiddenTabs(portal, raw?.hiddenTabs),
    tabOrder: navLayout.filter((item) => item.type === 'tab').map((item) => item.key),
    navLayout,
  }
}

export function normalizePortalConfig(raw = {}) {
  return {
    member: normalizePortalSidebar('member', raw?.member),
    coach: normalizePortalSidebar('coach', raw?.coach),
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
