import { useCallback, useEffect, useRef, useState } from 'react'
import { Calendar, Loader2, X } from 'lucide-react'
import AdminSchedulingSlots from './scheduling/AdminSchedulingSlots'
import AdminSchedulingOverview from './scheduling/AdminSchedulingOverview'
import AdminSchedulingOfferings from './scheduling/AdminSchedulingOfferings'
import AdminSchedulingLegacyForms from './scheduling/AdminSchedulingLegacyForms'
import {
  adminFetchSchedulingForm,
  adminFetchSchedulingForms,
  adminFetchSignups,
  adminFetchOrphanedSignups,
  adminFetchOfferings,
  adminSelectOffering,
  type SchedulingFormDetail,
  type SchedulingFormSummary,
  type SchedulingSignup,
  type SchedulingOrphanedSignup,
  type SchedulingOffering,
  formatOfferingDateRange,
} from '../utils/schedulingApi'
import ProgramsSection from './programs/ProgramsSection'
import {
  fetchClassEventSchedulingFormId,
  fetchClassEvents,
  fetchTopPrograms,
  fetchTopProgramsLegacy,
  type ClassEvent,
  type TopProgram,
} from '../utils/programsApi'
import {
  type SchedulingNavigationIntent,
} from '../utils/schedulingNavigation'

type Panel = 'overview' | 'offerings' | 'slots'

interface AdminSchedulingProps {
  navigationIntent?: SchedulingNavigationIntent | null
  onNavigationIntentConsumed?: () => void
}

const PANELS: { id: Panel; label: string }[] = [
  { id: 'overview', label: 'Classes' },
  { id: 'offerings', label: 'Offerings' },
  { id: 'slots', label: 'Timeslots' },
]

