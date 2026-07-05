import { useState, useEffect } from 'react'
import { initCrossDomainConsent, saveConsent, shouldShowCookieConsent } from '../utils/consent'
import { getHubSiteUrl } from '../utils/crossDomainConsent'

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

  const acceptAll = async () => {
    await saveConsent({ analytics: true, marketing: true })
    setVisible(false)
  }

  const acceptNecessary = async () => {
    await saveConsent({ analytics: false, marketing: false })
    setVisible(false)
  }

  const saveSettings = async () => {
    await saveConsent({ analytics, marketing })
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 bg-black/95 border-t border-gray-700 text-white shadow-2xl"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="container-custom max-w-4xl mx-auto">
        {!showSettings ? (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-sm text-gray-200 max-w-2xl">
              <p className="font-semibold text-white mb-1">Privacy & cookies</p>
              <p>
                We use necessary cookies to run the site. With your permission we use analytics
                cookies to improve our programs and marketing cookies for relevant ads. We do not
                use cookies to build advertising audiences from children&apos;s information. See our{' '}
                <a
                  href={getHubSiteUrl('/privacy-policy')}
                  className="text-vortex-red hover:underline"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="px-4 py-2 rounded-lg border border-gray-500 text-sm hover:bg-gray-800"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={acceptNecessary}
                className="px-4 py-2 rounded-lg border border-gray-500 text-sm hover:bg-gray-800"
              >
                Necessary only
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="px-4 py-2 rounded-lg bg-vortex-red text-sm font-semibold hover:bg-red-700"
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="font-semibold">Cookie settings</p>
            <label className="flex items-center gap-3 text-sm opacity-70">
              <input type="checkbox" checked disabled className="rounded" />
              Necessary (required)
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="rounded text-vortex-red focus:ring-vortex-red"
              />
              Analytics (helps us understand which pages and programs families view)
            </label>
            <label className="flex items-center gap-3 text-sm">
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
                className="px-4 py-2 rounded-lg border border-gray-500 text-sm"
              >
                Back
              </button>
              <button
                type="button"
                onClick={saveSettings}
                className="px-4 py-2 rounded-lg bg-vortex-red text-sm font-semibold"
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
