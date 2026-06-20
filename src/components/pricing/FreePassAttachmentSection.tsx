import { useCallback, useEffect, useState } from 'react'
import {
  adminFetchFreePasses,
  adminFetchPassAttachments,
  adminSavePassAttachments,
  type FreePassAttachment,
  type FreePassTemplate,
} from '../../utils/schedulingApi'

interface Props {
  scopeLevel: 'program' | 'class'
  scopeRefId: number
  title?: string
}

const FreePassAttachmentSection = ({
  scopeLevel,
  scopeRefId,
  title = 'Free passes',
}: Props) => {
  const [templates, setTemplates] = useState<FreePassTemplate[]>([])
  const [attachments, setAttachments] = useState<FreePassAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [allTemplates, current] = await Promise.all([
        adminFetchFreePasses(),
        adminFetchPassAttachments(scopeLevel, scopeRefId),
      ])
      setTemplates(allTemplates.filter((t) => t.active))
      setAttachments(current)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pass attachments')
    } finally {
      setLoading(false)
    }
  }, [scopeLevel, scopeRefId])

  useEffect(() => {
    void load()
  }, [load])

  const attachedIds = new Set(attachments.map((a) => a.passTemplateId))

  const toggle = (templateId: number) => {
    setSaved(false)
    if (attachedIds.has(templateId)) {
      setAttachments((prev) => prev.filter((a) => a.passTemplateId !== templateId))
    } else {
      setAttachments((prev) => [
        ...prev,
        {
          scopeLevel,
          scopeRefId,
          passTemplateId: templateId,
          autoApply: true,
          sortOrder: prev.length,
        },
      ])
    }
  }

  const setAutoApply = (templateId: number, autoApply: boolean) => {
    setSaved(false)
    setAttachments((prev) =>
      prev.map((a) => (a.passTemplateId === templateId ? { ...a, autoApply } : a)),
    )
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const data = await adminSavePassAttachments({
        scopeLevel,
        scopeRefId,
        attachments: attachments.map((a, i) => ({
          passTemplateId: a.passTemplateId,
          autoApply: a.autoApply,
          sortOrder: i,
        })),
      })
      setAttachments(data)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div>
        <h4 className="text-sm font-bold text-gray-900">{title}</h4>
        <p className="text-xs text-gray-500 mt-0.5">
          Attached passes auto-apply at enrollment when configured for auto-on-enroll.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-500">Create free pass templates in the Free Passes tab first.</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {templates.map((t) => {
            const attached = attachments.find((a) => a.passTemplateId === t.id)
            return (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded border border-gray-100 px-3 py-2 text-sm"
              >
                <label className="flex items-center gap-2 cursor-pointer min-w-0">
                  <input
                    type="checkbox"
                    checked={Boolean(attached)}
                    onChange={() => toggle(t.id)}
                  />
                  <span className="font-medium text-gray-900 truncate">{t.name}</span>
                </label>
                {attached && (
                  <label className="flex items-center gap-1 text-xs text-gray-600 shrink-0">
                    <input
                      type="checkbox"
                      checked={attached.autoApply}
                      onChange={(e) => setAutoApply(t.id, e.target.checked)}
                    />
                    Auto
                  </label>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving || loading}
          onClick={() => void save()}
          className="px-3 py-1.5 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save attachments'}
        </button>
        {saved && <span className="text-xs text-green-700">Saved</span>}
      </div>
    </div>
  )
}

export default FreePassAttachmentSection
