import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { trackEvent } from '../utils/analyticsClient'
import ReadBoardClassesTab from './readBoard/ReadBoardClassesTab'
import ReadBoardScheduleTab from './readBoard/ReadBoardScheduleTab'
import ReadBoardEventsTab from './readBoard/ReadBoardEventsTab'
import ReadBoardHighlightsTab from './readBoard/ReadBoardHighlightsTab'

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
    <div className="min-h-screen bg-vortex-dark">
      <section className="bg-vortex-dark pt-32 pb-0">
        <div className="container-custom">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6">
              Read <span className="text-vortex-red">Board</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Stay informed about classes, events, and important announcements
            </p>
          </motion.div>

          <div className="flex justify-center border-t border-gray-700">
            <div className="flex flex-wrap justify-center">
              {TAB_LABELS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`px-6 md:px-8 py-4 font-semibold text-base md:text-lg transition-all duration-300 relative ${
                    activeTab === id ? 'text-white' : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {label}
                  {activeTab === id && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-1 bg-vortex-red"
                      layoutId="activeTab"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
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
