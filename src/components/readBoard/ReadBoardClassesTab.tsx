import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { fetchClassesOffered } from '../../utils/publicClassesApi'
import { formatAgeRange, formatSkillLevel } from '../../utils/classDisplayUtils'
import { schedulingSignupPath } from '../../utils/schedulingApi'

const ReadBoardClassesTab = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [programs, setPrograms] = useState<
    Awaited<ReturnType<typeof fetchClassesOffered>>['programs']
  >([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchClassesOffered()
        if (!cancelled) setPrograms(data.programs)
      } catch (e) {
        if (!cancelled) {
          setPrograms([])
          setError(e instanceof Error ? e.message : 'Failed to load classes')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="section-padding bg-white">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-12 text-center">
            Classes <span className="text-vortex-red">Offered</span>
          </h2>

          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading classes…
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
            </div>
          )}

          {!loading && !error && programs.length === 0 && (
            <p className="text-center text-gray-600 py-12">No classes are listed at this time.</p>
          )}

          <div className="space-y-8 max-w-5xl mx-auto">
            {programs.map((group, groupIndex) => (
              <motion.div
                key={group.id}
                className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 md:p-8 border-2 border-gray-200"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIndex * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <h3 className="text-2xl font-display font-bold text-vortex-red mb-4">
                  {group.displayName}
                </h3>
                {group.description && (
                  <p className="text-gray-700 mb-6 leading-relaxed">{group.description}</p>
                )}
                <div className="space-y-6">
                  {group.classes.map((classItem) => (
                    <div
                      key={classItem.id}
                      className="border-l-4 border-vortex-red pl-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-semibold text-black mb-2">
                          {classItem.displayName}
                        </h4>
                        {classItem.description && (
                          <p className="text-gray-700 leading-relaxed mb-3">
                            {classItem.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                          <span>
                            <span className="font-medium text-gray-800">Age: </span>
                            {formatAgeRange(classItem.ageMin, classItem.ageMax)}
                          </span>
                          <span>
                            <span className="font-medium text-gray-800">Skill level: </span>
                            {formatSkillLevel(classItem.skillLevel)}
                          </span>
                        </div>
                        {classItem.skillRequirements && (
                          <p className="text-sm text-gray-600 mt-2">
                            <span className="font-medium text-gray-800">Requirements: </span>
                            {classItem.skillRequirements}
                          </p>
                        )}
                      </div>
                      {classItem.formId != null && (
                        <Link
                          to={schedulingSignupPath(classItem.formId)}
                          className="shrink-0 inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold text-sm text-white bg-vortex-red hover:bg-red-700 transition-colors"
                        >
                          Sign Up
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default ReadBoardClassesTab
