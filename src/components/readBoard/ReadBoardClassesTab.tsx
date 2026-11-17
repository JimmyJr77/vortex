import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchClassesOffered } from '../../utils/publicClassesApi'
import { getAdultBookingProgram, getPublicBookingPrograms } from '../../utils/publicBookingPrograms'
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
        if (!cancelled) {
          const youthPrograms = getPublicBookingPrograms(data.programs)
          const adultProgram = getAdultBookingProgram(data.programs)
          setPrograms(adultProgram?.classes.length ? [...youthPrograms, adultProgram] : youthPrograms)
        }
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
    <section className="np-browse-section section-padding bg-white" aria-labelledby="read-board-classes-heading">
      <div className="container-custom">
        <h2 id="read-board-classes-heading" className="np-browse-section-title">Gymnastics and fitness classes in Bowie</h2>
        <ul className="np-browse-program-links" role="list">
          <li>
            <Link to="/gymnastics#choose-a-class">Youth gymnastics</Link>
            <p>Start with preschool movement or choose a developmental level for kids and teens.</p>
          </li>
          <li>
            <Link to="/fit-and-flip#fit-flip-schedule">Fit &amp; Flip youth fitness</Link>
            <p>Cyclones classes for ages 8–11 and 12–15 combine strength, jumps, and body control.</p>
          </li>
          <li>
            <Link to="/adult-gymnastics">Typhoons adult gymnastics</Link>
            <p>Coach-led gymnastics and introductory acrobatics for ages 18 and up.</p>
          </li>
        </ul>
        <div data-prerender-dynamic="">
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
            <ClassesOfferedList programs={programs} className="np-browse-class-list" />
          )}
        </div>
      </div>
    </section>
  )
}

export default ReadBoardClassesTab
