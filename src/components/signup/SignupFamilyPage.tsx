import { useSearchParams } from 'react-router-dom'
import FamilySignupWizard from './FamilySignupWizard'
import SignupInvitePage from './SignupInvitePage'

export default function SignupFamilyPage() {
  const [params] = useSearchParams()
  const mode = params.get('mode')

  if (mode === 'minor') {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
          <FamilySignupWizard mode="minor-start" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
        <FamilySignupWizard mode="public" />
      </div>
    </div>
  )
}

export { SignupInvitePage }
