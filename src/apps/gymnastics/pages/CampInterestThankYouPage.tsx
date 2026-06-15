import { useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import SeoHead from '../../../components/SeoHead'
import { GYMNASTICS_ORIGIN } from '../../../config/gymnasticsSeo'
import { HUB_ORIGIN } from '../../../utils/seo'
import { trackEvent } from '../../../utils/analyticsClient'

const CampInterestThankYouPage = () => {
  useEffect(() => {
    trackEvent('camp_inquiry_thank_you', '/camp_interest/thank-you')
  }, [])

  return (
    <>
      <SeoHead
        title="Thank You | Vortex Gymnastics Summer Camp Inquiry"
        description="Thank you for your summer camp inquiry. Our team will be in touch shortly."
        canonical={`${GYMNASTICS_ORIGIN}/camp_interest/thank-you`}
        robots="noindex, nofollow"
      />
      <section className="bg-gray-50 min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full text-center bg-white rounded-2xl border border-gray-200 shadow-lg p-10">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold text-black mb-4">Thank You!</h1>
          <p className="text-lg text-gray-600 mb-8">
            We&apos;ve received your inquiry and someone from our team will get ahold of you shortly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={HUB_ORIGIN}
              className="inline-flex items-center justify-center gap-2 bg-vortex-red text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              Explore Vortex Athletics
              <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href={GYMNASTICS_ORIGIN}
              className="inline-flex items-center justify-center gap-2 bg-white text-vortex-red border-2 border-vortex-red px-6 py-3 rounded-lg font-semibold hover:bg-red-50 transition-colors"
            >
              Explore Vortex Gymnastics
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    </>
  )
}

export default CampInterestThankYouPage
