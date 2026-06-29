import { Plus, Trash2 } from 'lucide-react'
import { randomUUID } from '../../utils/uuid'
import type { MultiClassPassPackage } from '../../utils/multiClassPassPackages'

interface Props {
  packages: MultiClassPassPackage[]
  onChange: (packages: MultiClassPassPackage[]) => void
  disabled?: boolean
}

const inputClass =
  'h-9 w-28 rounded-lg border border-gray-300 px-2 text-sm disabled:bg-gray-50'

const MultiClassPassPackagesField = ({ packages, onChange, disabled = false }: Props) => {
  const addPackage = () => {
    onChange([
      ...packages,
      {
        id: randomUUID(),
        classCount: 4,
        priceCents: 0,
        enabled: true,
        label: '4-Class Pass',
      },
    ])
  }

  const patch = (id: string, patchFields: Partial<MultiClassPassPackage>) => {
    onChange(packages.map((p) => (p.id === id ? { ...p, ...patchFields } : p)))
  }

  const remove = (id: string) => {
    onChange(packages.filter((p) => p.id !== id))
  }

  return (
    <div>
      <h5 className="text-sm font-bold text-gray-900 mb-1">Multi class</h5>
      <p className="text-xs text-gray-500 mb-3">
        Prepaid class packages families can purchase at enrollment. Credits apply program-wide and
        are deducted when registering for a class.
      </p>
      {packages.length === 0 ? (
        <p className="text-sm text-gray-500 mb-3">No packages configured yet.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {packages.map((pkg) => (
            <li
              key={pkg.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
            >
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={pkg.enabled}
                  onChange={(e) => patch(pkg.id, { enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-vortex-red focus:ring-vortex-red"
                />
                <span className="sr-only">Enable {pkg.label}</span>
              </label>
              <div className="flex items-center gap-2 text-sm text-gray-800">
                <span># classes</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  disabled={disabled || !pkg.enabled}
                  value={pkg.classCount}
                  onChange={(e) => {
                    const classCount = Math.max(1, Math.round(Number(e.target.value) || 1))
                    patch(pkg.id, {
                      classCount,
                      label: `${classCount}-Class Pass`,
                    })
                  }}
                  className="h-9 w-16 rounded-lg border border-gray-300 px-2 text-sm disabled:bg-gray-50"
                />
              </div>
              <input
                type="text"
                disabled={disabled || !pkg.enabled}
                value={pkg.label}
                onChange={(e) => patch(pkg.id, { label: e.target.value })}
                className="h-9 flex-1 min-w-[8rem] rounded-lg border border-gray-300 px-2 text-sm disabled:bg-gray-50"
                placeholder="Package label"
              />
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  disabled={disabled || !pkg.enabled}
                  value={pkg.enabled ? pkg.priceCents / 100 : ''}
                  placeholder="0.00"
                  onChange={(e) =>
                    patch(pkg.id, {
                      priceCents: Math.round((Number(e.target.value) || 0) * 100),
                    })
                  }
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(pkg.id)}
                className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-40"
                aria-label="Remove package"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={addPackage}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
      >
        <Plus className="w-4 h-4" />
        Add package
      </button>
    </div>
  )
}

export default MultiClassPassPackagesField
