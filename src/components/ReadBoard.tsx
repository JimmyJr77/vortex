import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
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
  const [activeTab, setActiveTab] = useState<TabType>('classes')

  useEffect(() => {
    const tab = HASH_TO_TAB[location.hash]
    if (tab) setActiveTab(tab)
  }, [location.hash])

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
          <motion.div
            className="np-browse-intro"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="np-browse-eyebrow">Find your next step</p>
            <h1>Classes &amp; schedules.</h1>
            <p className="np-browse-description">
              Find their program. Make room for progress. Explore our classes,
              training times, and everything happening at Vortex.
            </p>
          </motion.div>

          <nav className="np-browse-tabs" aria-label="Browse classes and updates">
              {TAB_LABELS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  aria-pressed={activeTab === id}
                  className={`np-browse-tab${activeTab === id ? ' is-active' : ''}`}
                >
                  {label}
                  {activeTab === id && (
                    <motion.div
                      className="np-browse-tab-line"
                      layoutId="activeTab"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              ))}
          </nav>
        </div>
      </section>

      {activeTab === 'classes' && <ReadBoardClassesTab />}
      {activeTab === 'schedule' && <ReadBoardScheduleTab />}
      {activeTab === 'events' && <ReadBoardEventsTab />}
      {activeTab === 'highlights' && <ReadBoardHighlightsTab />}
    </div>
  )
}

export default ReadBoard
