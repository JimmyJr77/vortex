import { useEffect, useState } from 'react'
import { fetchClassesOffered } from '../../utils/publicClassesApi'
import { getRecurringBookingProgram, type RecurringBookingProgram } from '../../utils/publicBookingPrograms'

export default function usePublicDropInEligibility(programName: RecurringBookingProgram) {
  const [catalog, setCatalog] = useState<{ programName: RecurringBookingProgram; excluded: Map<number, boolean> } | null>(null)

  useEffect(() => {
    let active = true
    void fetchClassesOffered().then(({ programs }) => {
      const program = getRecurringBookingProgram(programs, programName)
      if (active) {
        setCatalog({ programName, excluded: new Map(program?.classes.map(classItem => [
          classItem.formId, (classItem.excludeFromDropIns ?? program.excludeFromDropIns) === true,
        ]) ?? []) })
      }
    }).catch(() => { /* Keep the published settings if the current catalog is unavailable. */ })
    return () => { active = false }
  }, [programName])

  return catalog?.programName === programName ? catalog.excluded : null
}
