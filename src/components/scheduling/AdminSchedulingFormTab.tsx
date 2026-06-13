import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import AdminSchedulingSignupFields from './AdminSchedulingSignupFields'
import { mergeSignupFieldsForSave } from '../../config/schedulingSignupFields'
import { updateTopProgram, type TopProgram } from '../../utils/programsApi'

interface Props {
  program: TopProgram
  onSaved: (program: TopProgram) => void
}

const AdminSchedulingFormTab = ({ program, onSaved }: Props) => {
  const [signupFields, setSignupFields] = useState<string[]>(
    program.schedulingSignupFields ?? ['first_name', 'last_name', 'email'],
  )
  const [mandateWaiver, setMandateWaiver] = useState(program.schedulingMandateWaiver ?? false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSignupFields(program.schedulingSignupFields ?? ['first_name', 'last_name', 'email'])
    setMandateWaiver(program.schedulingMandateWaiver ?? false)
    setSaved(false)
  }, [program])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const merged = mergeSignupFieldsForSave(signupFields, mandateWaiver)
      const updated = await updateTopProgram(program.id, {
        schedulingSignupFields: merged,
        schedulingMandateWaiver: mandateWaiver,
      })
      onSaved(updated)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 w-full">
      <div>
        <h3 className="text-lg font-bold text-black">Form</h3>
        <p className="text-sm text-gray-600 mt-1">
          Default signup fields for new classes and events under this program.
        </p>
      </div>
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
          onClick={handleSave}
          disabled={saving}
          className="bg-vortex-red text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save form defaults
        </button>
        {saved && <span className="text-green-600 text-sm font-medium">Saved</span>}
      </div>
    </div>
  )
}

export default AdminSchedulingFormTab
