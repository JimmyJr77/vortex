import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  X,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  FileText,
  Calendar,
  Layout,
} from 'lucide-react'
import { adminApiRequest } from '../utils/api'
import HighlightCanvasEditor from './highlights/HighlightCanvasEditor'
import type {
  Highlight,
  HighlightContentType,
  HighlightFormData,
  HighlightCanvas,
} from '../types/highlights'
import {
  DEFAULT_HIGHLIGHT_BUTTON_LABEL,
  DEFAULT_HIGHLIGHT_CANVAS,
  DISPLAY_FREQUENCY_OPTIONS,
  HIGHLIGHT_SITE_OPTIONS,
} from '../types/highlights'
import {
  HIGHLIGHT_LETTER_WIDTH_PX,
  HIGHLIGHT_CANVAS_HEIGHT_PRESETS,
} from '../utils/highlightLayout'
import { resizeCanvasHeight } from '../utils/highlightCanvas'

const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

const emptyForm = (): HighlightFormData => ({
  title: '',
  contentType: 'event',
  eventId: null,
  documentMime: null,
  documentData: null,
  customContent: { ...DEFAULT_HIGHLIGHT_CANVAS },
  siteKeys: ['hub'],
  displayFrequency: 'first_visit',
  published: false,
  sortOrder: 0,
  buttonEnabled: false,
  buttonLabel: DEFAULT_HIGHLIGHT_BUTTON_LABEL,
  buttonUrl: '',
  buttonTextAbove: '',
  buttonTextBelow: '',
})

interface AdminEventOption {
  id: number
  eventName: string
  startDate: string
  archived?: boolean
}

const contentTypeLabel: Record<HighlightContentType, string> = {
  event: 'Event',
  document: 'Document',
  custom: 'Custom',
}

