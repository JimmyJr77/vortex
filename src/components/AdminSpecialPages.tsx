import { useCallback, useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { adminApiRequest } from '../utils/api'
import { clearSpecialPagesCache } from '../hooks/useSpecialPages'
import {
  SPECIAL_PAGE_SITE_OPTIONS,
  type SpecialPageConfig,
} from '../types/specialPages'

export default function AdminSpecialPages() {
  const [pages, setPages] = useState<SpecialPageConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await adminApiRequest('/api/admin/special-pages')
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || 'Unable to load special pages')
      setPages(body.pages || [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load special pages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const update = (pageKey: string, updater: (page: SpecialPageConfig) => SpecialPageConfig) =>
    setPages((current) => current.map((page) => page.key === pageKey ? updater(page) : page))

  const toggleDomain = (
    pageKey: string,
    field: 'siteKeys' | 'navSiteKeys' | 'heroSiteKeys',
    siteKey: string,
    checked: boolean,
  ) => update(pageKey, (page) => {
    const values = checked
      ? [...new Set([...page[field], siteKey])]
      : page[field].filter((key) => key !== siteKey)
    if (field === 'siteKeys' && !checked) {
      return {
        ...page,
        siteKeys: values,
        navSiteKeys: page.navSiteKeys.filter((key) => key !== siteKey),
        heroSiteKeys: page.heroSiteKeys.filter((key) => key !== siteKey),
      }
    }
    return { ...page, [field]: values }
  })

  const save = async (page: SpecialPageConfig) => {
    setSaving(page.key)
    setMessage('')
    try {
      const response = await adminApiRequest(`/api/admin/special-pages/${page.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: page.enabled,
          siteKeys: page.siteKeys,
          navSiteKeys: page.navSiteKeys,
          heroSiteKeys: page.heroSiteKeys,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || 'Unable to save special page')
      update(page.key, () => body.page)
      clearSpecialPagesCache()
      setMessage(`${page.title} saved.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save special page')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading special pages…</div>

  return (
    <div className="p-4 md:p-8 space-y-6 overflow-y-auto">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Special Pages</h2>
        <p className="mt-1 text-sm text-gray-600">
          Publish seasonal pages and choose where each one appears. Turning a page off removes its links and makes its URL unavailable.
        </p>
      </div>
      {message && <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700">{message}</div>}
      {pages.map((page) => (
        <section key={page.key} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-5">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{page.title}</h3>
              <p className="text-sm text-gray-500">{page.path}</p>
            </div>
            <label className="flex items-center gap-2 font-semibold text-gray-800">
              <input
                type="checkbox"
                checked={page.enabled}
                onChange={(event) => update(page.key, (current) => ({ ...current, enabled: event.target.checked }))}
                className="h-5 w-5 accent-vortex-red"
              />
              Live in app
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr><th className="px-5 py-3">Domain</th><th className="px-5 py-3 text-center">Included</th><th className="px-5 py-3 text-center">Main nav</th><th className="px-5 py-3 text-center">Home hero</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {SPECIAL_PAGE_SITE_OPTIONS.map((site) => {
                  const included = page.siteKeys.includes(site.key)
                  return (
                    <tr key={site.key}>
                      <td className="px-5 py-3 font-medium text-gray-800">{site.label}</td>
                      {(['siteKeys', 'navSiteKeys', 'heroSiteKeys'] as const).map((field) => (
                        <td key={field} className="px-5 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={page[field].includes(site.key)}
                            disabled={field !== 'siteKeys' && !included}
                            onChange={(event) => toggleDomain(page.key, field, site.key, event.target.checked)}
                            className="h-5 w-5 accent-vortex-red disabled:opacity-30"
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t border-gray-200 p-4">
            <button type="button" onClick={() => void save(page)} disabled={saving === page.key} className="inline-flex items-center gap-2 rounded-lg bg-vortex-red px-5 py-2.5 font-bold text-white hover:bg-red-700 disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving === page.key ? 'Saving…' : 'Save page'}
            </button>
          </div>
        </section>
      ))}
    </div>
  )
}
