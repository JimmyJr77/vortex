import { coachFetch } from '../../coach/api'
import type { CoachClass, RosterMember } from './useCoachClasses'

export interface SimpleMember {
  id: number
  name: string
}

type MemberScope = 'my_classes' | 'all'

const MEMBER_OPTION_ENDPOINTS: Record<MemberScope, string[]> = {
  my_classes: [
    '/api/coach/messages/member-options?scope=my_classes',
    '/api/coach/members?scope=my_classes',
  ],
  all: [
    '/api/coach/messages/member-options?scope=all',
    '/api/coach/members?scope=all',
  ],
}

function isRecoverableMemberListError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return /404|403|route not found|missing permission|insufficient permissions|request failed/i.test(message)
}

async function loadMembersFromClassRosters(): Promise<SimpleMember[]> {
  const classes = await coachFetch<CoachClass[]>('/api/coach/classes')
  const rosters = await Promise.all(
    classes.map((c) =>
      coachFetch<RosterMember[]>(`/api/coach/classes/${c.id}/roster`).catch(() => [] as RosterMember[]),
    ),
  )
  const map = new Map<number, SimpleMember>()
  for (const roster of rosters) {
    for (const m of roster) {
      map.set(m.id, { id: m.id, name: `${m.first_name} ${m.last_name}`.trim() })
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

async function tryMemberEndpoints(scope: MemberScope): Promise<SimpleMember[] | null> {
  for (const endpoint of MEMBER_OPTION_ENDPOINTS[scope]) {
    try {
      return await coachFetch<SimpleMember[]>(endpoint)
    } catch (err) {
      if (!isRecoverableMemberListError(err)) throw err
    }
  }
  return null
}

/** Load athletes for coach pickers; falls back to class rosters when member APIs are unavailable. */
export async function fetchCoachMemberOptions(scope: MemberScope): Promise<SimpleMember[]> {
  const fromApi = await tryMemberEndpoints(scope)
  if (fromApi) return fromApi

  if (scope === 'all') {
    throw new Error(
      'Loading all facility athletes requires a backend update. Use “My athletes” or redeploy the API.',
    )
  }

  return await loadMembersFromClassRosters()
}
