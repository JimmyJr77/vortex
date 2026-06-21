import { useEffect, useState } from 'react'
import { coachFetch } from '../../coach/api'
import type { CoachClass, RosterMember } from './useCoachClasses'

export interface SimpleMember {
  id: number
  name: string
}

/** Aggregates a de-duplicated member list across all of a coach's classes. */
export function useRosterMembers() {
  const [members, setMembers] = useState<SimpleMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const classes = await coachFetch<CoachClass[]>('/api/coach/classes')
        const rosters = await Promise.all(
          classes.map((c) => coachFetch<RosterMember[]>(`/api/coach/classes/${c.id}/roster`).catch(() => [] as RosterMember[])),
        )
        const map = new Map<number, SimpleMember>()
        for (const roster of rosters) {
          for (const m of roster) {
            map.set(m.id, { id: m.id, name: `${m.first_name} ${m.last_name}`.trim() })
          }
        }
        if (active) setMembers([...map.values()].sort((a, b) => a.name.localeCompare(b.name)))
      } catch {
        if (active) setMembers([])
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  return { members, loading }
}