const AdminScheduling = ({
  navigationIntent = null,
  onNavigationIntentConsumed,
}: AdminSchedulingProps) => {
  const [topPrograms, setTopPrograms] = useState<TopProgram[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(
    navigationIntent?.programsId ?? null,
  )
  const [selectedClassEvent, setSelectedClassEvent] = useState<ClassEvent | null>(null)
  const [forms, setForms] = useState<SchedulingFormSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SchedulingFormDetail | null>(null)
  const [signups, setSignups] = useState<SchedulingSignup[]>([])
  const [orphanedSignups, setOrphanedSignups] = useState<SchedulingOrphanedSignup[]>([])
  const [panel, setPanel] = useState<Panel>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOffering, setSelectedOffering] = useState<SchedulingOffering | null>(null)
  const [offerings, setOfferings] = useState<SchedulingOffering[]>([])
  const programsLoaded = useRef(false)

  const syncSelectedOffering = useCallback((list: SchedulingOffering[]) => {
    setSelectedOffering((current) => {
      if (current && list.some((o) => o.id === current.id)) return current
      return list.find((o) => o.isSelected) ?? list[0] ?? null
    })
  }, [])

  const loadOfferingsForForm = useCallback(
    async (formId: number) => {
      const data = await adminFetchOfferings(formId)
      setOfferings(data)
      syncSelectedOffering(data)
      return data
    },
    [syncSelectedOffering],
  )

  const loadTopPrograms = useCallback(async () => {
    try {
      const data = await fetchTopPrograms(false)
      setTopPrograms(data.filter((p) => !p.archived))
      return data
    } catch {
      const legacy = await fetchTopProgramsLegacy(false).catch(() => [])
      setTopPrograms(legacy.filter((p) => !p.archived))
      return legacy
    }
  }, [])

  const loadForms = useCallback(async () => {
    const data = await adminFetchSchedulingForms()
    setForms(data)
    return data
  }, [])

  const loadDetail = useCallback(async (id: number) => {
    const data = await adminFetchSchedulingForm(id)
    setDetail(data)
  }, [])

  const loadSignups = useCallback(async (formId: number) => {
    const data = await adminFetchSignups(formId)
    setSignups(data)
  }, [])

  const loadOrphanedSignups = useCallback(async (formId: number) => {
    const data = await adminFetchOrphanedSignups(formId)
    setOrphanedSignups(data)
  }, [])

  const loadSchedulingForClassEvent = useCallback(
    async (classEvent: ClassEvent | null) => {
      if (!classEvent) {
        setSelectedId(null)
        setDetail(null)
        setSignups([])
        setOrphanedSignups([])
        setSelectedOffering(null)
        setOfferings([])
        return
      }
      try {
        const formId =
          classEvent.schedulingFormId ?? (await fetchClassEventSchedulingFormId(classEvent.id))
        setSelectedId(formId)
        await Promise.allSettled([
          loadDetail(formId),
          loadSignups(formId),
          loadOrphanedSignups(formId),
          loadOfferingsForForm(formId),
        ])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load scheduling form')
      }
    },
    [loadDetail, loadSignups, loadOrphanedSignups, loadOfferingsForForm],
  )

  const handleSelectClassEvent = useCallback(
    async (event: ClassEvent | null) => {
      setSelectedClassEvent(event)
      setSelectedOffering(null)
      setLoading(true)
      setError(null)
      try {
        await loadSchedulingForClassEvent(event)
      } finally {
        setLoading(false)
      }
    },
    [loadSchedulingForClassEvent],
  )

  const handleSelectProgram = useCallback(
    (program: TopProgram | null) => {
      setSelectedProgramId(program?.id ?? null)
      setSelectedClassEvent(null)
      setSelectedId(null)
      setDetail(null)
      setSignups([])
      setOrphanedSignups([])
      setSelectedOffering(null)
      setOfferings([])
      setPanel('overview')
    },
    [],
  )

  const applyNavigationIntent = useCallback(
    async (intent: SchedulingNavigationIntent, programs: TopProgram[]) => {
      const program = programs.find((p) => p.id === intent.programsId)
      if (!program) {
        throw new Error('Program not found for scheduling setup')
      }

      setSelectedProgramId(intent.programsId)
      setSelectedOffering(null)
      setPanel(intent.targetPanel)

      const classEvents = await fetchClassEvents({
        programsId: intent.programsId,
        archived: false,
      })
      const classEvent = classEvents.find((event) => event.id === intent.classEventId)
      if (!classEvent) {
        throw new Error('Class not found for scheduling setup')
      }

      setSelectedClassEvent(classEvent)
      const formId =
        classEvent.schedulingFormId ?? (await fetchClassEventSchedulingFormId(classEvent.id))
      setSelectedId(formId)
      await Promise.allSettled([
        loadDetail(formId),
        loadSignups(formId),
        loadOrphanedSignups(formId),
        loadOfferingsForForm(formId),
      ])
    },
    [loadDetail, loadSignups, loadOrphanedSignups, loadOfferingsForForm],
  )

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      // Re-apply when Classes tab sends a new navigation intent; skip idle reloads.
      if (!navigationIntent && programsLoaded.current) return

      setLoading(true)
      setError(null)
      try {
        const data = await loadTopPrograms()
        if (cancelled) return

        if (navigationIntent) {
          await applyNavigationIntent(navigationIntent, data)
          programsLoaded.current = true
          onNavigationIntentConsumed?.()
        } else if (!programsLoaded.current) {
          programsLoaded.current = true
          const active = data.filter((p) => !p.archived)
          if (active.length > 0) {
            setSelectedProgramId((current) => current ?? active[0].id)
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load scheduling')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [navigationIntent, loadTopPrograms, applyNavigationIntent, onNavigationIntentConsumed])

  const refresh = async () => {
    if (!selectedId) return
    await Promise.all([
      loadDetail(selectedId),
      loadSignups(selectedId),
      loadOrphanedSignups(selectedId),
      loadOfferingsForForm(selectedId),
    ])
    await loadForms()
  }

  const selectedProgram = topPrograms.find((p) => p.id === selectedProgramId) ?? null

  const needsClassEvent = ['offerings', 'slots'].includes(panel)
  const showClassEventPrompt = needsClassEvent && !selectedClassEvent

  const handleOfferingContinueToSlots = useCallback(() => {
    setPanel('slots')
  }, [])

  const offeringDisplayName =
    selectedOffering?.label?.trim() ||
    (selectedOffering ? formatOfferingDateRange(selectedOffering) : null)

  const handleProgramSaved = (updated: TopProgram) => {
    setTopPrograms((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
  }

  const handleOfferingSelect = useCallback((offering: SchedulingOffering | null) => {
    setSelectedOffering(offering)
    if (offering) {
      setOfferings((prev) =>
        prev.map((o) => ({ ...o, isSelected: o.id === offering.id })),
      )
    }
  }, [])

  const handleOfferingSaved = useCallback(async () => {
    if (!selectedId) return
    await Promise.all([loadDetail(selectedId), loadOfferingsForForm(selectedId)])
  }, [selectedId, loadDetail, loadOfferingsForForm])

  const handleOfferingSelectForSlots = useCallback(
    async (offering: SchedulingOffering) => {
      try {
        const updated = await adminSelectOffering(offering.id)
        handleOfferingSelect(updated)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to select offering')
      }
    },
    [handleOfferingSelect],
  )

  if (loading && topPrograms.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-vortex-red" />
            Class &amp; Event Scheduling &amp; Signup Forms
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Configure offerings, slots, and signup forms for each class and event.
          </p>
        </div>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-vortex-red" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-7 h-7 text-vortex-red" />
          Class &amp; Event Scheduling
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Configure class offerings and timeslots. New athletes complete the official account signup form before enrolling.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-64 shrink-0">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-black">Programs</h2>
          </div>
          <ProgramsSection
            compact
            selectedProgramId={selectedProgramId}
            onSelectProgram={handleSelectProgram}
          />
        </aside>

        <div className="flex-1 min-w-0">
          {!selectedProgramId ? (
            <p className="text-gray-600">Select or create a program in the sidebar.</p>
          ) : (
            <>
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                Program: <strong>{selectedProgram?.displayName}</strong>
                {selectedClassEvent ? (
                  <>
                    {' '}
                    · Class/Event: <strong>{selectedClassEvent.displayName}</strong>
                    {offeringDisplayName && (
                      <>
                        {' '}
                        · <strong>{offeringDisplayName}</strong>
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-amber-700"> · Select a class in Classes to continue</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
                {PANELS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPanel(p.id)}
                    className={`px-4 py-2 rounded-lg font-semibold ${
                      panel === p.id
                        ? 'bg-vortex-red text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 flex justify-between">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                </div>
              )}

              {showClassEventPrompt && (
                <p className="text-gray-600 py-8">
                  Select a class in <strong>Classes</strong> to manage {panel === 'slots' ? 'timeslots' : panel}.
                </p>
              )}

              {panel === 'overview' && selectedProgram && (
                <AdminSchedulingOverview
                  program={selectedProgram}
                  onSaved={handleProgramSaved}
                  onSelectClassEvent={handleSelectClassEvent}
                  onOpenOfferings={() => setPanel('offerings')}
                />
              )}

              {panel === 'offerings' && selectedClassEvent && selectedId && (
                <AdminSchedulingOfferings
                  formId={selectedId}
                  selectedOfferingId={selectedOffering?.id ?? null}
                  onOfferingSelect={handleOfferingSelect}
                  onContinueToSlots={handleOfferingContinueToSlots}
                  onOfferingSaved={handleOfferingSaved}
                />
              )}

              {panel === 'slots' && selectedClassEvent && selectedId && detail && !selectedOffering && (
                <p className="text-gray-600 py-8">
                  Select an offering in <strong>Offerings</strong> to view and manage its time slots.
                </p>
              )}

              {panel === 'slots' && selectedClassEvent && selectedId && detail && selectedOffering && (
                <>
                  {offerings.length > 1 && (
                    <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Offering for timeslots
                      </label>
                      <select
                        value={selectedOffering.id}
                        onChange={(e) => {
                          const next = offerings.find((o) => o.id === Number(e.target.value))
                          if (next) void handleOfferingSelectForSlots(next)
                        }}
                        className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                      >
                        {offerings.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label?.trim() || formatOfferingDateRange(o)}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Timeslots are saved to the offering selected here. Pick the empty offering before adding new slots.
                      </p>
                    </div>
                  )}
                <AdminSchedulingSlots
                  formId={selectedId}
                  detail={detail}
                  formStartDate={detail.startDate ?? null}
                  formEndDate={detail.endDate ?? null}
                  offeringId={selectedOffering?.id ?? null}
                  offeringStartDate={selectedOffering?.startDate ?? null}
                  offeringEndDate={selectedOffering?.endDate ?? null}
                  offeringLabel={offeringDisplayName}
                  canBuild={Boolean(selectedOffering)}
                  orphanedSignups={orphanedSignups}
                  signups={signups}
                  forms={forms}
                  onRefresh={refresh}
                />
                </>
              )}
            </>
          )}
        </div>
      </div>

      <AdminSchedulingLegacyForms onDeleted={() => loadForms()} />
    </div>
  )
}

export default AdminScheduling
