import { trackPageViewEvent, trackEvent, flushEvents } from './analyticsClient'

export type EngagementType = 'page_view' | 'button_click' | 'form_open' | 'link_click'

/** @deprecated Admin dashboard uses server analytics; local aggregation removed. */
export const getAnalyticsData = () => ({
  totalPageViews: 0,
  totalEngagement: 0,
  totalSessions: 0,
  uniqueVisitorCount: 0,
  avgSessionTime: 0,
  engagementRate: '0.0',
  pageViewStats: [] as { path: string; count: number }[],
  buttonStats: [] as { button: string; count: number }[],
  recentPageViews: [] as { path: string; timestamp: number }[],
  recentEngagement: [] as { type: string; target: string; timestamp: number; path: string }[],
})

export const clearAnalyticsData = () => {
  /* no-op: server-side analytics */
}

export const trackPageView = (
  path: string,
  options?: { googleAnalytics?: boolean },
) => {
  trackPageViewEvent(path, options)
}

export const trackEngagement = (
  type: EngagementType,
  target: string,
  path: string,
) => {
  const eventMap: Record<EngagementType, string> = {
    page_view: 'page_view',
    button_click: 'cta_click',
    form_open: 'inquiry_form_start',
    link_click: 'link_click',
  }
  trackEvent(eventMap[type] || type, path, {
    properties: { target, legacy_type: type },
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    void flushEvents({ useBeacon: true })
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushEvents({ useBeacon: true })
  })
}
