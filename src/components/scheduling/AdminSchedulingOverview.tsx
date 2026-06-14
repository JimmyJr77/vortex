import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Users } from 'lucide-react'
import { fetchClassEvents, updateTopProgram, type TopProgram } from '../../utils/programsApi'
import {
  adminFetchSchedulingForm,
  dayAbbrev,
  type SchedulingFormDetail,
  type SchedulingSlotGroup,
} from '../../utils/schedulingApi'
import {
  exportOverviewToEvents,
  type ClassEventSlotOverview,
} from '../../utils/schedulingExport'

interface Props {
  program: TopProgram
  onSaved: (program: TopProgram) => void
}

interface ClassEventSlotOverviewLocal extends ClassEventSlotOverview {
  loadError?: string
}

function categoryNameFor(form: SchedulingFormDetail, categoryId: number | null): string {
  if (categoryId == null) return 'Uncategorized'
  const fromAll = form.allCategories?.find((c) => c.id === categoryId)
  if (fromAll) return fromAll.name
  const fromForm = form.categories.find((c) => c.id === categoryId)
  if (fromForm) return fromForm.name
  return `Category #${categoryId}`
}

function formatGroupActiveDates(group: SchedulingSlotGroup): string {
  if (group.datesTbd) return 'Date TBD'
  if (group.activeStart || group.activeEnd) {
    return `${group.activeStart || '—'} → ${group.activeEnd || '—'}`
  }
  return '—'
}

