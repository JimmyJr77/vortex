import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  adminCreateAdditionalFee,
  adminDeleteAdditionalFee,
  adminFetchAdditionalFees,
  adminFetchSchedulingForms,
  adminUpdateAdditionalFee,
  type AdditionalFee,
  type AdditionalFeeInput,
} from '../../utils/schedulingApi'
import { fetchDisciplineTags, fetchTopPrograms } from '../../utils/programsApi'
import CollapsiblePricingSection from './CollapsiblePricingSection'
import AdditionalFeeEditor from './AdditionalFeeEditor'
import {
  FEE_TRIGGER_LABELS,
  describeFeeApplication,
  describeFeeScope,
} from '../../utils/additionalFeeModel'

const AdminAdditionalFeesPanel = () => {
  const [fees, setFees] = useState<AdditionalFee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<AdditionalFee | null>(null)
  const [sports, setSports] = useState<Array<{ id: number; name: string }>>([])
  const [programs, setPrograms] = useState<Array<{ id: number; displayName: string }>>([])
  const [classes, setClasses] = useState<Array<{ id: number; title: string }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [feeRows, sportRows, programRows, formRows] = await Promise.all([
        adminFetchAdditionalFees(),
        fetchDisciplineTags(),
        fetchTopPrograms(false),
        adminFetchSchedulingForms(),
      ])
      setFees(feeRows)
      setSports(sportRows)
      setPrograms(programRows.map((p) => ({ id: p.id, displayName: p.displayName })))
      setClasses(formRows.map((f) => ({ id: f.id, title: f.title })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load additional fees')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const scopeLabels = useMemo(
    () => ({
      sports: new Map(sports.map((s) => [s.id, s.name])),
      programs: new Map(programs.map((p) => [p.id, p.displayName])),
      classes: new Map(classes.map((c) => [c.id, c.title])),
    }),
    [sports, programs, classes],
  )

  const handleSave = async (input: AdditionalFeeInput) => {
    if (editingFee) {
      await adminUpdateAdditionalFee(editingFee.id, input)
    } else {
      await adminCreateAdditionalFee(input)
    }
    await load()
  }

  const handleDelete = async (fee: AdditionalFee) => {
    if (!window.confirm(`Delete "${fee.name}"?`)) return
    try {
      await adminDeleteAdditionalFee(fee.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const activeCount = fees.filter((f) => f.active).length

  return (
    <>
      <CollapsiblePricingSection
        title="Additional fees"
        description="Registration, annual, technology, and other fees charged on top of class tuition. Set amount, cadence, and which programs or classes they apply to."
        defaultOpen
        badge={
          !loading ? (
            <span className="text-xs font-normal text-gray-500">
              {fees.length} fee{fees.length === 1 ? '' : 's'} · {activeCount} active
            </span>
          ) : null
        }
      >
        <div className="flex items-center justify-end mb-3">
          <button
            type="button"
            onClick={() => {
              setEditingFee(null)
              setEditorOpen(true)
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700"
          >
            <Plus className="w-4 h-4" /> New fee
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading fees…</p>
        ) : fees.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            No additional fees yet. Add registration, annual, or administrative fees that apply at
            enroll.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2 font-semibold">Fee</th>
                  <th className="px-3 py-2 font-semibold">Amount & cadence</th>
                  <th className="px-3 py-2 font-semibold">When</th>
                  <th className="px-3 py-2 font-semibold">Applies to</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => (
                  <tr key={fee.id} className="border-b border-gray-50 align-top hover:bg-gray-50/60">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-900">{fee.name}</div>
                      {fee.description && (
                        <div className="text-xs text-gray-500 mt-0.5">{fee.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{describeFeeApplication(fee)}</td>
                    <td className="px-3 py-2.5 text-gray-700 text-xs">
                      {FEE_TRIGGER_LABELS[fee.triggerType]}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 text-xs max-w-[10rem]">
                      {describeFeeScope(fee, scopeLabels)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                          fee.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {fee.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFee(fee)
                            setEditorOpen(true)
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-900"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(fee)}
                          className="p-1.5 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsiblePricingSection>

      <AdditionalFeeEditor
        open={editorOpen}
        fee={editingFee}
        onSave={handleSave}
        onClose={() => {
          setEditorOpen(false)
          setEditingFee(null)
        }}
      />
    </>
  )
}

export default AdminAdditionalFeesPanel
