import type { MemberTab } from '../components/MemberDashboard'
import type { CoachTab } from '../components/coach/CoachLayout'

export interface PortalTabConfig {
  member: { hiddenTabs: MemberTab[]; tabOrder: MemberTab[] }
  coach: { hiddenTabs: CoachTab[]; tabOrder: CoachTab[] }
}

export const MEMBER_PORTAL_TAB_OPTIONS: Array<{ key: MemberTab; label: string; locked?: boolean }> = [
  { key: 'home', label: 'Home', locked: true },
  { key: 'profile', label: 'Profile' },
  { key: 'classes', label: 'Classes' },
  { key: 'training', label: 'Training' },
  { key: 'progress', label: 'Progress' },
  { key: 'messages', label: 'Messages' },
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
  { key: 'workout', label: 'Workouts' },
  { key: 'warmup', label: 'Warmups' },
  { key: 'programs', label: 'Programs' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'assess', label: 'Assess' },
  { key: 'skills', label: 'Skill Tree' },
  { key: 'assign', label: 'Assign' },
  { key: 'messages', label: 'Messages' },
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
  workout: { title: 'Workout Builder', description: 'Build sessions with a live time clock.' },
  warmup: { title: 'Warmup Builder', description: 'Design quick activation routines.' },
  programs: { title: 'Training Programs', description: 'Sequence weeks of training.' },
  challenges: { title: 'Challenges', description: 'Run scored competitions.' },
  assess: { title: 'Assess & Grade', description: 'Record benchmarks and skills.' },
  skills: { title: 'Skill Tree', description: 'Prerequisite progressions and mastery.' },
  assign: { title: 'Assign & Share', description: 'Push plans to athletes.' },
  messages: { title: 'Messages', description: 'Talk with athletes, coaches, and admins.' },
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
