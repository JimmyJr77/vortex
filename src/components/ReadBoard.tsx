import { motion } from 'framer-motion'
import { Suspense, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BOWIE_YOUTH_SPORTS_GUIDE } from '../config/bowieYouthSportsGuide'
import { trackEvent } from '../utils/analyticsClient'
import { lazyWithRetry } from '../utils/chunkLoadRecovery'
import ReadBoardClassesTab from './readBoard/ReadBoardClassesTab'
import ReadBoardScheduleTab from './readBoard/ReadBoardScheduleTab'
import './readBoard/PublicBrowse.css'

const ReadBoardEventsTab = lazyWithRetry(() => import('./readBoard/ReadBoardEventsTab'))
const ReadBoardHighlightsTab = lazyWithRetry(() => import('./readBoard/ReadBoardHighlightsTab'))

type TabType = 'classes' | 'schedule' | 'events' | 'highlights'

const HASH_TO_TAB: Record<string, TabType> = {
  '#classes': 'classes',
  '#schedule': 'schedule',
  '#events': 'events',
  '#calendar': 'events',
  '#highlights': 'highlights',
}

const TAB_LABELS: { id: TabType; label: string }[] = [
  { id: 'classes', label: 'Classes Offered' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'events', label: 'Events' },
  { id: 'highlights', label: 'Highlights' },
]

const ReadBoard = () => {
  const location = useLocation()
  const linkedTab = HASH_TO_TAB[location.hash]
  const activeTab = linkedTab ?? 'classes'

  useEffect(() => {
    if (!linkedTab) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(linkedTab)?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
    return () => cancelAnimationFrame(frame)
  }, [linkedTab, location.key])

  useEffect(() => {
    if (activeTab === 'schedule') {
      trackEvent('schedule_view', location.pathname, {
        properties: { source: 'read_board' },
      })
    }
  }, [activeTab, location.pathname])

  return (
    <div className="np-browse-page">
      <section className="np-browse-hero">
        <div className="np-browse-container">
          <div className="np-browse-intro">
            <p className="np-browse-eyebrow">Find your next step</p>
            <h1>Classes &amp; schedules.</h1>
            <p className="np-browse-description">
              Browse class times, camps, and events at our Bowie gym.
              {' '}For competition, see <Link className="underline" to="/gymnastics#competitive-gymnastics-team">how gymnastics team placement works</Link>.
              {' '}If you’re still choosing an activity, <Link className="underline" to={BOWIE_YOUTH_SPORTS_GUIDE.path}>compare youth sports in Bowie</Link>.
            </p>
          </div>

          <nav className="np-browse-tabs" aria-label="Browse classes and updates">
              {TAB_LABELS.map(({ id, label }) => (
                <Link
                  key={id}
                  id={id === 'schedule' ? undefined : id}
                  to={{ pathname: location.pathname, search: location.search, hash: `#${id}` }}
                  aria-current={activeTab === id ? 'location' : undefined}
                  className={`np-browse-tab${activeTab === id ? ' is-active' : ''}`}
                >
                  {label}
                  {activeTab === id && (
                    <motion.span
                      className="np-browse-tab-line"
                      layoutId="activeTab"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </Link>
              ))}
          </nav>
        </div>
      </section>

      {activeTab === 'classes' && <ReadBoardClassesTab />}
      {(activeTab === 'events' || activeTab === 'highlights') && (
        <div data-prerender-dynamic="">
          <Suspense fallback={<p className="np-browse-container py-6" role="status">Loading {activeTab}…</p>}>
            {activeTab === 'events' ? <ReadBoardEventsTab /> : <ReadBoardHighlightsTab />}
          </Suspense>
        </div>
      )}
      <ReadBoardScheduleTab showCalendar={activeTab === 'schedule'} />
    </div>
  )
}

export default ReadBoard
