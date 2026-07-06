import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import AdminClassSetupOverviewEditModal from './AdminClassSetupOverviewEditModal'
import PrimarySportPicker from '../programs/PrimarySportPicker'
import DisciplineTagPicker from '../programs/DisciplineTagPicker'
import {
  archiveClassEvent,
  updateClassEvent,
  updateTopProgram,
} from '../../utils/programsApi'
import {
  adminUpdateOffering,
  adminUpdateSlotGroupMax,
} from '../../utils/schedulingApi'
import {
  normalizeProgramPricingOptions,
  type ProgramPricingOption,
  type ProgramPricingOptionKey,
} from '../../utils/programPricingOptions'
import { dateInputValue } from '../../utils/dateUtils'
import {
  type ClassSetupOverviewRow,
  type ClassSetupOffering,
  type ClassSetupSlotGroup,
} from '../../utils/classSetupOverviewApi'
import { type OverviewColumnId } from './overviewColumns'
import { type SchedulingNavigationIntent } from '../../utils/schedulingNavigation'

export interface EditTarget {
  row: ClassSetupOverviewRow
  columnId: OverviewColumnId
}

interface Props {
  target: EditTarget | null
  onClose: () => void
  onSaved: () => void
  onOpenScheduling?: (intent: SchedulingNavigationIntent) => void
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

function pricingOptionAmount(options: ProgramPricingOption[], key: ProgramPricingOptionKey): string {
  const opt = options.find((o) => o.key === key)
  if (!opt?.enabled || opt.amountCents <= 0) return ''
  return (opt.amountCents / 100).toFixed(2)
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

const AdminClassSetupOverviewCellEditor = ({ target, onClose, onSaved, onOpenScheduling }: Props) => {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const row = target?.row
  const columnId = target?.columnId

  const [textValue, setTextValue] = useState('')
  const [primarySportId, setPrimarySportId] = useState<number | null>(null)
  const [skillLevel, setSkillLevel] = useState<string>('')
  const [statusValue, setStatusValue] = useState<'Active' | 'Inactive' | 'Legacy'>('Active')
  const [offeringsDraft, setOfferingsDraft] = useState<ClassSetupOffering[]>([])
  const [offeringLabelsDraft, setOfferingLabelsDraft] = useState<Record<number, string>>({})
  const [spacesDraft, setSpacesDraft] = useState<ClassSetupSlotGroup[]>([])
  const [pricingDraft, setPricingDraft] = useState<ProgramPricingOption[]>([])
  const [perClassDollars, setPerClassDollars] = useState('')
  const [fee1xDollars, setFee1xDollars] = useState('')
  const [monthlyOtherDollars, setMonthlyOtherDollars] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!row || !columnId) return
    setError(null)
    setTextValue('')
    setPrimarySportId(row.primarySportId)
    setSkillLevel(row.skillLevel ?? '')
    setStatusValue(row.status)
    setOfferingsDraft(row.offerings.map((o) => ({ ...o })))
    setOfferingLabelsDraft(Object.fromEntries(row.offerings.map((o) => [o.id, o.label ?? ''])))
    setSpacesDraft(row.slotGroups.map((g) => ({ ...g })))
    const options = normalizeProgramPricingOptions(row.pricingCostOptions)
    setPricingDraft(options)
    setPerClassDollars(pricingOptionAmount(options, 'per_class'))
    setFee1xDollars(pricingOptionAmount(options, 'monthly_1x'))
    const other: Record<string, string> = {}
    for (const opt of options) {
      if (
        opt.key !== 'per_class' &&
        opt.key !== 'monthly_1x' &&
        (opt.key.startsWith('monthly_') || opt.key.startsWith('unlimited_'))
      ) {
        other[opt.key] = opt.enabled && opt.amountCents > 0 ? (opt.amountCents / 100).toFixed(2) : ''
      }
    }
    setMonthlyOtherDollars(other)

    switch (columnId) {
      case 'program':
        setTextValue(row.programName)
        break
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

  const title = useMemo(() => {
    if (!columnId) return 'Edit'
    const labels: Partial<Record<OverviewColumnId, string>> = {
      primarySport: 'Primary Sport',
      sportTags: 'Sport Tags',
      program: 'Program',
      programDescription: 'Program Description',
      className: 'Class',
      classDescription: 'Class Description',
      offerings: 'Offerings',
      offeringDescription: 'Offering Description',
      schedule: 'Schedule',
      skillLevel: 'Skill Level',
      spaces: 'Spaces',
      status: 'Status',
      costPerClass: 'Cost per Class',
      fee1x: '1× Fee',
      costPerMonth: 'Cost per Month',
    }
    return `Edit ${labels[columnId] ?? columnId}`
  }, [columnId])

  const handleSave = async () => {
    if (!row || !columnId) return
    if (!row.programsId && columnId !== 'className' && columnId !== 'classDescription' && columnId !== 'status') {
      setError('This class has no parent program.')
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
          if (row.programsId == null) throw new Error('Missing program')
          await updateTopProgram(row.programsId, { displayName: textValue.trim() })
          break
        case 'programDescription':
          if (row.programsId == null) throw new Error('Missing program')
          await updateTopProgram(row.programsId, { description: textValue.trim() || null })
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
          if (statusValue === 'Legacy') {
            await archiveClassEvent(row.classId, true)
          } else {
            if (row.classArchived) await archiveClassEvent(row.classId, false)
            await updateClassEvent(row.classId, { isActive: statusValue === 'Active' })
          }
          break
        case 'offerings':
          if (row.formId == null) throw new Error('No scheduling form for this class')
          for (const offering of offeringsDraft) {
            await adminUpdateOffering(offering.id, {
              startDate: offering.startDate,
              endDate: offering.evergreen ? null : offering.endDate,
              evergreen: offering.evergreen,
            })
          }
          break
        case 'offeringDescription':
          if (row.formId == null) throw new Error('No scheduling form for this class')
          for (const offering of row.offerings) {
            const label = offeringLabelsDraft[offering.id]?.trim() || null
            await adminUpdateOffering(offering.id, { label })
          }
          break
        case 'spaces':
          for (const group of spacesDraft) {
            await adminUpdateSlotGroupMax(group.slotGroupId, group.maxParticipants)
          }
          break
        case 'costPerClass':
        case 'fee1x':
        case 'costPerMonth': {
          if (row.programsId == null) throw new Error('Missing program')
          let next = [...pricingDraft]
          next = setPricingOptionAmount(next, 'per_class', perClassDollars)
          next = setPricingOptionAmount(next, 'monthly_1x', fee1xDollars)
          for (const [key, dollars] of Object.entries(monthlyOtherDollars)) {
            next = setPricingOptionAmount(next, key as ProgramPricingOptionKey, dollars)
          }
          await updateTopProgram(row.programsId, { pricingCostOptions: next })
          break
        }
        case 'schedule':
          onClose()
          return
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
          <DisciplineTagPicker
            programId={row.programsId}
            programDisplayName={row.programName}
            showHeading={false}
            excludeTagId={row.primarySportId}
          />
        ) : (
          <p className="text-sm text-gray-500">No parent program linked.</p>
        )
      hideSave = true
      break
    case 'program':
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
    case 'skillLevel':
      body = (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Skill level</label>
          <select
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm bg-white"
          >
            <option value="">None</option>
            <option value="EARLY_STAGE">Early stage</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>
      )
      break
    case 'status':
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
    case 'offerings':
      body =
        row.formId == null ? (
          <p className="text-sm text-gray-500">No scheduling form yet. Create the class in Classes first.</p>
        ) : offeringsDraft.length === 0 ? (
          <p className="text-sm text-gray-500">No offerings yet.</p>
        ) : (
          <div className="space-y-3">
            {offeringsDraft.map((offering, index) => (
              <div key={offering.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-gray-500">Offering {index + 1}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={dateInputValue(offering.startDate)}
                    onChange={(e) =>
                      setOfferingsDraft((prev) =>
                        prev.map((o) => (o.id === offering.id ? { ...o, startDate: e.target.value } : o)),
                      )
                    }
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                  <input
                    type="date"
                    value={dateInputValue(offering.endDate)}
                    disabled={offering.evergreen}
                    onChange={(e) =>
                      setOfferingsDraft((prev) =>
                        prev.map((o) =>
                          o.id === offering.id ? { ...o, endDate: e.target.value || null } : o,
                        ),
                      )
                    }
                    className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={offering.evergreen}
                    onChange={(e) =>
                      setOfferingsDraft((prev) =>
                        prev.map((o) =>
                          o.id === offering.id
                            ? { ...o, evergreen: e.target.checked, endDate: e.target.checked ? null : o.endDate }
                            : o,
                        ),
                      )
                    }
                  />
                  Ongoing (evergreen)
                </label>
              </div>
            ))}
          </div>
        )
      saveDisabled = row.formId == null || offeringsDraft.length === 0
      break
    case 'offeringDescription':
      body =
        row.offerings.length === 0 ? (
          <p className="text-sm text-gray-500">No offerings yet.</p>
        ) : (
          <div className="space-y-3">
            {row.offerings.map((offering, index) => (
              <div key={offering.id}>
                <label className="block text-xs font-medium text-gray-500 mb-1">Offering {index + 1} label</label>
                <input
                  type="text"
                  value={offeringLabelsDraft[offering.id] ?? ''}
                  onChange={(e) =>
                    setOfferingLabelsDraft((prev) => ({ ...prev, [offering.id]: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        )
      saveDisabled = row.offerings.length === 0
      break
    case 'schedule':
      body = (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Schedule edits are managed in the Timeslots builder. Open Scheduling to edit slot times and patterns.
          </p>
          {row.programsId != null && (
            <button
              type="button"
              onClick={() => {
                onOpenScheduling?.({
                  programsId: row.programsId!,
                  classEventId: row.classId,
                  targetPanel: 'slots',
                })
                onClose()
              }}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              <ExternalLink className="w-4 h-4" />
              Open Timeslots
            </button>
          )}
        </div>
      )
      hideSave = true
      break
    case 'spaces':
      body =
        spacesDraft.length === 0 ? (
          <p className="text-sm text-gray-500">No schedule groups yet.</p>
        ) : (
          <div className="space-y-3">
            {spacesDraft.map((group, index) => (
              <div key={group.slotGroupId} className="border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-2">{group.scheduleLabel || `Group ${index + 1}`}</p>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max participants ({group.signupCount} enrolled)
                </label>
                <input
                  type="number"
                  min={group.signupCount}
                  value={group.maxParticipants}
                  onChange={(e) =>
                    setSpacesDraft((prev) =>
                      prev.map((g) =>
                        g.slotGroupId === group.slotGroupId
                          ? { ...g, maxParticipants: Math.max(0, Number(e.target.value) || 0) }
                          : g,
                      ),
                    )
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        )
      saveDisabled = spacesDraft.length === 0
      break
    case 'costPerClass':
      body = (
        <>
          {row.pricingOverridesProgram && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
              This class overrides program pricing in its scheduling form.
            </p>
          )}
          <TextField label="Cost per class ($)" value={perClassDollars} onChange={setPerClassDollars} />
        </>
      )
      break
    case 'fee1x':
      body = (
        <>
          {row.pricingOverridesProgram && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
              Program-level fee; class may override via scheduling form.
            </p>
          )}
          <TextField label="1× per week monthly fee ($)" value={fee1xDollars} onChange={setFee1xDollars} />
        </>
      )
      break
    case 'costPerMonth':
      body = (
        <div className="space-y-3">
          {Object.entries(monthlyOtherDollars).map(([key, value]) => (
            <TextField
              key={key}
              label={`${key.replace(/_/g, ' ')} ($)`}
              value={value}
              onChange={(next) => setMonthlyOtherDollars((prev) => ({ ...prev, [key]: next }))}
            />
          ))}
        </div>
      )
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
    >
      {body}
    </AdminClassSetupOverviewEditModal>
  )
}

export default AdminClassSetupOverviewCellEditor
