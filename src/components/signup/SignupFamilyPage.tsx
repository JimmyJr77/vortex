import { useSearchParams } from 'react-router-dom'
import FamilySignupWizard from './FamilySignupWizard'

export default function SignupFamilyPage() {
  const [params] = useSearchParams()
  const mode = params.get('mode')
  const returnTo = params.get('return')

  if (mode === 'minor') {
    return (
      <div className="min-h-screen bg-gray-50 px-4 pb-10 pt-below-site-header">
        <div className="max-w-3xl mx-auto mt-8 md:mt-10 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
          <FamilySignupWizard mode="minor-start" returnTo={returnTo} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-10 pt-below-site-header">
      <div className="max-w-3xl mx-auto mt-8 md:mt-10 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8">
        <FamilySignupWizard mode="public" returnTo={returnTo} />
      </div>
    </div>
  )
}
