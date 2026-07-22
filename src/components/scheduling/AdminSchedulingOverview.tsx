import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import {
  fetchClassEvents,
  type ClassEvent,
  type TopProgram,
} from '../../utils/programsApi'
import { adminFetchOfferings } from '../../utils/schedulingApi'

interface Props {
  program: TopProgram
  onSaved: (program: TopProgram) => void
  onSelectClassEvent: (classEvent: ClassEvent) => void | Promise<void>
  onOpenOfferings: () => void
}

type SetupStatus = 'none' | 'partial' | 'ready'

async function classSetupStatus(classEvent: ClassEvent): Promise<SetupStatus> {
  if (!classEvent.schedulingFormId) return 'none'
  try {
    const offerings = await adminFetchOfferings(classEvent.schedulingFormId)
    if (offerings.length === 0) return 'partial'
    return 'ready'
  } catch {
    return 'partial'
  }
}

const AdminSchedulingOverview = ({
  program,
  onSelectClassEvent,
  onOpenOfferings,
}: Props) => {
  const [classEvents, setClassEvents] = useState<ClassEvent[]>([])
  const [setupByClassId, setSetupByClassId] = useState<Record<number, SetupStatus>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true)
    }
    setError(null)
    try {
      const events = await fetchClassEvents({ programsId: program.id, archived: false })
      setClassEvents(events)
      const statuses: Record<number, SetupStatus> = {}
      await Promise.all(
        events.map(async (ev) => {
          statuses[ev.id] = await classSetupStatus(ev)
        }),
      )
      setSetupByClassId(statuses)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load program overview')
    } finally {
      if (!opts?.silent) {
        setLoading(false)
      }
    }
  }, [program.id])

  useEffect(() => {
    void loadData()
  }, [program.id, loadData])

  const handleClassClick = async (classEvent: ClassEvent) => {
    await onSelectClassEvent(classEvent)
    onOpenOfferings()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading program overview…
      </div>
    )
  }

  return (
    <div className="space-y-8 w-full">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Program</p>
          <h4 className="text-xl font-bold text-black mt-1">{program.displayName}</h4>
          {program.description ? (
            <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{program.description}</p>
          ) : (
            <p className="text-sm text-gray-500 mt-2 italic">No description</p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Edit title and description in Admin → Classes → Programs.
          </p>
        </div>
      </section>

      <section>
        <h4 className="text-base font-bold text-black mb-3">Classes &amp; Events</h4>
        <p className="text-sm text-gray-600 mb-3">Select a class to configure offerings and timeslots.</p>
        {classEvents.length === 0 ? (
          <p className="text-sm text-gray-600">No classes yet. Add classes in Admin → Classes.</p>
        ) : (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
            {classEvents.map((classEvent) => {
              const setup = setupByClassId[classEvent.id] ?? 'none'
              return (
                <li key={classEvent.id} className="bg-white">
                  <button
                    type="button"
                    onClick={() => handleClassClick(classEvent)}
                    className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-black">{classEvent.displayName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {setup === 'ready'
                          ? 'Offerings configured'
                          : setup === 'partial'
                            ? 'Form exists — add offerings'
                            : 'Not set up for scheduling'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default AdminSchedulingOverview