const AdminHighlights = () => {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [events, setEvents] = useState<AdminEventOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<HighlightFormData>(emptyForm())
  const [eventSearch, setEventSearch] = useState('')

  const loadHighlights = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApiRequest('/api/admin/highlights')
      const data = await res.json()
      if (res.status === 401) {
        throw new Error(
          'Admin session expired or missing. Log out, then log in again from the site (Admin Login).',
        )
      }
      if (res.status === 404 && data.message === 'Route not found') {
        throw new Error(
          'Highlights API is not available on the production backend. Redeploy the Render service (backend folder, latest main) and confirm GET /api/health returns apiFeatures.highlights: true.',
        )
      }
      if (!res.ok) throw new Error(data.message || 'Failed to load highlights')
      setHighlights(data.highlights ?? data.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load highlights')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEvents = useCallback(async () => {
    try {
      const res = await adminApiRequest('/api/admin/events')
      const data = await res.json()
      if (res.ok) {
        const list = data.events ?? data.data ?? []
        setEvents(
          list.map((e: { id: number; eventName: string; startDate: string; archived?: boolean }) => ({
            id: Number(e.id),
            eventName: e.eventName,
            startDate: e.startDate,
            archived: e.archived,
          })),
        )
      }
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    loadHighlights()
    loadEvents()
  }, [loadHighlights, loadEvents])

  const openCreate = () => {
    setEditingId(null)
    setForm({
      ...emptyForm(),
      sortOrder: highlights.length,
    })
    setEventSearch('')
    setShowModal(true)
  }

  const openEdit = (h: Highlight) => {
    setEditingId(h.id)
    setForm({
      title: h.title,
      contentType: h.contentType,
      eventId: h.eventId ?? null,
      documentMime: h.documentMime ?? null,
      documentData: h.documentData ?? null,
      customContent: h.customContent ?? { ...DEFAULT_HIGHLIGHT_CANVAS },
      siteKeys: [...h.siteKeys],
      displayFrequency: h.displayFrequency,
      published: h.published,
      sortOrder: h.sortOrder,
      buttonEnabled: h.buttonEnabled ?? false,
      buttonLabel: h.buttonLabel || DEFAULT_HIGHLIGHT_BUTTON_LABEL,
      buttonUrl: h.buttonUrl || '',
      buttonTextAbove: h.buttonTextAbove || '',
      buttonTextBelow: h.buttonTextBelow || '',
    })
    setEventSearch('')
    setShowModal(true)
  }

  const handleDocumentFile = (file: File) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
    if (!allowed.includes(file.type)) {
      setError('File must be PDF, PNG, JPG, or WEBP')
      return
    }
    if (file.size > DOCUMENT_MAX_BYTES) {
      setError('File must be under 10MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setForm((f) => ({
        ...f,
        documentMime: file.type,
        documentData: result,
      }))
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  const toggleSiteKey = (key: string) => {
    setForm((f) => {
      const has = f.siteKeys.includes(key)
      const siteKeys = has ? f.siteKeys.filter((k) => k !== key) : [...f.siteKeys, key]
      return { ...f, siteKeys: siteKeys.length ? siteKeys : f.siteKeys }
    })
  }

  const saveHighlight = async () => {
    setSaving(true)
    setError(null)
    try {
      if (!form.title.trim()) throw new Error('Title is required')
      if (form.siteKeys.length === 0) throw new Error('Select at least one site')
      if (form.buttonEnabled && !form.buttonUrl.trim()) {
        throw new Error('Enter a link for the action button')
      }

      const body: Record<string, unknown> = {
        title: form.title.trim(),
        contentType: form.contentType,
        siteKeys: form.siteKeys,
        displayFrequency: form.displayFrequency,
        published: form.published,
        sortOrder: form.sortOrder,
        buttonEnabled: form.buttonEnabled,
        buttonLabel: form.buttonEnabled
          ? form.buttonLabel.trim() || DEFAULT_HIGHLIGHT_BUTTON_LABEL
          : null,
        buttonUrl: form.buttonEnabled ? form.buttonUrl.trim() : null,
        buttonTextAbove: form.buttonTextAbove.trim() || null,
        buttonTextBelow: form.buttonEnabled
          ? form.buttonTextBelow.trim() || null
          : null,
      }

      if (form.contentType === 'event') {
        if (!form.eventId) throw new Error('Select an event')
        body.eventId = form.eventId
      } else if (form.contentType === 'document') {
        if (!form.documentMime || !form.documentData) {
          throw new Error('Upload a document')
        }
        body.documentMime = form.documentMime
        body.documentData = form.documentData
      } else {
        body.customContent = form.customContent
      }

      const url = editingId
        ? `/api/admin/highlights/${editingId}`
        : '/api/admin/highlights'
      const res = await adminApiRequest(url, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.status === 401) {
        throw new Error(
          'Admin session expired or missing. Log out, then log in again from the site (Admin Login).',
        )
      }
      if (!res.ok) throw new Error(data.message || 'Save failed')

      setShowModal(false)
      await loadHighlights()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const deleteHighlight = async (id: number) => {
    if (!confirm('Delete this highlight?')) return
    try {
      const res = await adminApiRequest(`/api/admin/highlights/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Delete failed')
      await loadHighlights()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const moveHighlight = async (index: number, direction: 'up' | 'down') => {
    const swap = direction === 'up' ? index - 1 : index + 1
    if (swap < 0 || swap >= highlights.length) return
    const reordered = [...highlights]
    const a = reordered[index]
    const b = reordered[swap]
    reordered[index] = b
    reordered[swap] = a
    const items = reordered.map((h, i) => ({ id: h.id, sortOrder: i }))
    try {
      const res = await adminApiRequest('/api/admin/highlights/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Reorder failed')
      }
      setHighlights(reordered.map((h, i) => ({ ...h, sortOrder: i })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reorder failed')
    }
  }

  const filteredEvents = events.filter((e) => {
    if (e.archived) return false
    const q = eventSearch.toLowerCase()
    if (!q) return true
    return e.eventName.toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-vortex-red" />
            Highlights
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Manage popup highlights per site. Carousel order follows list order.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
        >
          <Plus className="w-5 h-5" />
          New highlight
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading highlights…</div>
      ) : highlights.length === 0 ? (
        <div className="py-12 text-center text-gray-500 border border-dashed rounded-xl">
          No highlights yet. Create one to show on selected sites.
        </div>
      ) : (
        <div className="space-y-3">
          {highlights.map((h, index) => (
            <div
              key={h.id}
              className="flex flex-wrap items-center gap-3 p-4 border border-gray-200 rounded-xl bg-white shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveHighlight(index, 'up')}
                  className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={index === highlights.length - 1}
                  onClick={() => moveHighlight(index, 'down')}
                  className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="font-semibold text-gray-900">{h.title}</div>
                <div className="text-sm text-gray-500 flex flex-wrap gap-2 mt-1">
                  <span className="inline-flex items-center gap-1">
                    {h.contentType === 'event' && <Calendar className="w-3.5 h-3.5" />}
                    {h.contentType === 'document' && <FileText className="w-3.5 h-3.5" />}
                    {h.contentType === 'custom' && <Layout className="w-3.5 h-3.5" />}
                    {contentTypeLabel[h.contentType]}
                  </span>
                  <span>·</span>
                  <span>
                    {DISPLAY_FREQUENCY_OPTIONS.find((o) => o.value === h.displayFrequency)?.label}
                  </span>
                  <span>·</span>
                  <span className={h.published ? 'text-green-700' : 'text-amber-700'}>
                    {h.published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {h.siteKeys.map((k) => (
                    <span
                      key={k}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(h)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  aria-label="Edit"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteHighlight(h.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  aria-label="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold">
                  {editingId ? 'Edit highlight' : 'New highlight'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internal title
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g. Spring camp announcement"
                  />
                </div>

                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-2">
                    Content type
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(['event', 'document', 'custom'] as HighlightContentType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, contentType: t }))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                          form.contentType === t
                            ? 'bg-vortex-red text-white border-vortex-red'
                            : 'bg-white text-gray-700 border-gray-300'
                        }`}
                      >
                        {contentTypeLabel[t]}
                      </button>
                    ))}
                  </div>
                </div>

                {form.contentType === 'event' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select event
                    </label>
                    <input
                      type="search"
                      placeholder="Search events…"
                      value={eventSearch}
                      onChange={(e) => setEventSearch(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2"
                    />
                    <select
                      value={form.eventId ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          eventId: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">Choose an event…</option>
                      {filteredEvents.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.eventName} ({String(e.startDate).slice(0, 10)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {form.contentType === 'document' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Document (PDF or image, max 10MB)
                    </label>
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleDocumentFile(f)
                      }}
                      className="w-full text-sm"
                    />
                    {form.documentData && (
                      <p className="text-sm text-green-700 mt-2">
                        Document loaded ({form.documentMime})
                      </p>
                    )}
                  </div>
                )}

                {form.contentType === 'custom' && form.customContent && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Canvas height
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Width is fixed to the site portal ({HIGHLIGHT_LETTER_WIDTH_PX}px). This
                        sets the custom canvas size only — the public highlight modal keeps its
                        standard height.
                      </p>
                      <select
                        value={form.customContent.height}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            customContent: resizeCanvasHeight(
                              f.customContent as HighlightCanvas,
                              Number(e.target.value),
                            ),
                          }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        {HIGHLIGHT_CANVAS_HEIGHT_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <HighlightCanvasEditor
                      value={form.customContent}
                      onChange={(customContent) => setForm((f) => ({ ...f, customContent }))}
                    />
                  </div>
                )}

                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-2">Sites</span>
                  <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {HIGHLIGHT_SITE_OPTIONS.map((opt) => (
                      <label key={opt.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.siteKeys.includes(opt.key)}
                          onChange={() => toggleSiteKey(opt.key)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auto-show frequency
                  </label>
                  <select
                    value={form.displayFrequency}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        displayFrequency: e.target.value as HighlightFormData['displayFrequency'],
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {DISPLAY_FREQUENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="block text-sm font-medium text-gray-700">
                  Optional text space
                  <textarea
                    value={form.buttonTextAbove}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, buttonTextAbove: e.target.value }))
                    }
                    rows={3}
                    placeholder="Text shown after the highlight content, above the action button (if any)"
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </label>

                <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.buttonEnabled}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          buttonEnabled: e.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm font-medium text-gray-800">
                      Show action button in highlight
                    </span>
                  </label>
                  {form.buttonEnabled && (
                    <>
                      <label className="block text-sm font-medium text-gray-700">
                        Button label
                        <input
                          type="text"
                          value={form.buttonLabel}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, buttonLabel: e.target.value }))
                          }
                          placeholder={DEFAULT_HIGHLIGHT_BUTTON_LABEL}
                          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </label>
                      <label className="block text-sm font-medium text-gray-700">
                        Button link (URL)
                        <input
                          type="url"
                          value={form.buttonUrl}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, buttonUrl: e.target.value }))
                          }
                          placeholder="https://example.com/register"
                          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                          required
                        />
                      </label>
                      <label className="block text-sm font-medium text-gray-700">
                        Text below button (optional)
                        <textarea
                          value={form.buttonTextBelow}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, buttonTextBelow: e.target.value }))
                          }
                          rows={2}
                          placeholder="Short message shown below the button"
                          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </label>
                    </>
                  )}
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                  />
                  <span className="text-sm font-medium">Published (visible on public sites)</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveHighlight}
                  disabled={saving}
                  className="px-6 py-2 rounded-lg bg-vortex-red text-white font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AdminHighlights