function groupsByCategory(form: SchedulingFormDetail): { categoryId: number | null; name: string; groups: SchedulingSlotGroup[] }[] {
  const map = new Map<number | null, SchedulingSlotGroup[]>()
  for (const group of form.slotGroups) {
    const key = group.categoryId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(group)
  }
  return [...map.entries()]
    .map(([categoryId, groups]) => ({
      categoryId,
      name: categoryNameFor(form, categoryId),
      groups,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const AdminSchedulingOverview = ({ program, onSaved }: Props) => {
  const [title, setTitle] = useState(program.displayName)
  const [description, setDescription] = useState(program.description || '')
  const [active, setActive] = useState(program.schedulingActive ?? false)
  const [saving, setSaving] = useState(false)
  const [updated, setUpdated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slotOverview, setSlotOverview] = useState<ClassEventSlotOverviewLocal[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [expandedClasses, setExpandedClasses] = useState<Record<number, boolean>>({})
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [exporting, setExporting] = useState<'events' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const loadSlotOverview = useCallback(async (programId: number) => {
    setSlotsLoading(true)
    setSlotsError(null)
    try {
      const classEvents = await fetchClassEvents({ programsId: programId })
      const rows = await Promise.all(
        classEvents.map(async (classEvent): Promise<ClassEventSlotOverviewLocal> => {
          if (!classEvent.schedulingFormId) {
            return { classEvent, form: null }
          }
          try {
            const form = await adminFetchSchedulingForm(classEvent.schedulingFormId)
            return { classEvent, form }
          } catch (e) {
            return {
              classEvent,
              form: null,
              loadError: e instanceof Error ? e.message : 'Failed to load slots',
            }
          }
        }),
      )
      setSlotOverview(rows)
      setExpandedClasses((prev) => {
        const next = { ...prev }
        for (const row of rows) {
          if (next[row.classEvent.id] === undefined) next[row.classEvent.id] = true
        }
        return next
      })
    } catch (e) {
      setSlotsError(e instanceof Error ? e.message : 'Failed to load program slots')
      setSlotOverview([])
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  useEffect(() => {
    setTitle(program.displayName)
    setDescription(program.description || '')
    setActive(program.schedulingActive ?? false)
    setUpdated(false)
    void loadSlotOverview(program.id)
  }, [program, loadSlotOverview])

  const handleUpdate = async () => {
    setSaving(true)
    setError(null)
    setUpdated(false)
    try {
      const updatedProgram = await updateTopProgram(program.id, {
        displayName: title.trim(),
        description: description.trim() || null,
        schedulingActive: active,
        ...(!program.schedulingOverviewSavedAt ? { markOverviewSaved: true } : {}),
      })
      onSaved(updatedProgram)
      setUpdated(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const buildExportInput = () => ({
    program,
    title,
    description,
    active,
    slotOverview: slotOverview.map(({ classEvent, form }) => ({ classEvent, form })),
  })

  const handleExportToEvents = async () => {
    if (!title.trim()) return
    if (!confirm('Create events from scheduling slots for each class/event in this program?')) {
      return
    }
    setExporting('events')
    setExportError(null)
    try {
      const count = await exportOverviewToEvents(buildExportInput())
      if (count === 0) {
        alert('No classes with slots found to export as events.')
      } else {
        alert(`Exported ${count} event${count !== 1 ? 's' : ''} to Admin → Events.`)
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  const totalSlotGroups = slotOverview.reduce(
    (sum, row) => sum + (row.form?.slotGroups.length ?? 0),
    0,
  )

  return (
    <div className="space-y-8 w-full">
      <div className="space-y-6 w-full">
        <div>
          <h3 className="text-lg font-bold text-black">Overview</h3>
          <p className="text-sm text-gray-600 mt-1">
            Program title and description appear on the public scheduling page. Synced with Admin → Classes.
            Overview is saved automatically when the program is created; use Update overview to change it later.
          </p>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setUpdated(false)
            }}
            className="w-full rounded-lg border border-gray-300 px-4 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Description</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setUpdated(false)
            }}
            className="w-full rounded-lg border border-gray-300 px-4 py-2"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked)
              setUpdated(false)
            }}
          />
          <span className="font-semibold">Active (visible on /scheduling)</span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {exportError && <p className="text-sm text-red-600">{exportError}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleUpdate}
            disabled={saving || !title.trim()}
            className="bg-vortex-red text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Update overview
          </button>
          <button
            type="button"
            onClick={() => void handleExportToEvents()}
            disabled={exporting != null || !title.trim() || slotsLoading}
            className="border border-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {exporting === 'events' && <Loader2 className="w-4 h-4 animate-spin" />}
            Export to Events
          </button>
          {updated && <span className="text-green-600 text-sm font-medium">Updated</span>}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-8">
        <h3 className="text-xl font-bold text-black mb-1">All program slots</h3>
        <p className="text-sm text-gray-600 mb-4">
          Every slot across all classes and categories in this program. The Slots tab shows a filtered view
          for the selected class, category, and offering.
        </p>
        {slotsLoading && (
          <p className="text-sm text-gray-500 inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading slots…
          </p>
        )}
        {slotsError && <p className="text-sm text-red-600">{slotsError}</p>}
        {!slotsLoading && !slotsError && slotOverview.length === 0 && (
          <p className="text-sm text-gray-500">No classes or events yet. Add them in Classes &amp; Events.</p>
        )}
        {!slotsLoading && !slotsError && slotOverview.length > 0 && totalSlotGroups === 0 && (
          <p className="text-sm text-gray-500">No slots have been created yet.</p>
        )}
        {!slotsLoading && !slotsError && totalSlotGroups > 0 && (
          <p className="text-sm text-gray-600 mb-4">
            {totalSlotGroups} slot{totalSlotGroups !== 1 ? 's' : ''} across {slotOverview.length} class
            {slotOverview.length !== 1 ? 'es' : ''}/event{slotOverview.length !== 1 ? 's' : ''}
          </p>
        )}
        <div className="space-y-3">
          {slotOverview.map(({ classEvent, form, loadError }) => {
            const classOpen = expandedClasses[classEvent.id] ?? true
            const categorySections = form ? groupsByCategory(form) : []
            const classSlotCount = form?.slotGroups.length ?? 0
            return (
              <div key={classEvent.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedClasses((e) => ({ ...e, [classEvent.id]: !classOpen }))
                  }
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
                >
                  <span className="font-bold text-lg text-black">{classEvent.displayName}</span>
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    {classEvent.archived && (
                      <span className="text-amber-700 font-medium">Archived</span>
                    )}
                    {classSlotCount} slot{classSlotCount !== 1 ? 's' : ''}
                    {classOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                </button>
                {classOpen && (
                  <div className="p-4 space-y-3">
                    {loadError && <p className="text-sm text-red-600">{loadError}</p>}
                    {!form && !loadError && (
                      <p className="text-sm text-gray-500">No scheduling form linked yet.</p>
                    )}
                    {form && categorySections.length === 0 && (
                      <p className="text-sm text-gray-500">No slots in this class/event.</p>
                    )}
                    {categorySections.map(({ categoryId, name, groups }) => {
                      const catKey = `${classEvent.id}-${categoryId ?? 'none'}`
                      const catOpen = expandedCategories[catKey] ?? true
                      return (
                        <div key={catKey} className="border border-gray-100 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCategories((e) => ({ ...e, [catKey]: !catOpen }))
                            }
                            className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-50 text-left"
                          >
                            <span className="font-semibold text-gray-900">{name}</span>
                            <span className="flex items-center gap-2 text-sm text-gray-600">
                              {groups.length} slot{groups.length !== 1 ? 's' : ''}
                              {catOpen ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </span>
                          </button>
                          {catOpen && (
                            <div className="px-3 pb-3 overflow-x-auto">
                              <table className="w-full text-sm align-top">
                                <thead>
                                  <tr className="text-left text-gray-500 border-b">
                                    <th className="py-2 pr-3 align-top">Schedule</th>
                                    <th className="py-2 pr-3 align-top">Capacity</th>
                                    <th className="py-2 pr-3 align-top">Active dates</th>
                                    <th className="py-2 align-top">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {groups.map((group) => (
                                    <tr key={group.id} className="border-b border-gray-100 align-top">
                                      <td className="py-2 pr-3 align-top">
                                        <ul className="space-y-1">
                                          {group.occurrences.map((occ) => (
                                            <li key={occ.id}>
                                              {occ.scheduleMode === 'date'
                                                ? `${occ.specificDate} · ${occ.startTime} – ${occ.endTime}`
                                                : `${dayAbbrev(occ.dayOfWeek) ?? occ.dayName} · ${occ.startTime} – ${occ.endTime}`}
                                            </li>
                                          ))}
                                        </ul>
                                      </td>
                                      <td className="py-2 pr-3 align-top">
                                        <span className="inline-flex items-center gap-1">
                                          <Users className="w-3 h-3" />
                                          {group.signupCount}/{group.maxParticipants}
                                          {(group.waitlistCount ?? 0) > 0 && (
                                            <span className="text-amber-700">
                                              {' '}
                                              · {group.waitlistCount} waitlisted
                                            </span>
                                          )}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-3 align-top">{formatGroupActiveDates(group)}</td>
                                      <td className="py-2 align-top">
                                        <span
                                          className={
                                            group.isActive
                                              ? 'text-green-700 font-medium'
                                              : 'text-gray-500'
                                          }
                                        >
                                          {group.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AdminSchedulingOverview
