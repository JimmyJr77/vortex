import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { fetchClassesOffered } from '../../utils/publicClassesApi'
import ClassesOfferedList from '../classes/ClassesOfferedList'

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

          {!loading && !error && programs.length > 0 && (
            <ClassesOfferedList programs={programs} />
          )}
        </motion.div>
      </div>
    </section>
  )
}

export default ReadBoardClassesTab
