import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BOWIE_YOUTH_SPORTS_GUIDE } from '../config/bowieYouthSportsGuide'
import { trackEvent } from '../utils/analyticsClient'
import ReadBoardClassesTab from './readBoard/ReadBoardClassesTab'
import ReadBoardScheduleTab from './readBoard/ReadBoardScheduleTab'
import ReadBoardEventsTab from './readBoard/ReadBoardEventsTab'
import ReadBoardHighlightsTab from './readBoard/ReadBoardHighlightsTab'
import './readBoard/PublicBrowse.css'

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
              Find classes, schedules, camps, and events in Bowie, MD. Explore{' '}
              <Link className="underline" to="/gymnastics">youth gymnastics</Link> and{' '}
              <Link className="underline" to="/fit-and-flip">Fit &amp; Flip</Link>, or see how to get started with{' '}
              <Link className="underline" to="/adult-gymnastics">adult gymnastics</Link>.
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

      {activeTab !== 'schedule' && (
        <div data-prerender-dynamic="">
          {activeTab === 'classes' && <ReadBoardClassesTab />}
          {activeTab === 'events' && <ReadBoardEventsTab />}
          {activeTab === 'highlights' && <ReadBoardHighlightsTab />}
        </div>
      )}
      <ReadBoardScheduleTab showCalendar={activeTab === 'schedule'} />
    </div>
  )
}

export default ReadBoard
