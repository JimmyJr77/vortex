import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import {
  fetchTopPrograms,
  fetchAdminProgramsWithPricing,
  type AdminProgramPricing,
  type TopProgram,
} from '../../utils/programsApi'
import { formatSchedulingCosts } from '../../utils/classSchedulingSummary'
import AdminPricingProgramPanel from './AdminPricingProgramPanel'

const thClass = 'px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider'
const tdClass = 'px-4 py-3 align-middle text-sm text-gray-900'

const AdminPricingProgramTable = () => {
  const [programs, setPrograms] = useState<TopProgram[]>([])
  const [classes, setClasses] = useState<AdminProgramPricing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedProgramId, setExpandedProgramId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [programList, classList] = await Promise.all([
        fetchTopPrograms(false),
        fetchAdminProgramsWithPricing(false),
      ])
      setPrograms(programList.filter((p) => !p.archived))
      setClasses(classList.filter((c) => !c.archived))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pricing data')
      setPrograms([])
      setClasses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const classesByProgram = useMemo(() => {
    const map = new Map<number, AdminProgramPricing[]>()
    for (const cls of classes) {
      const programId = cls.categoryId ?? cls.programsId
      if (programId == null) continue
      if (!map.has(programId)) map.set(programId, [])
      map.get(programId)!.push(cls)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.displayName.localeCompare(b.displayName))
    }
    return map
  }, [classes])

  const programStats = useMemo(() => {
    const stats = new Map<number, { classCount: number; overrideCount: number }>()
    for (const program of programs) {
      const programClasses = classesByProgram.get(program.id) ?? []
      stats.set(program.id, {
        classCount: programClasses.length,
        overrideCount: programClasses.filter((c) => c.pricingOverridesProgram).length,
      })
    }
    return stats
  }, [programs, classesByProgram])

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 inline-flex items-center gap-2 justify-center w-full">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading programs…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
        {error}
      </div>
    )
  }

  if (programs.length === 0) {
    return <p className="text-gray-500 text-sm">No programs yet.</p>
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className={thClass}>Program</th>
            <th className={thClass}>Default pricing</th>
            <th className={thClass}>Classes</th>
            <th className={thClass}>Overrides</th>
            <th className={`${thClass} w-12 text-center`}>Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {programs.map((program) => {
            const stats = programStats.get(program.id) ?? { classCount: 0, overrideCount: 0 }
            const programClasses = classesByProgram.get(program.id) ?? []
            return (
              <Fragment key={program.id}>
                <tr
                  className={`hover:bg-gray-50/80 cursor-pointer ${expandedProgramId === program.id ? 'bg-gray-50/50' : ''}`}
                  onClick={() =>
                    setExpandedProgramId((prev) => (prev === program.id ? null : program.id))
                  }
                >
                  <td className={`${tdClass} font-medium`}>{program.displayName}</td>
                  <td className={tdClass}>
                    {formatSchedulingCosts({
                      maxSlotsPerUser: program.pricingMaxSlotsPerUser,
                      slotCostMonthlyCents: program.pricingSlotCostMonthlyCents,
                      freeSlotsPerUser: program.pricingFreeSlotsPerUser,
                    })}
                  </td>
                  <td className={tdClass}>{stats.classCount}</td>
                  <td className={tdClass}>{stats.overrideCount}</td>
                  <td className={`${tdClass} text-center`} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                      onClick={() =>
                        setExpandedProgramId((prev) => (prev === program.id ? null : program.id))
                      }
                      aria-label="Toggle program pricing details"
                    >
                      {expandedProgramId === program.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
                {expandedProgramId === program.id && (
                  <tr>
                    <td colSpan={5} className="px-0 py-0">
                      <AdminPricingProgramPanel
                        program={program}
                        classes={programClasses}
                        onRefresh={load}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default AdminPricingProgramTable
