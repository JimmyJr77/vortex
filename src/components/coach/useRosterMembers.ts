import { useEffect, useState } from 'react'
import { fetchCoachMemberOptions, type SimpleMember } from './fetchCoachMemberOptions'

/** Aggregates a de-duplicated member list across all of a coach's classes. */
export function useRosterMembers(scope: 'my_classes' | 'all' = 'all') {
  const [members, setMembers] = useState<SimpleMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const list = await fetchCoachMemberOptions(scope)
        if (active) setMembers(list)
      } catch {
        if (active) setMembers([])
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [scope])

  return { members, loading }
}
