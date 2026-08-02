import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminClassSetupOverviewEditModal from './AdminClassSetupOverviewEditModal'
import PrimarySportPicker from '../programs/PrimarySportPicker'
import DisciplineTagPicker from '../programs/DisciplineTagPicker'
import AdminSchedulingSlots from '../scheduling/AdminSchedulingSlots'
import {
  archiveClassEvent,
  fetchTopPrograms,
  updateClassEvent,
  updateTopProgram,
  type TopProgram,
} from '../../utils/programsApi'
import {
  adminEnsureFormActiveDates,
  adminFetchOrphanedSignups,
  adminFetchSchedulingForm,
  adminFetchSignups,
  adminSaveSchedulingForm,
  type SchedulingFormDetail,
  type SchedulingOffering,
  type SchedulingOrphanedSignup,
  type SchedulingSignup,
} from '../../utils/schedulingApi'
import {
  PROGRAM_PRICING_OPTION_DEFS,
  normalizeProgramPricingOptions,
  type ProgramPricingOption,
  type ProgramPricingOptionKey,
} from '../../utils/programPricingOptions'
import {
  type ClassSetupOverviewRow,
} from '../../utils/classSetupOverviewApi'
import { type OverviewColumnId } from './overviewColumns'

export interface EditTarget {
  row: ClassSetupOverviewRow
  columnId: OverviewColumnId
}

interface Props {
  target: EditTarget | null
  onClose: () => void
  onSaved: () => void
}

function TextField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      )}
    </div>
  )
}

function setPricingOptionAmount(
  options: ProgramPricingOption[],
  key: ProgramPricingOptionKey,
  dollars: string,
): ProgramPricingOption[] {
  const cents = Math.max(0, Math.round(Number(dollars || 0) * 100))
  return normalizeProgramPricingOptions(options).map((o) =>
    o.key === key ? { ...o, enabled: cents > 0, amountCents: cents } : o,
  )
}

