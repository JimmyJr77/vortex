import type { MemberTab } from '../components/MemberDashboard'
import type { CoachTab } from '../components/coach/CoachLayout'

export type PortalNavLayoutItem =
  | { type: 'tab'; key: string }
  | { type: 'section'; id: string; label: string }

export type PortalNavRenderItem<T> =
  | { type: 'section'; id: string; label: string }
  | { type: 'nav'; item: T }

export interface PortalSidebarConfig<T extends string = string> {
  hiddenTabs: T[]
  tabOrder: T[]
  navLayout: PortalNavLayoutItem[]
}

export interface PortalTabConfig {
  member: PortalSidebarConfig<MemberTab>
  coach: PortalSidebarConfig<CoachTab>
}

export const DEFAULT_COACH_PORTAL_NAV_LAYOUT: PortalNavLayoutItem[] = [
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

const LEGACY_COACH_TAB_ALIASES: Record<string, string> = {
  workout: 'program-planner',
  'training-blocks': 'program-planner',
  regimens: 'program-planner',
}

function canonicalPortalTabKey<T extends string>(key: unknown, validKeys: readonly T[]): T {
  const rawKey = String(key ?? '')
  return String(validKeys.includes('program-planner' as T) ? LEGACY_COACH_TAB_ALIASES[rawKey] ?? rawKey : rawKey) as T
}

export function defaultPortalSidebarConfig(portal: 'member' | 'coach'): PortalSidebarConfig {
  const navLayout = portal === 'coach'
    ? DEFAULT_COACH_PORTAL_NAV_LAYOUT.map((item) => ({ ...item }))
    : MEMBER_PORTAL_TAB_OPTIONS.map(({ key }) => ({ type: 'tab' as const, key }))
  return { hiddenTabs: [], tabOrder: tabOrderFromNavLayout(navLayout), navLayout }
}

export function tabOrderFromNavLayout<T extends string>(layout: PortalNavLayoutItem[]): T[] {
  return layout
    .filter((item): item is { type: 'tab'; key: string } => item.type === 'tab')
    .map((item) => item.key as T)
}

export function normalizeNavLayout<T extends string>(
  raw: unknown,
  validKeys: readonly T[],
  tabOrder?: readonly T[],
): PortalNavLayoutItem[] {
  const requestedOrder = (tabOrder?.length ? [...tabOrder] : [...validKeys])
    .map((key) => canonicalPortalTabKey(key, validKeys))
    .filter((key, index, keys) => validKeys.includes(key) && keys.indexOf(key) === index)
  const fallbackOrder = [...requestedOrder, ...validKeys.filter((key) => !requestedOrder.includes(key))]
  const entries = Array.isArray(raw) && raw.length > 0 ? raw : fallbackOrder

  const seen = new Set<T>()
  const result: PortalNavLayoutItem[] = []

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
    const key = canonicalPortalTabKey(keyRaw, validKeys)
    if (!validKeys.includes(key) || seen.has(key)) continue
    seen.add(key)
    result.push({ type: 'tab', key })
  }

  for (const key of fallbackOrder) {
    if (!seen.has(key)) {
      result.push({ type: 'tab', key })
    }
  }

  const athleteDevelopmentIndex = result.findIndex(
    (item) => item.type === 'section' && (item.id === 'athlete-dev' || item.label.toLowerCase() === 'athlete development'),
  )
  const evaluationIndex = result.findIndex((item) => item.type === 'tab' && item.key === 'gymnastics-evaluations')
  if (athleteDevelopmentIndex >= 0 && evaluationIndex >= 0) {
    const [evaluation] = result.splice(evaluationIndex, 1)
    result.splice(athleteDevelopmentIndex + (evaluationIndex < athleteDevelopmentIndex ? 0 : 1), 0, evaluation)
  }

  return result
}

export function buildPortalNavRenderList<T extends string, NavItem>(
  navItems: NavItem[],
  layout: PortalNavLayoutItem[] | undefined,
  tabOrder: T[] | undefined,
  hiddenTabs: T[] | undefined,
  getTab: (item: NavItem) => T,
): PortalNavRenderItem<NavItem>[] {
  const validKeys = navItems.map(getTab)
  const normalized = normalizeNavLayout(layout, validKeys, tabOrder)
  const navByTab = new Map(validKeys.map((tab, index) => [tab, navItems[index]]))
  const out: PortalNavRenderItem<NavItem>[] = []
  let pendingSection: { id: string; label: string } | null = null

  for (const entry of normalized) {
    if (entry.type === 'section') {
      pendingSection = { id: entry.id, label: entry.label }
      continue
    }

    const item = navByTab.get(entry.key as T)
    if (!item || !isPortalTabVisible(entry.key as T, hiddenTabs)) continue

    if (pendingSection) {
      out.push({ type: 'section', ...pendingSection })
      pendingSection = null
    }
    out.push({ type: 'nav', item })
  }

  return out
}

export function createPortalSectionBreak(label = 'Section'): PortalNavLayoutItem {
  return {
    type: 'section',
    id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
  }
}

export const MEMBER_PORTAL_TAB_OPTIONS: Array<{ key: MemberTab; label: string; locked?: boolean }> = [
  { key: 'home', label: 'Home', locked: true },
  { key: 'profile', label: 'Profile' },
  { key: 'classes', label: 'Classes' },
  { key: 'training', label: 'Training' },
  { key: 'progress', label: 'Progress' },
  { key: 'messages', label: 'Messages' },
  { key: 'faqs', label: 'FAQs' },
  { key: 'events', label: 'Events' },
  { key: 'store', label: 'Store' },
  { key: 'billing', label: 'Billing' },
  { key: 'waivers', label: 'Waivers' },
  { key: 'preferences', label: 'Preferences' },
]

