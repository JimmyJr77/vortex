import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { updateTopProgram, resetProgramClassesPricing, type TopProgram } from '../../utils/programsApi'
import type { AdminProgramPricing } from '../../utils/programsApi'
import {
  normalizeProgramPricingOptions,
  programPricingOptionsFromProgram,
  serializeProgramPricingOptionsForApi,
  type ProgramPricingOption,
} from '../../utils/programPricingOptions'
import {
  normalizeMultiClassPassPackages,
  type MultiClassPassPackage,
} from '../../utils/multiClassPassPackages'
import { getProgramPricingApiCapabilities } from '../../utils/programPricingApi'
import ProgramPricingOptionsFields from './ProgramPricingOptionsFields'
import AdminPricingClassTable from './AdminPricingClassTable'
import ConfirmPricingActionModal from './ConfirmPricingActionModal'
import PricingBenefitSelectionField from './PricingBenefitSelectionField'

interface Props {
  program: TopProgram
  classes: AdminProgramPricing[]
  onRefresh: () => Promise<void>
}

const AdminPricingProgramPanel = ({ program, classes, onRefresh }: Props) => {
  const [options, setOptions] = useState<ProgramPricingOption[]>(() =>
    programPricingOptionsFromProgram(program),
  )
  const [passPackages, setPassPackages] = useState<MultiClassPassPackage[]>(() =>
    normalizeMultiClassPassPackages(program.multiClassPassPackages),
  )
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmResetAll, setConfirmResetAll] = useState(false)
  const [legacyPricingBackend, setLegacyPricingBackend] = useState(false)

  useEffect(() => {
    void getProgramPricingApiCapabilities().then((caps) => {
      setLegacyPricingBackend(!caps.pricingCostOptions)
    })
  }, [])

  useEffect(() => {
    setOptions(programPricingOptionsFromProgram(program))
    setPassPackages(normalizeMultiClassPassPackages(program.multiClassPassPackages))
    setSaved(false)
    setError(null)
  }, [program])

  const overrideCount = classes.filter((c) => c.pricingOverridesProgram).length

  const handleSaveProgram = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateTopProgram(program.id, {
        pricingCostOptions: serializeProgramPricingOptionsForApi(options),
        multiClassPassPackages: normalizeMultiClassPassPackages(passPackages),
      })
      await onRefresh()
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save program defaults')
    } finally {
      setSaving(false)
    }
  }

  const handleResetAll = async () => {
    setResetting(true)
    setError(null)
    try {
      await resetProgramClassesPricing(program.id)
      await onRefresh()
      setConfirmResetAll(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset classes')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="p-6 bg-gray-50 border-t-2 border-vortex-red space-y-6">
      <div>
        <h4 className="text-base font-bold text-black mb-1">Program default pricing</h4>
        <p className="text-sm text-gray-600">
          Choose which cost options families can select for classes under {program.displayName}.
          Classes inherit these settings unless overridden.
        </p>
      </div>

      {legacyPricingBackend && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Production backend is outdated and does not support the full pricing options API yet. Saves
          will use a single legacy price until Render deploys build{' '}
          <span className="font-mono">pricing-save-fix-2026-06-29</span> or newer. Enable only one
          pricing option per save until then.
        </div>
      )}

      <ProgramPricingOptionsFields
        options={options}
        onChange={setOptions}
        passPackages={legacyPricingBackend ? undefined : passPackages}
        onPassPackagesChange={legacyPricingBackend ? undefined : setPassPackages}
      />

      <PricingBenefitSelectionField
        scopeLevel="program"
        scopeRefId={program.id}
        title="Program discounts & free passes"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSaveProgram()}
          disabled={saving}
          className="bg-vortex-red text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save program defaults
        </button>
        <button
          type="button"
          onClick={() => setConfirmResetAll(true)}
          disabled={resetting || classes.length === 0}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
        >
          Reset all classes to program defaults
        </button>
        {saved && <span className="text-green-600 text-sm font-medium">Saved</span>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <h4 className="text-base font-bold text-black mb-3">Classes</h4>
        <AdminPricingClassTable program={program} classes={classes} onRefresh={onRefresh} />
      </div>

      <ConfirmPricingActionModal
        open={confirmResetAll}
        title="Reset all class pricing"
        message={`Reset ${overrideCount > 0 ? overrideCount : classes.length} class(es) under "${program.displayName}" to program defaults? Classes with custom pricing will inherit program defaults.`}
        confirmLabel="Reset all"
        loading={resetting}
        onCancel={() => setConfirmResetAll(false)}
        onConfirm={() => void handleResetAll()}
      />
    </div>
  )
}

export default AdminPricingProgramPanel
