import { trackEvent } from './analyticsClient'

export type EngagementType = 'page_view' | 'button_click' | 'form_open' | 'link_click'

export const trackEngagement = (
  type: EngagementType,
  target: string,
  path: string,
) => {
  const eventMap: Record<EngagementType, string> = {
    page_view: 'page_view',
    button_click: 'cta_click',
    form_open: 'cta_click',
    link_click: 'link_click',
  }
  trackEvent(eventMap[type] || type, path, {
    properties: { target, legacy_type: type },
  })
}
