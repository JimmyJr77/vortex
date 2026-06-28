import { useCallback, useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import ScheduleOptionCheckboxGrid, { groupScheduleOptions } from './ScheduleOptionCheckboxGrid'
import {
  emptyEnrollmentRow,
  type SignupClassCatalog,
  type SignupClassOption,
  type SignupEnrollmentRow,
  type SignupProgramOption,
} from './signupEnrollmentUtils'

interface SignupEnrollmentPickerProps {
  apiUrl: string
  enrollments: SignupEnrollmentRow[]
  onEnrollmentsChange: (rows: SignupEnrollmentRow[]) => void
  /** Pre-load catalog data for rows that already have a class selected (e.g. from invite). */
  initialClassIds?: number[]
  onMetaChange?: (meta: {
    programs: SignupProgramOption[]
    classesByProgram: Record<number, SignupClassOption[]>
    catalogsByClass: Record<number, SignupClassCatalog>
  }) => void
}

export default function SignupEnrollmentPicker({
  apiUrl,
  enrollments,
  onEnrollmentsChange,
  initialClassIds = [],
  onMetaChange,
}: SignupEnrollmentPickerProps) {
  const [programs, setPrograms] = useState<SignupProgramOption[]>([])
  const [classesByProgram, setClassesByProgram] = useState<Record<number, SignupClassOption[]>>({})
  const [catalogsByClass, setCatalogsByClass] = useState<Record<number, SignupClassCatalog>>({})

  useEffect(() => {
    void fetch(`${apiUrl}/api/signup/catalog/programs`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPrograms(data.data ?? [])
      })
      .catch(() => {})
  }, [apiUrl])

  const loadClassesForProgram = useCallback(async (programsId: number) => {
    if (classesByProgram[programsId]) return
    const res = await fetch(`${apiUrl}/api/signup/catalog/programs/${programsId}/classes`)
    const data = await res.json()
    if (data.success) {
      setClassesByProgram((prev) => ({ ...prev, [programsId]: data.data ?? [] }))
    }
  }, [apiUrl, classesByProgram])

  const loadCatalogForClass = useCallback(async (classEventId: number) => {
    if (catalogsByClass[classEventId]) return
    const res = await fetch(`${apiUrl}/api/signup/catalog/classes/${classEventId}/offerings`)
    const data = await res.json()
    if (data.success) {
      const pack: SignupClassCatalog = data.data ?? { formId: null, offerings: [], scheduleOptions: [] }
      setCatalogsByClass((prev) => ({
        ...prev,
        [classEventId]: {
          formId: pack.formId ?? null,
          offerings: pack.offerings ?? [],
          scheduleOptions: pack.scheduleOptions ?? [],
          priceLabel: pack.priceLabel ?? null,
          classActiveDates: pack.classActiveDates ?? null,
        },
      }))
    }
  }, [apiUrl, catalogsByClass])

  useEffect(() => {
    for (const row of enrollments) {
      if (row.programsId !== '') void loadClassesForProgram(Number(row.programsId))
      if (row.classEventId !== '') void loadCatalogForClass(Number(row.classEventId))
    }
    for (const classId of initialClassIds) {
      void loadCatalogForClass(classId)
    }
  }, [enrollments, initialClassIds, loadClassesForProgram, loadCatalogForClass])

  useEffect(() => {
    onMetaChange?.({ programs, classesByProgram, catalogsByClass })
  }, [programs, classesByProgram, catalogsByClass, onMetaChange])

  const updateRow = (index: number, patch: Partial<SignupEnrollmentRow>) => {
    onEnrollmentsChange(
      enrollments.map((row, i) => {
        if (i !== index) return row
        const next = { ...row, ...patch }
        if (patch.programsId !== undefined && patch.programsId !== row.programsId) {
          next.classEventId = ''
          next.offeringIds = []
          next.selectedSlotKeys = []
          next.schedulingFormId = undefined
          next.slotGroupId = undefined
          next.timeSlotId = undefined
          if (patch.programsId !== '') void loadClassesForProgram(Number(patch.programsId))
        }
        if (patch.classEventId !== undefined && patch.classEventId !== row.classEventId) {
          next.offeringIds = []
          next.selectedSlotKeys = []
          next.slotGroupId = undefined
          next.timeSlotId = undefined
          if (patch.classEventId !== '') {
            void loadCatalogForClass(Number(patch.classEventId))
            const cls = classesByProgram[Number(next.programsId)]?.find(
              (c) => c.id === Number(patch.classEventId),
            )
            next.schedulingFormId = cls?.schedulingFormId ?? undefined
          }
        }
        return next
      }),
    )
  }

  const toggleSlot = (rowIndex: number, key: string, checked: boolean) => {
    onEnrollmentsChange(
      enrollments.map((row, i) => {
        if (i !== rowIndex) return row
        const selectedSlotKeys = checked
          ? [...row.selectedSlotKeys, key]
          : row.selectedSlotKeys.filter((k) => k !== key)
        return { ...row, selectedSlotKeys }
      }),
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Class enrollment</h2>
        <button
          type="button"
          onClick={() => onEnrollmentsChange([...enrollments, emptyEnrollmentRow()])}
          className="inline-flex items-center gap-1 text-sm text-vortex-red font-semibold"
        >
          <UserPlus className="w-4 h-4" /> Add class
        </button>
      </div>

      <p className="text-xs text-gray-600">
        Select the classes and schedule options for your athlete. You can change or remove any
        selections your athlete made, or add more classes.
      </p>

      {enrollments.length === 0 && (
        <p className="text-sm text-gray-500">
          No classes selected yet. Add a class below, or continue without enrolling.
        </p>
      )}

      {enrollments.map((row, index) => {
        const classes = row.programsId !== '' ? (classesByProgram[Number(row.programsId)] ?? []) : []
        const catalog = row.classEventId !== '' ? catalogsByClass[Number(row.classEventId)] : null
        const scheduleOptions = catalog?.scheduleOptions ?? []
        const groupedScheduleOptions = groupScheduleOptions(scheduleOptions)

        return (
          <div key={index} className="rounded-xl border border-gray-200 p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Program</label>
                <select
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                  value={row.programsId}
                  onChange={(e) => updateRow(index, {
                    programsId: e.target.value === '' ? '' : Number(e.target.value),
                  })}
                >
                  <option value="">Select program</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>{p.displayName || p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Class</label>
                <select
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
                  value={row.classEventId}
                  disabled={row.programsId === ''}
                  onChange={(e) => updateRow(index, {
                    classEventId: e.target.value === '' ? '' : Number(e.target.value),
                  })}
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.displayName || c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {catalog?.classActiveDates && (
              <p className="text-sm text-gray-700">
                Class active dates: <span className="font-medium">{catalog.classActiveDates}</span>
              </p>
            )}

            {scheduleOptions.length > 0 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Offerings &amp; schedule (select all that apply)
                  </label>
                  {catalog?.priceLabel && (
                    <p className="text-xs text-gray-500 mb-2">Typical price: {catalog.priceLabel}</p>
                  )}
                </div>
                <ScheduleOptionCheckboxGrid
                  groups={groupedScheduleOptions}
                  selectedSlotKeys={row.selectedSlotKeys}
                  onToggle={(key, checked) => toggleSlot(index, key, checked)}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => onEnrollmentsChange(enrollments.filter((_, i) => i !== index))}
              className="text-xs text-red-600 font-semibold"
            >
              Remove class
            </button>
          </div>
        )
      })}
    </div>
  )
}
