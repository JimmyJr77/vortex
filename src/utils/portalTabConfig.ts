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
  const fallbackOrder = tabOrder?.length ? [...tabOrder] : [...validKeys]
  if (!Array.isArray(raw) || raw.length === 0) {
    return fallbackOrder.map((key) => ({ type: 'tab' as const, key }))
  }

  const seen = new Set<T>()
  const result: PortalNavLayoutItem[] = []

  for (const entry of raw) {
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
    const key = String(keyRaw ?? '') as T
    if (!validKeys.includes(key) || seen.has(key)) continue
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
  { key: 'billing', label: 'Billing' },
  { key: 'waivers', label: 'Waivers' },
  { key: 'preferences', label: 'Preferences' },
]

export const COACH_PORTAL_TAB_OPTIONS: Array<{ key: CoachTab; label: string; locked?: boolean }> = [
  { key: 'home', label: 'Home', locked: true },
  { key: 'sessions', label: 'Today' },
  { key: 'needs', label: 'Needs Engine' },
  { key: 'library', label: 'Library' },
  { key: 'framework', label: 'Philosophy' },
  { key: 'workout', label: 'Workouts' },
  { key: 'warmup', label: 'Warmups' },
  { key: 'programs', label: 'Programs' },
  { key: 'training-blocks', label: 'Blocks' },
  { key: 'regimens', label: 'Regimens' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'assess', label: 'Assess' },
  { key: 'skills', label: 'Skill Tree' },
  { key: 'assign', label: 'Assign' },
  { key: 'messages', label: 'Messages' },
  { key: 'faqs', label: 'FAQ library' },
  { key: 'reviews', label: 'Form Review' },
  { key: 'insights', label: 'Insights' },
  { key: 'roster', label: 'Roster' },
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
  billing: { title: 'Billing', description: 'Statements and payment history.' },
  waivers: { title: 'Waivers', description: 'Review and sign required waivers.' },
  preferences: { title: 'Preferences', description: 'Critical alerts and notification settings.' },
}

export const COACH_PORTAL_HOME_CARD_COPY: Record<
  Exclude<CoachTab, 'home'>,
  { title: string; description: string }
> = {
  sessions: { title: "Today's Sessions", description: 'Run a class: attendance and group logging.' },
  needs: { title: 'Needs Engine', description: 'Describe a need, get a time-packed session.' },
  library: { title: 'Exercise Library', description: 'Search and tag the movement library.' },
  framework: { title: 'Training Philosophy', description: 'Explore the Athleticism Accelerator taxonomy — phases, tenets, methodologies, order slots, session models, and validation rules.' },
  workout: { title: 'Workout Builder', description: 'Build sessions with a live time clock.' },
  warmup: { title: 'Warmup Builder', description: 'Design quick activation routines.' },
  programs: { title: 'Training Programs', description: 'Sequence weeks of training.' },
  'training-blocks': { title: 'Training Blocks', description: 'Multi-day block templates with weekly rules.' },
  regimens: { title: 'Regimens', description: 'Evergreen phase-balanced training templates.' },
  challenges: { title: 'Challenges', description: 'Run scored competitions.' },
  assess: { title: 'Assess & Grade', description: 'Record benchmarks and skills.' },
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
