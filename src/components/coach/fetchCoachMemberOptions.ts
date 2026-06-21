import { coachFetch } from '../../coach/api'
import type { CoachClass, RosterMember } from './useCoachClasses'

export interface SimpleMember {
  id: number
  name: string
}

/** Load athletes for coach pickers; falls back to class rosters when /api/coach/members is unavailable. */
export async function fetchCoachMemberOptions(scope: 'my_classes' | 'all'): Promise<SimpleMember[]> {
  try {
    return await coachFetch<SimpleMember[]>(`/api/coach/members?scope=${scope}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    const isMissingRoute = /404|route not found/i.test(message)
    if (!isMissingRoute && scope === 'all') throw err
    if (!isMissingRoute && scope === 'my_classes') throw err

    if (scope === 'all') {
      throw new Error(
        'Loading all facility athletes requires a backend update. Use “My athletes” or redeploy the API.',
      )
    }

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
}
