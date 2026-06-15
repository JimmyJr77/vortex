import SummerCampInquiryForm from '../components/SummerCampInquiryForm'
import SeoHead from '../../../components/SeoHead'
import { GYMNASTICS_ORIGIN } from '../../../config/gymnasticsSeo'

const CampInterestPage = () => {
  return (
    <>
      <SeoHead
        title="Summer Camp Inquiry | Vortex Gymnastics, Bowie MD"
        description="Tell us about your camper's interest in Vortex Gymnastics Summer Camp. We'll follow up with everything you need to get registered."
        canonical={`${GYMNASTICS_ORIGIN}/camp_interest`}
      />
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-black">
            Summer Camp Inquiry
          </h1>
          <p className="text-lg text-gray-600 mt-4">
            Let us know your campers interests and we&apos;ll follow up with everything you need to
            get registered.
          </p>
        </div>
        <SummerCampInquiryForm />
      </section>
    </>
  )
}

export default CampInterestPage