export const COACH_PORTAL_TAB_OPTIONS: Array<{ key: CoachTab; label: string; locked?: boolean }> = [
  { key: 'home', label: 'Home', locked: true },
  { key: 'messages', label: 'Messages' },
  { key: 'sessions', label: 'Today' },
  { key: 'roster', label: 'Roster' },
  { key: 'framework', label: 'Philosophy' },
  { key: 'library', label: 'Library' },
  { key: 'needs', label: 'Program Generator' },
  { key: 'program-planner', label: 'Program Planner' },
  { key: 'prepare-access', label: 'Prepare & Access' },
  { key: 'athleticism-accelerator', label: 'Custom Programs' },
  { key: 'programs', label: 'ABC Progressions' },
  { key: 'flip-fit', label: 'Flip & Fit' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'gymnastics-evaluations', label: 'Evaluation Form' },
  { key: 'skills', label: 'Skill Tree' },
  { key: 'assign', label: 'Assign' },
  { key: 'reviews', label: 'Form Review' },
  { key: 'insights', label: 'Insights' },
  { key: 'faqs', label: 'FAQ library' },
  { key: 'preferences', label: 'Preferences' },
]

export const MEMBER_PORTAL_HOME_CARD_COPY: Record<
  Exclude<MemberTab, 'home'>,
  { title: string; description: string }
> = {
  profile: { title: 'Profile', description: 'Your account and family members.' },
  classes: { title: 'Classes', description: 'Current enrollments and class signups.' },
  training: { title: 'Training', description: 'Your assigned workouts and programs.' },
  progress: { title: 'Progress', description: 'PRs, goals, and achievements.' },
  messages: { title: 'Messages', description: 'Talk with your coaches.' },
  faqs: { title: 'FAQs', description: 'Answers curated by your coaches and staff.' },
  events: { title: 'Events', description: 'Upcoming events and signups.' },
  store: { title: 'Store', description: 'Shop Vortex gear and front-desk essentials for gym pickup.' },
  billing: { title: 'Billing', description: 'Statements and payment history.' },
  waivers: { title: 'Waivers', description: 'Review and sign required waivers.' },
  preferences: { title: 'Preferences', description: 'Critical alerts and notification settings.' },
}

export const COACH_PORTAL_HOME_CARD_COPY: Record<
  Exclude<CoachTab, 'home'>,
  { title: string; description: string }
> = {
  sessions: { title: "Today's Sessions", description: 'Run a class: attendance and group logging.' },
  needs: { title: 'Program Generator', description: 'Describe a need and generate a time-packed session.' },
  library: { title: 'Exercise Library', description: 'Search and tag the movement library.' },
  'program-planner': { title: 'Program Planner', description: 'Build workouts from exercise cards, then organize blocks and regimens.' },
  'prepare-access': { title: 'Prepare & Access', description: 'Choose and inspect the preparation routine for a training day.' },
  'athleticism-accelerator': { title: 'Custom Programs', description: 'View custom athletic plans by class, daily equipment, and coaching cues.' },
  framework: { title: 'Training Philosophy', description: 'Explore the Athleticism Accelerator taxonomy — phases, tenets, methodologies, order slots, session models, and validation rules.' },
  programs: { title: 'ABC Progressions', description: 'Browse and build structured athletic progressions.' },
  'flip-fit': { title: 'Flip & Fit', description: 'Build and manage the 12-week athlete development schedule.' },
  challenges: { title: 'Challenges', description: 'Run scored competitions.' },
  'gymnastics-evaluations': { title: 'Evaluation Form', description: 'Score gymnastics movements and publish athlete focus reports.' },
  skills: { title: 'Skill Tree', description: 'Prerequisite progressions and mastery.' },
  assign: { title: 'Assign & Share', description: 'Push plans to athletes.' },
  messages: { title: 'Messages', description: 'Talk with athletes, coaches, and admins.' },
  faqs: { title: 'FAQ library', description: 'Manage conversation FAQs and member menu entries.' },
  reviews: { title: 'Form Review', description: 'Review athlete video submissions.' },
  insights: { title: 'Insights', description: 'Load, readiness, PRs, and trends.' },
  roster: { title: 'Roster', description: 'Attendance, notes, waivers.' },
  preferences: { title: 'Preferences', description: 'Critical alerts and notification settings.' },
}

export function isPortalTabVisible<T extends string>(tab: T, hiddenTabs: T[] | undefined): boolean {
  return !(hiddenTabs ?? []).includes(tab)
}

export function firstVisiblePortalTab<T extends string>(
  tabs: T[],
  hiddenTabs: T[] | undefined,
  fallback: T,
): T {
  return tabs.find((tab) => isPortalTabVisible(tab, hiddenTabs)) ?? fallback
}

export function orderPortalItems<T extends string, Item>(
  items: Item[],
  tabOrder: T[] | undefined,
  getKey: (item: Item) => T,
): Item[] {
  const rank = new Map((tabOrder ?? []).map((tab, index) => [tab, index]))
  return [...items].sort((a, b) => {
    const aRank = rank.get(getKey(a)) ?? Number.MAX_SAFE_INTEGER
    const bRank = rank.get(getKey(b)) ?? Number.MAX_SAFE_INTEGER
    if (aRank !== bRank) return aRank - bRank
    return items.indexOf(a) - items.indexOf(b)
  })
}
