import { Fragment, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { AdminProgramPricing, TopProgram } from '../../utils/programsApi'
import { formatSchedulingCosts } from '../../utils/classSchedulingSummary'
import AdminPricingClassPanel from './AdminPricingClassPanel'

const thClass = 'px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider'
const tdClass = 'px-4 py-3 align-middle text-sm text-gray-900'

interface Props {
  program: TopProgram
  classes: AdminProgramPricing[]
  onRefresh: () => Promise<void>
}

const AdminPricingClassTable = ({ program, classes, onRefresh }: Props) => {
  const [expandedClassId, setExpandedClassId] = useState<number | null>(null)

  if (classes.length === 0) {
    return <p className="text-sm text-gray-500">No classes in this program.</p>
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className={thClass}>Class</th>
            <th className={thClass}>Effective pricing</th>
            <th className={thClass}>Status</th>
            <th className={`${thClass} w-12 text-center`}>Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {classes.map((classRow) => (
            <Fragment key={classRow.id}>
              <tr
                className={`hover:bg-gray-50/80 cursor-pointer ${expandedClassId === classRow.id ? 'bg-gray-50/50' : ''}`}
                onClick={() =>
                  setExpandedClassId((prev) => (prev === classRow.id ? null : classRow.id))
                }
              >
                <td className={`${tdClass} font-medium`}>{classRow.displayName}</td>
                <td className={tdClass}>
                  {formatSchedulingCosts({
                    maxSlotsPerUser: classRow.maxSlotsPerUser,
                    slotCostMonthlyCents: classRow.slotCostMonthlyCents,
                    freeSlotsPerUser: classRow.freeSlotsPerUser,
                  })}
                </td>
                <td className={tdClass}>
                  {classRow.pricingOverridesProgram ? (
                    <span className="text-amber-800">Custom override</span>
                  ) : (
                    <span className="text-green-700">Using defaults</span>
                  )}
                </td>
                <td className={`${tdClass} text-center`} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                    onClick={() =>
                      setExpandedClassId((prev) => (prev === classRow.id ? null : classRow.id))
                    }
                    aria-label="Toggle class pricing details"
                  >
                    {expandedClassId === classRow.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
              {expandedClassId === classRow.id && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 bg-gray-50 border-t border-gray-100">
                    <AdminPricingClassPanel
                      classRow={classRow}
                      program={program}
                      onRefresh={onRefresh}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AdminPricingClassTable
