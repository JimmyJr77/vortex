import { useSearchParams } from 'react-router-dom'
import FamilySignupWizard from './FamilySignupWizard'

function sameSiteReturn(value: string | null): string | null {
  if (!value?.startsWith('/') || value.startsWith('//')) return null
  const target = new URL(value, window.location.origin)
  if (target.origin !== window.location.origin || target.pathname.startsWith('//')) return null
  return `${target.pathname}${target.search}${target.hash}`
}

export default function SignupFamilyPage() {
  const [params] = useSearchParams()
  const mode = params.get('mode')
  const returnTo = sameSiteReturn(params.get('return'))
  const pendingDropInId = params.get('dropIn')

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
        <FamilySignupWizard mode="public" returnTo={returnTo} pendingDropInId={pendingDropInId} />
      </div>
    </div>
  )
}
