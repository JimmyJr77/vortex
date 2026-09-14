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
  'store',
  'billing',
  'waivers',
  'preferences',
]

/** Keep in sync with COACH_PORTAL_TAB_OPTIONS in src/utils/portalTabConfig.ts */
export const COACH_PORTAL_TAB_KEYS = [
  'home',
  'messages',
  'sessions',
  'roster',
  'framework',
  'library',
  'needs',
  'program-planner',
  'prepare-access',
  'athleticism-accelerator',
  'programs',
  'flip-fit',
  'challenges',
  'gymnastics-evaluations',
  'skills',
  'assign',
  'reviews',
  'insights',
  'faqs',
  'preferences',
]

export const DEFAULT_COACH_PORTAL_NAV_LAYOUT = [
  { type: 'tab', key: 'home' },
  { type: 'tab', key: 'messages' },
  { type: 'tab', key: 'sessions' },
  { type: 'tab', key: 'roster' },
  { type: 'section', id: 'session-design', label: 'Session Design' },
  { type: 'tab', key: 'framework' },
  { type: 'tab', key: 'library' },
  { type: 'tab', key: 'needs' },
  { type: 'tab', key: 'program-planner' },
  { type: 'section', id: 'training-plans', label: 'Training Plans' },
  { type: 'tab', key: 'prepare-access' },
  { type: 'tab', key: 'athleticism-accelerator' },
  { type: 'tab', key: 'programs' },
  { type: 'tab', key: 'flip-fit' },
  { type: 'tab', key: 'challenges' },
  { type: 'section', id: 'athlete-dev', label: 'Athlete Development' },
  { type: 'tab', key: 'gymnastics-evaluations' },
  { type: 'tab', key: 'skills' },
  { type: 'tab', key: 'assign' },
  { type: 'tab', key: 'reviews' },
  { type: 'tab', key: 'insights' },
  { type: 'section', id: 'administrative', label: 'Administrative' },
  { type: 'tab', key: 'faqs' },
  { type: 'tab', key: 'preferences' },
]

const LEGACY_COACH_TAB_ALIASES = {
  workout: 'program-planner',
  'training-blocks': 'program-planner',
  regimens: 'program-planner',
}

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
  store: 'Store',
  billing: 'Billing',
  waivers: 'Waivers',
  preferences: 'Preferences',
}

export const COACH_PORTAL_TAB_LABELS = {
  home: 'Home',
  messages: 'Messages',
  sessions: 'Today',
  roster: 'Roster',
  framework: 'Philosophy',
  library: 'Library',
  needs: 'Program Generator',
  'program-planner': 'Program Planner',
  'prepare-access': 'Prepare & Access',
  'athleticism-accelerator': 'Custom Programs',
  programs: 'ABC Progressions',
  'flip-fit': 'Flip & Fit',
  challenges: 'Challenges',
  'gymnastics-evaluations': 'Evaluation Form',
  skills: 'Skill Tree',
  assign: 'Assign',
  reviews: 'Form Review',
  insights: 'Insights',
  faqs: 'FAQ library',
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
  const selected = [...new Set(tabOrder.map((tab) => {
    const key = String(tab)
    return portal === 'coach' ? LEGACY_COACH_TAB_ALIASES[key] ?? key : key
  }))].filter((tab) => valid.includes(tab))
  return [...selected, ...valid.filter((tab) => !selected.includes(tab))]
}

function normalizeNavLayout(portal, navLayout, tabOrder) {
  const valid = portal === 'member' ? MEMBER_PORTAL_TAB_KEYS : COACH_PORTAL_TAB_KEYS
  const fallbackOrder = normalizeTabOrder(portal, tabOrder)
  const entries = Array.isArray(navLayout) && navLayout.length > 0 ? navLayout : fallbackOrder

  const seen = new Set()
  const result = []

  for (const entry of entries) {
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
    const rawKey = String(keyRaw ?? '')
    const key = portal === 'coach' ? LEGACY_COACH_TAB_ALIASES[rawKey] ?? rawKey : rawKey
    if (!valid.includes(key) || seen.has(key)) continue
    seen.add(key)
    result.push({ type: 'tab', key })
  }

  for (const key of fallbackOrder) {
    if (!seen.has(key)) {
      result.push({ type: 'tab', key })
    }
  }

  // Keep the dedicated gymnastics form with the facility's Athlete Development
  // group when that section is present in a customized coach navigation.
  if (portal === 'coach') {
    const sectionIndex = result.findIndex((item) => item.type === 'section' && (item.id === 'athlete-dev' || item.label.toLowerCase() === 'athlete development'))
    const evaluationIndex = result.findIndex((item) => item.type === 'tab' && item.key === 'gymnastics-evaluations')
    if (sectionIndex >= 0 && evaluationIndex >= 0) {
      const [evaluation] = result.splice(evaluationIndex, 1)
      result.splice(sectionIndex + (evaluationIndex < sectionIndex ? 0 : 1), 0, evaluation)
    }
  }

  return result
}

function normalizePortalSidebar(portal, raw = {}) {
  const hasSavedLayout = Array.isArray(raw?.navLayout) && raw.navLayout.length > 0
  const hasSavedOrder = Array.isArray(raw?.tabOrder) && raw.tabOrder.length > 0
  const defaultLayout = portal === 'coach'
    ? DEFAULT_COACH_PORTAL_NAV_LAYOUT
    : MEMBER_PORTAL_TAB_KEYS.map((key) => ({ type: 'tab', key }))
  const tabOrder = normalizeTabOrder(portal, hasSavedOrder ? raw.tabOrder : defaultLayout.filter((item) => item.type === 'tab').map((item) => item.key))
  const navLayout = normalizeNavLayout(
    portal,
    hasSavedLayout ? raw.navLayout : hasSavedOrder ? tabOrder.map((key) => ({ type: 'tab', key })) : defaultLayout,
    tabOrder,
  )
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
