import { useState, useEffect } from 'react'
import {
  getStoredConsent,
  initCrossDomainConsent,
  saveConsent,
  shouldShowCookieConsent,
} from '../utils/consent'
import { getHubSiteUrl } from '../utils/crossDomainConsent'

const consentChoice =
  'min-h-11 rounded-lg border border-gray-500 px-1.5 text-[13px] font-semibold hover:bg-gray-800 md:min-h-0 md:px-4 md:py-2 md:text-sm'

const CookieConsent = () => {
  const [visible, setVisible] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    let active = true
    initCrossDomainConsent().then(() => {
      if (active) setVisible(shouldShowCookieConsent())
    })
    return () => {
      active = false
    }
  }, [])

  const applyConsent = (analytics: boolean, marketing: boolean) => {
    void saveConsent({ analytics, marketing })
    setVisible(false)
  }

  const openSettings = () => {
    const stored = getStoredConsent()
    setAnalytics(stored?.analytics ?? false)
    setMarketing(stored?.marketing ?? false)
    setShowSettings(true)
    setVisible(true)
  }

  if (!visible) {
    return (
      <button
        type="button"
        onClick={openSettings}
        className="fixed bottom-3 right-3 z-[90] min-h-11 rounded-full md:min-h-0 border border-gray-600 bg-black/90 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-vortex-red"
        aria-label="Open cookie settings"
        data-prerender-dynamic=""
      >
        Cookie settings
      </button>
    )
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] max-h-[100dvh] overflow-y-auto overscroll-contain border-t border-gray-700 bg-black/95 px-3 py-2 text-white shadow-2xl md:p-6"
      role="dialog"
      aria-label="Cookie consent"
      data-prerender-dynamic=""
    >
      <div className="mx-auto max-w-4xl md:px-8 lg:px-12">
        {!showSettings ? (
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="max-w-2xl text-[13px] leading-[17px] text-gray-200 md:text-sm">
              <h2 className="inline font-semibold text-white md:mb-1 md:block">
                Privacy &amp; cookies<span className="md:hidden">.</span>
              </h2>
              {' '}
              <p className="inline md:block">
                Necessary cookies run the site. With your permission, we use analytics cookies to improve
                programs and marketing cookies for relevant ads. We don&apos;t use cookies to build ad audiences
                from children&apos;s information.{' '}
                <a
                  href={getHubSiteUrl('/privacy-policy')}
                  className="font-medium text-red-400 hover:underline"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-[1fr_1.4fr_1fr] gap-1.5 md:flex md:flex-wrap md:gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className={consentChoice + ' md:font-normal'}
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => applyConsent(false, false)}
                className={consentChoice + ' md:font-normal'}
              >
                Necessary only
              </button>
              <button
                type="button"
                onClick={() => applyConsent(true, true)}
                className={consentChoice + ' md:border-transparent md:bg-vortex-red md:hover:bg-red-700'}
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-4">
            <h2 className="font-semibold">Cookie settings</h2>
            <label className="flex min-h-11 items-center gap-3 text-sm opacity-70 md:min-h-0">
              <input type="checkbox" checked disabled className="rounded" />
              Necessary (required)
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm md:min-h-0">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="rounded text-vortex-red focus:ring-vortex-red"
              />
              Analytics (helps us understand which pages and programs families view)
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm md:min-h-0">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="rounded text-vortex-red focus:ring-vortex-red"
              />
              Marketing (optional ads/remarketing where permitted)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="min-h-11 rounded-lg border border-gray-500 px-4 py-2 text-sm md:min-h-0"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => applyConsent(analytics, marketing)}
                className="min-h-11 rounded-lg bg-vortex-red px-4 py-2 text-sm font-semibold md:min-h-0"
              >
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CookieConsent
