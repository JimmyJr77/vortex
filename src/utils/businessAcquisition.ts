import { getActiveConsent } from './consent'
import { acquisitionReferrer, captureUtmFromLocation, getAttributionPayload, getStoredUtm } from './utmCapture'
import { getSessionId, getVisitorId, isStaffSession } from './visitorId'

export interface BusinessAcquisition {
  source?: string
  medium?: string
  campaign?: string
  referrer?: string
  landingPath?: string
}

function canCaptureAcquisition() {
  return typeof window !== 'undefined' && getActiveConsent().analytics && !isStaffSession()
}

export function getBusinessAcquisition(): BusinessAcquisition | undefined {
  if (!canCaptureAcquisition()) return undefined
  const sessionId = getSessionId(true)
  if (!sessionId) return undefined
  captureUtmFromLocation(window.location.pathname, window.location.search)
  const { last, referrer: referrerOrigin, landingPath } = getStoredUtm(sessionId)
  const { source, medium, campaign } = last
  const referrer = acquisitionReferrer(referrerOrigin)
  if (!source && !medium && !campaign && !referrer && !landingPath) return undefined
  return { source, medium, campaign, referrer, landingPath }
}

export function getInquiryAttributionPayload() {
  if (!canCaptureAcquisition()) return {}
  const acquisition = getBusinessAcquisition()
  return {
    ...getAttributionPayload(),
    visitorId: getVisitorId(true),
    sessionId: getSessionId(true),
    acquisition,
  }
}
