import { useEffect, useState } from 'react'
import { coachFetch } from '../../coach/api'

export interface CoachClass {
  id: number
  program_id?: number | null
  class_iteration_id?: number | null
  program_name?: string | null
  class_iteration_label?: string | null
}

export interface RosterMember {
  id: number
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  has_completed_waivers: boolean
  required_count?: number
  accepted_count?: number
  attendance_status?: string | null
  note?: string | null
}

export function useCoachClasses() {
  const [classes, setClasses] = useState<CoachClass[]>([])
  useEffect(() => {
    coachFetch<CoachClass[]>('/api/coach/classes').then(setClasses).catch(() => setClasses([]))
  }, [])
  return classes
}
