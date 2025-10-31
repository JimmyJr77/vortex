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

interface SessionData {
  startTime: number
  endTime?: number
  pageViews: number
  path: string
}

const STORAGE_KEYS = {
  PAGE_VIEWS: 'vortex_page_views',
  ENGAGEMENT: 'vortex_engagement',
  SESSIONS: 'vortex_sessions',
  UNIQUE_VISITORS: 'vortex_unique_visitors',
  LAST_SESSION: 'vortex_last_session'
}

export const trackPageView = (path: string) => {
  try {
    const pageView: PageView = {
      path,
      timestamp: Date.now(),
      referrer: document.referrer || undefined,
      userAgent: navigator.userAgent
    }

    const existing = getStoredData<PageView[]>(STORAGE_KEYS.PAGE_VIEWS) || []
    existing.push(pageView)
    
    // Keep only last 1000 page views
    const recent = existing.slice(-1000)
    setStoredData(STORAGE_KEYS.PAGE_VIEWS, recent)

    // Track unique visitors
    trackUniqueVisitor()

    // Track session
    trackSession(path)
  } catch (error) {
    console.error('Error tracking page view:', error)
  }
}

export const trackEngagement = (type: EngagementEvent['type'], target: string, path: string) => {
  try {
    const event: EngagementEvent = {
      type,
      target,
      timestamp: Date.now(),
      path
    }

    const existing = getStoredData<EngagementEvent[]>(STORAGE_KEYS.ENGAGEMENT) || []
    existing.push(event)
    
    // Keep only last 500 events
    const recent = existing.slice(-500)
    setStoredData(STORAGE_KEYS.ENGAGEMENT, recent)
  } catch (error) {
    console.error('Error tracking engagement:', error)
  }
}

const trackUniqueVisitor = () => {
  try {
    const visitorId = getVisitorId()
    const uniqueVisitors = getStoredData<Set<string>>(STORAGE_KEYS.UNIQUE_VISITORS)
    
    // Convert Set to array for storage
    const visitorsArray = uniqueVisitors ? Array.from(uniqueVisitors) : []
    const visitorsSet = new Set(visitorsArray)
    
    visitorsSet.add(visitorId)
    
    // Convert back to array for storage
    setStoredData(STORAGE_KEYS.UNIQUE_VISITORS, Array.from(visitorsSet))
  } catch (error) {
    console.error('Error tracking unique visitor:', error)
  }
}

const trackSession = (path: string) => {
  try {
    const lastSession = getStoredData<SessionData>(STORAGE_KEYS.LAST_SESSION)
    const now = Date.now()
    
    // New session if more than 30 minutes since last page view
    if (!lastSession || (now - lastSession.startTime) > 30 * 60 * 1000) {
      const sessions = getStoredData<SessionData[]>(STORAGE_KEYS.SESSIONS) || []
      
      // End previous session if exists
      if (lastSession && !lastSession.endTime) {
        lastSession.endTime = now
        sessions.push(lastSession)
      }

      // Start new session
      const newSession: SessionData = {
        startTime: now,
        pageViews: 1,
        path
      }
      
      setStoredData(STORAGE_KEYS.LAST_SESSION, newSession)
      setStoredData(STORAGE_KEYS.SESSIONS, sessions.slice(-100)) // Keep last 100 sessions
    } else {
      // Continue existing session
      lastSession.pageViews++
      setStoredData(STORAGE_KEYS.LAST_SESSION, lastSession)
    }
  } catch (error) {
    console.error('Error tracking session:', error)
  }
}

const getVisitorId = (): string => {
  let visitorId = localStorage.getItem('vortex_visitor_id')
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('vortex_visitor_id', visitorId)
  }
  return visitorId
}

const getStoredData = <T>(key: string): T | null => {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

const setStoredData = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error('Error storing data:', error)
  }
}

export const getAnalyticsData = () => {
  const pageViews = getStoredData<PageView[]>(STORAGE_KEYS.PAGE_VIEWS) || []
  const engagement = getStoredData<EngagementEvent[]>(STORAGE_KEYS.ENGAGEMENT) || []
  const sessions = getStoredData<SessionData[]>(STORAGE_KEYS.SESSIONS) || []
  const lastSession = getStoredData<SessionData>(STORAGE_KEYS.LAST_SESSION)
  const uniqueVisitors = getStoredData<string[]>(STORAGE_KEYS.UNIQUE_VISITORS) || []

  // Calculate page view stats
  const pageViewStats: Record<string, number> = {}
  pageViews.forEach(pv => {
    pageViewStats[pv.path] = (pageViewStats[pv.path] || 0) + 1
  })

  // Calculate engagement stats
  const engagementStats: Record<string, number> = {}
  engagement.forEach(event => {
    const key = `${event.type}_${event.target}`
    engagementStats[key] = (engagementStats[key] || 0) + 1
  })

  // Calculate button click stats
  const buttonClicks = engagement.filter(e => e.type === 'button_click')
  const buttonStats: Record<string, number> = {}
  buttonClicks.forEach(event => {
    buttonStats[event.target] = (buttonStats[event.target] || 0) + 1
  })

  // Calculate total session time
  const allSessions = [...sessions]
  if (lastSession) {
    allSessions.push(lastSession)
  }
  const totalSessionTime = allSessions.reduce((total, session) => {
    const duration = session.endTime 
      ? session.endTime - session.startTime 
      : Date.now() - session.startTime
    return total + duration
  }, 0)

  const avgSessionTime = allSessions.length > 0 
    ? Math.round(totalSessionTime / allSessions.length / 1000 / 60) // minutes
    : 0

  const totalPageViews = pageViews.length
  const totalEngagement = engagement.length
  const totalSessions = allSessions.length
  const uniqueVisitorCount = uniqueVisitors.length

  // Get most popular pages
  const sortedPages = Object.entries(pageViewStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }))

  // Get most clicked buttons
  const sortedButtons = Object.entries(buttonStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([button, count]) => ({ button, count }))

  // Calculate engagement rate (clicks per page view)
  const engagementRate = totalPageViews > 0 
    ? ((totalEngagement / totalPageViews) * 100).toFixed(1)
    : '0.0'

  return {
    totalPageViews,
    totalEngagement,
    totalSessions,
    uniqueVisitorCount,
    avgSessionTime,
    engagementRate,
    pageViewStats: sortedPages,
    buttonStats: sortedButtons,
    recentPageViews: pageViews.slice(-20).reverse(),
    recentEngagement: engagement.slice(-20).reverse()
  }
}

export const clearAnalyticsData = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
    localStorage.removeItem('vortex_visitor_id')
  } catch (error) {
    console.error('Error clearing analytics:', error)
  }
}

