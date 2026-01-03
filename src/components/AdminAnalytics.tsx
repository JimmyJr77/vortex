import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, X, BarChart3, Users, Eye, MousePointer, Clock, TrendingUp } from 'lucide-react'
import { getAnalyticsData, clearAnalyticsData } from '../utils/analytics'

interface PageView {
  path: string
  timestamp: number
  referrer?: string
  userAgent?: string
}

interface EngagementEvent {
  type: 'page_view' | 'button_click' | 'form_open' | 'link_click'
  target: string
  timestamp: number
  path: string
}

interface AnalyticsData {
  totalPageViews: number
  totalEngagement: number
  totalSessions: number
  uniqueVisitorCount: number
  avgSessionTime: number
  engagementRate: string
  pageViewStats: Array<{ path: string; count: number }>
  buttonStats: Array<{ button: string; count: number }>
  recentPageViews: PageView[]
  recentEngagement: EngagementEvent[]
}

export default function AdminAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)

  const loadAnalytics = () => {
    const data = getAnalyticsData()
    setAnalyticsData(data)
  }

  const handleClearAnalytics = () => {
    if (confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
      clearAnalyticsData()
      loadAnalytics()
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [])

  return (
    <motion.div
      key="analytics"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Action Buttons */}
      <div className="flex justify-end gap-2 mb-6">
        <motion.button
          onClick={loadAnalytics}
          className="flex items-center space-x-2 bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors text-sm"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden md:inline">Refresh</span>
        </motion.button>
        <motion.button
          onClick={handleClearAnalytics}
          className="flex items-center space-x-2 bg-red-700 text-white px-3 md:px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition-colors text-sm"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <X className="w-4 h-4" />
          <span className="hidden md:inline">Clear Data</span>
        </motion.button>
      </div>

      {/* Analytics Content */}
      {!analyticsData ? (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
          <div className="text-center py-12 text-gray-600">Loading analytics...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">
              Overview Statistics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-3 mb-2">
                  <Eye className="w-6 h-6 text-vortex-red" />
                  <span className="text-gray-600 text-sm">Total Page Views</span>
                </div>
                <div className="text-3xl font-bold text-black">{analyticsData.totalPageViews.toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-3 mb-2">
                  <Users className="w-6 h-6 text-vortex-red" />
                  <span className="text-gray-600 text-sm">Unique Visitors</span>
                </div>
                <div className="text-3xl font-bold text-black">{analyticsData.uniqueVisitorCount.toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-3 mb-2">
                  <MousePointer className="w-6 h-6 text-vortex-red" />
                  <span className="text-gray-600 text-sm">Total Engagement</span>
                </div>
                <div className="text-3xl font-bold text-black">{analyticsData.totalEngagement.toLocaleString()}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-3 mb-2">
                  <Clock className="w-6 h-6 text-vortex-red" />
                  <span className="text-gray-600 text-sm">Avg Session Time</span>
                </div>
                <div className="text-3xl font-bold text-black">{analyticsData.avgSessionTime}</div>
                <div className="text-xs text-gray-600 mt-1">minutes</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-3 mb-2">
                  <TrendingUp className="w-6 h-6 text-vortex-red" />
                  <span className="text-gray-600 text-sm">Engagement Rate</span>
                </div>
                <div className="text-3xl font-bold text-black">{analyticsData.engagementRate}%</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-3 mb-2">
                  <BarChart3 className="w-6 h-6 text-vortex-red" />
                  <span className="text-gray-600 text-sm">Total Sessions</span>
                </div>
                <div className="text-3xl font-bold text-black">{analyticsData.totalSessions.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Most Popular Pages */}
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
            <h3 className="text-xl md:text-2xl font-display font-bold text-black mb-4">
              Most Popular Pages
            </h3>
            <div className="space-y-2">
              {analyticsData.pageViewStats.length > 0 ? (
                analyticsData.pageViewStats.map((page, index) => (
                  <div key={page.path} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-vortex-red/20 rounded-lg flex items-center justify-center text-vortex-red font-bold">
                        {index + 1}
                      </div>
                      <span className="text-black font-medium">{page.path === '/' ? 'Home' : page.path}</span>
                    </div>
                    <div className="text-vortex-red font-bold">{page.count.toLocaleString()} views</div>
                  </div>
                ))
              ) : (
                <div className="text-gray-600 text-center py-4">No page view data yet</div>
              )}
            </div>
          </div>

          {/* Most Clicked Buttons */}
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
            <h3 className="text-xl md:text-2xl font-display font-bold text-black mb-4">
              Most Clicked Buttons
            </h3>
            <div className="space-y-2">
              {analyticsData.buttonStats.length > 0 ? (
                analyticsData.buttonStats.map((button, index) => (
                  <div key={button.button} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-vortex-red/20 rounded-lg flex items-center justify-center text-vortex-red font-bold">
                        {index + 1}
                      </div>
                      <span className="text-black font-medium">{button.button}</span>
                    </div>
                    <div className="text-vortex-red font-bold">{button.count.toLocaleString()} clicks</div>
                  </div>
                ))
              ) : (
                <div className="text-gray-600 text-center py-4">No button click data yet</div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
              <h3 className="text-xl md:text-2xl font-display font-bold text-black mb-4">
                Recent Page Views
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {analyticsData.recentPageViews.length > 0 ? (
                  analyticsData.recentPageViews.map((pv, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-200">
                      <div className="text-black font-medium">{pv.path === '/' ? 'Home' : pv.path}</div>
                      <div className="text-gray-600 text-xs mt-1">
                        {new Date(pv.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-600 text-center py-4">No recent page views</div>
                )}
              </div>
            </div>

            <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg border border-gray-200">
              <h3 className="text-xl md:text-2xl font-display font-bold text-black mb-4">
                Recent Engagement
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {analyticsData.recentEngagement.length > 0 ? (
                  analyticsData.recentEngagement.map((event, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-black font-medium">{event.type.replace('_', ' ')}</span>
                        <span className="text-vortex-red text-xs">{event.target}</span>
                      </div>
                      <div className="text-gray-600 text-xs mt-1">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-600 text-center py-4">No recent engagement</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

