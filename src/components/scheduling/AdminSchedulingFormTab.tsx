import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import AdminSchedulingSignupFields from './AdminSchedulingSignupFields'
import { mergeSignupFieldsForSave } from '../../config/schedulingSignupFields'
import { adminUpdateSignupFields } from '../../utils/schedulingApi'

interface Props {
  formId: number
  initialSignupFields: string[]
  initialMandateWaiver: boolean
  selectAllFields?: boolean
  onSaved: () => void | Promise<void>
  onContinue: () => void
}

const AdminSchedulingFormTab = ({
  formId,
  initialSignupFields,
  initialMandateWaiver,
  selectAllFields = false,
  onSaved,
  onContinue,
}: Props) => {
  const [signupFields, setSignupFields] = useState<string[]>(initialSignupFields)
  const [mandateWaiver, setMandateWaiver] = useState(initialMandateWaiver)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSignupFields(initialSignupFields)
    setMandateWaiver(initialMandateWaiver)
    setSaved(false)
  }, [formId, initialSignupFields, initialMandateWaiver, selectAllFields])

  const handleSaveAndContinue = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const merged = mergeSignupFieldsForSave(signupFields, mandateWaiver)
      await adminUpdateSignupFields(formId, merged, mandateWaiver)
      await onSaved()
      setSaved(true)
      onContinue()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 w-full">
      <AdminSchedulingSignupFields
        selected={signupFields}
        waiverEnabled={mandateWaiver}
        onSelectedChange={(fields) => {
          setSignupFields(fields)
          setSaved(false)
        }}
        onWaiverChange={(enabled) => {
          setMandateWaiver(enabled)
          setSaved(false)
        }}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSaveAndContinue}
          disabled={saving}
          className="bg-vortex-red text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save &amp; Continue
        </button>
        {saved && <span className="text-green-600 text-sm font-medium">Saved</span>}
      </div>
    </div>
  )
}

export default AdminSchedulingFormTab