const AdminClassSetupOverviewCellEditor = ({ target, onClose, onSaved }: Props) => {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const row = target?.row
  const columnId = target?.columnId

  const [textValue, setTextValue] = useState('')
  const [selectedProgramsId, setSelectedProgramsId] = useState<number | null>(null)
  const [programOptions, setProgramOptions] = useState<TopProgram[]>([])
  const [programOptionsLoading, setProgramOptionsLoading] = useState(false)
  const [primarySportId, setPrimarySportId] = useState<number | null>(null)
  const [allowDropIns, setAllowDropIns] = useState(true)
  const [skillLevel, setSkillLevel] = useState<string>('')
  const [statusValue, setStatusValue] = useState<'Active' | 'Inactive' | 'Legacy'>('Active')
  const [pricingDraft, setPricingDraft] = useState<ProgramPricingOption[]>([])
  const [classMonthlyDollars, setClassMonthlyDollars] = useState('')
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleDetail, setScheduleDetail] = useState<SchedulingFormDetail | null>(null)
  const [selectedOffering, setSelectedOffering] = useState<SchedulingOffering | null>(null)
  const [scheduleSignups, setScheduleSignups] = useState<SchedulingSignup[]>([])
  const [scheduleOrphans, setScheduleOrphans] = useState<SchedulingOrphanedSignup[]>([])

  useEffect(() => {
    if (!row || !columnId) return
    setError(null)
    setTextValue('')
    setSelectedProgramsId(row.programsId)
    setPrimarySportId(row.primarySportId)
    setAllowDropIns(!row.excludeFromDropIns)
    setSkillLevel(row.skillLevel ?? '')
    setStatusValue(row.status)
    const options = normalizeProgramPricingOptions(row.pricingCostOptions)
    setPricingDraft(options)
    const cents = Number(row.effectiveCostAmountCents ?? 0)
    setClassMonthlyDollars(cents > 0 ? (cents / 100).toFixed(2) : '')

    switch (columnId) {
      case 'programDescription':
        setTextValue(row.programDescription ?? '')
        break
      case 'className':
        setTextValue(row.className)
        break
      case 'classDescription':
        setTextValue(row.classDescription ?? '')
        break
      default:
        break
    }
  }, [row, columnId])

  const loadSchedule = useCallback(async (refreshOverview = false) => {
    if (row?.formId == null) return
    setScheduleLoading(true)
    setError(null)
    try {
      const offering = await adminEnsureFormActiveDates(row.formId)
      const [detail, signups, orphans] = await Promise.all([
        adminFetchSchedulingForm(row.formId),
        adminFetchSignups(row.formId),
        adminFetchOrphanedSignups(row.formId),
      ])
      setScheduleDetail(detail)
      setSelectedOffering(offering)
      setScheduleSignups(signups)
      setScheduleOrphans(orphans)
      if (refreshOverview) onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule')
    } finally {
      setScheduleLoading(false)
    }
  }, [row?.formId, onSaved])

  useEffect(() => {
    if (columnId !== 'schedule') return
    void loadSchedule(false)
  }, [columnId, loadSchedule])

  useEffect(() => {
    if (!row || columnId !== 'program') return
    let cancelled = false
    setProgramOptionsLoading(true)
    fetchTopPrograms(false)
      .then((programs) => {
        if (!cancelled) setProgramOptions(programs.filter((program) => !program.archived))
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load programs')
      })
      .finally(() => {
        if (!cancelled) setProgramOptionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [row, columnId])

  const title = useMemo(() => {
    if (!columnId) return 'Edit'
    const labels: Partial<Record<OverviewColumnId, string>> = {
      primarySport: 'Primary Sport',
      sportTags: 'Sport Tags',
      program: 'Program',
      programDescription: 'Program Description',
      excludeFromDropIns: 'Allow Drop-ins',
      className: 'Class',
      classDescription: 'Class Description',
      schedule: 'Schedule',
      skillLevel: 'Skill Level',
      status: 'Status',
      active: 'Status',
      costPerMonth: 'Pricing',
    }
    return `Edit ${labels[columnId] ?? columnId}`
  }, [columnId])

  const handleSave = async () => {
    if (!row || !columnId) return
    if (
      !row.programsId &&
      columnId !== 'className' &&
      columnId !== 'classDescription' &&
      columnId !== 'status' &&
      columnId !== 'active'
    ) {
      setError('This class has no parent program.')
      return
    }

    const programLevelColumns: OverviewColumnId[] = [
      'primarySport',
      'programDescription',
      'excludeFromDropIns',
      // Program defaults only — class overrides are saved on the scheduling form.
      ...(row.pricingOverridesProgram ? [] : (['costPerMonth'] as OverviewColumnId[])),
    ]
    if (
      programLevelColumns.includes(columnId) &&
      !window.confirm(
        `This is a program-level setting. Saving it will apply to all classes in “${row.programName}”. Continue?`,
      )
    ) {
      return
    }

    setSaving(true)
    setError(null)
    try {
      switch (columnId) {
        case 'primarySport':
          if (row.programsId == null) throw new Error('Missing program')
          await updateTopProgram(row.programsId, { primarySportId })
          break
        case 'sportTags':
          break
        case 'program':
          if (selectedProgramsId == null) throw new Error('Select a program')
          await updateClassEvent(row.classId, { programsId: selectedProgramsId })
          break
        case 'programDescription':
          if (row.programsId == null) throw new Error('Missing program')
          await updateTopProgram(row.programsId, { description: textValue.trim() || null })
          break
        case 'excludeFromDropIns':
          if (row.programsId == null) throw new Error('Missing program')
          await updateTopProgram(row.programsId, { excludeFromDropIns: !allowDropIns })
          break
        case 'className':
          await updateClassEvent(row.classId, { displayName: textValue.trim() })
          break
        case 'classDescription':
          await updateClassEvent(row.classId, { description: textValue.trim() || null })
          break
        case 'skillLevel':
          await updateClassEvent(row.classId, {
            skillLevel: (skillLevel || null) as ClassSetupOverviewRow['skillLevel'],
          })
          break
        case 'status':
        case 'active':
          if (statusValue === 'Legacy') {
            await archiveClassEvent(row.classId, true)
          } else {
            if (row.classArchived) await archiveClassEvent(row.classId, false)
            await updateClassEvent(row.classId, { isActive: statusValue === 'Active' })
          }
          break
        case 'costPerMonth': {
          if (row.pricingOverridesProgram) {
            if (row.formId == null) throw new Error('No scheduling form is linked to this class.')
            const form = await adminFetchSchedulingForm(row.formId)
            const dollars = Number(classMonthlyDollars)
            const amountCents = Number.isFinite(dollars) ? Math.max(0, Math.round(dollars * 100)) : 0
            await adminSaveSchedulingForm(
              {
                title: form.title,
                description: form.description,
                startDate: form.startDate ?? undefined,
                endDate: form.endDate ?? undefined,
                isActive: form.isActive,
                maxSlotsPerUser: form.maxSlotsPerUser,
                slotCostMonthlyCents: amountCents,
                costUnit: 'per_month',
                freeSlotsPerUser: form.freeSlotsPerUser,
                maxFreeSlotsTotal: form.maxFreeSlotsTotal,
                pricingOverridesProgram: true,
              },
              row.formId,
            )
          } else {
            if (row.programsId == null) throw new Error('Missing program')
            await updateTopProgram(row.programsId, { pricingCostOptions: pricingDraft })
          }
          break
        }
        default:
          break
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!target || !row || !columnId) return null

  const subtitle = `${row.programName || 'Program'} · ${row.className}`

  let body: React.ReactNode = null
  let saveDisabled = false
  let hideSave = false
  let hideFooter = false
  let wide = false

  switch (columnId) {
    case 'primarySport':
      body = (
        <PrimarySportPicker
          value={primarySportId}
          onChange={setPrimarySportId}
          selectedLabel={row.primarySportName}
        />
      )
      break
    case 'sportTags':
      body =
        row.programsId != null ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Sport tags are a program-level setting. Changes apply immediately to all classes in{' '}
              <strong>{row.programName}</strong>.
            </p>
            <DisciplineTagPicker
              programId={row.programsId}
              programDisplayName={row.programName}
              showHeading={false}
              excludeTagId={row.primarySportId}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500">No parent program linked.</p>
        )
      hideSave = true
      break
    case 'program':
      body = (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
          <select
            value={selectedProgramsId ?? ''}
            onChange={(e) => setSelectedProgramsId(e.target.value ? Number(e.target.value) : null)}
            disabled={programOptionsLoading}
            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm bg-white disabled:bg-gray-100"
          >
            <option value="">{programOptionsLoading ? 'Loading programs…' : 'Select a program…'}</option>
            {programOptions.map((program) => (
              <option key={program.id} value={program.id}>{program.displayName}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Moving this class also moves its scheduling form to the selected program.
          </p>
        </div>
      )
      saveDisabled = programOptionsLoading || selectedProgramsId == null || selectedProgramsId === row.programsId
      break
    case 'programDescription':
    case 'className':
    case 'classDescription':
      body = (
        <TextField
          label={title.replace('Edit ', '')}
          value={textValue}
          onChange={setTextValue}
          multiline={columnId === 'programDescription' || columnId === 'classDescription'}
        />
      )
      saveDisabled = !textValue.trim() && columnId !== 'programDescription' && columnId !== 'classDescription'
      break
    case 'excludeFromDropIns':
      body = (
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
            <input
              type="checkbox"
              checked={allowDropIns}
              onChange={(event) => setAllowDropIns(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">Allow Drop-ins</span>
              <span className="mt-1 block text-xs text-gray-500">
                Yes adds this program’s classes to the drop-in course enrollment list. No removes them.
              </span>
            </span>
          </label>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This is a program-level setting. Saving it will apply to all classes in <strong>{row.programName}</strong>.
          </p>
        </div>
      )
      saveDisabled = allowDropIns === !row.excludeFromDropIns
      break
    case 'skillLevel':
      body = (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Skill level</label>
          <select
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm bg-white"
          >
            <option value="">All levels</option>
            <option value="EARLY_STAGE">Early stage</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>
      )
      break
    case 'status':
    case 'active':
      body = (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value as typeof statusValue)}
            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm bg-white"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Legacy">Legacy (archive class)</option>
          </select>
        </div>
      )
      break
    case 'schedule':
      body = row.formId == null ? (
        <p className="text-sm text-gray-500">No scheduling form is linked to this class.</p>
      ) : scheduleLoading && !scheduleDetail ? (
        <p className="py-8 text-center text-sm text-gray-500">Loading schedule editor…</p>
      ) : scheduleDetail ? (
        <AdminSchedulingSlots
          formId={row.formId}
          detail={scheduleDetail}
          formStartDate={scheduleDetail.startDate ?? null}
          formEndDate={scheduleDetail.endDate ?? null}
          offeringId={selectedOffering?.id ?? null}
          offeringStartDate={selectedOffering?.startDate ?? scheduleDetail.startDate ?? null}
          offeringEndDate={selectedOffering?.endDate ?? scheduleDetail.endDate ?? null}
          setupContextPrimary={`${row.programName} · ${row.className}`}
          existingSlotsPosition="top"
          orphanedSignups={scheduleOrphans}
          signups={scheduleSignups}
          forms={[scheduleDetail]}
          onRefresh={() => loadSchedule(true)}
        />
      ) : (
        <p className="text-sm text-gray-500">Unable to load schedule.</p>
      )
      hideSave = true
      hideFooter = true
      wide = true
      break
    case 'costPerMonth':
      if (row.pricingOverridesProgram) {
        body = (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This class uses adjusted pricing (not the program default). Cost per month is stored on the class scheduling form.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Cost per month</label>
              <div className="relative max-w-xs">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={classMonthlyDollars}
                  onChange={(event) => setClassMonthlyDollars(event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-300 pl-7 pr-3 text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        )
      } else {
        body = (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This class uses program defaults for <strong>{row.programName}</strong>. Saving here updates every class that still inherits this program’s pricing.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {PROGRAM_PRICING_OPTION_DEFS.map((definition) => {
                const option = pricingDraft.find((item) => item.key === definition.key)
                const dollars = option?.enabled && option.amountCents > 0
                  ? (option.amountCents / 100).toFixed(2)
                  : ''
                return (
                  <div key={definition.key} className="rounded-lg border border-gray-200 p-3">
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      {definition.label.replace(/^\$\s*/, '')}
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={dollars}
                        onChange={(event) => setPricingDraft((current) =>
                          setPricingOptionAmount(current, definition.key, event.target.value),
                        )}
                        className="h-10 w-full rounded-lg border border-gray-300 pl-7 pr-3 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    {definition.key === 'per_offering' && option && (
                      <select
                        value={option.offeringLabel ?? 'offering'}
                        onChange={(event) => setPricingDraft((current) => current.map((item) =>
                          item.key === 'per_offering'
                            ? { ...item, offeringLabel: event.target.value as 'offering' | 'event' }
                            : item,
                        ))}
                        className="mt-2 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs"
                      >
                        <option value="offering">Per offering</option>
                        <option value="event">Per event</option>
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
        wide = true
      }
      break
    default:
      body = <p className="text-sm text-gray-500">This field cannot be edited.</p>
      hideSave = true
  }

  return (
    <AdminClassSetupOverviewEditModal
      open
      title={title}
      subtitle={subtitle}
      saving={saving}
      error={error}
      onClose={() => {
        if (columnId === 'sportTags') onSaved()
        onClose()
      }}
      onSave={
        hideSave
          ? () => {
              if (columnId === 'sportTags') onSaved()
              onClose()
            }
          : handleSave
      }
      saveDisabled={saveDisabled}
      wide={wide}
      hideFooter={hideFooter}
    >
      {body}
    </AdminClassSetupOverviewEditModal>
  )
}

export default AdminClassSetupOverviewCellEditor
