import type { MemberTab } from '../components/MemberDashboard'
import type { CoachTab } from '../components/coach/CoachLayout'

export interface PortalTabConfig {
  member: { hiddenTabs: MemberTab[] }
  coach: { hiddenTabs: CoachTab[] }
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
]

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
