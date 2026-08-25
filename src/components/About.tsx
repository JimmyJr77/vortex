import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { getSiteEnrollHref } from '../utils/enrollSite'
import { Target, Cpu, Trophy } from 'lucide-react'
import { BUSINESS_NAP, GOOGLE_MAPS_URL } from '../config/contact'

// Custom D1 Icon Component
const D1Icon = ({ className }: { className?: string }) => (
  <span className={className} style={{ 
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '2rem',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%'
  }}>
    D1
  </span>
)

interface AboutProps {
  onSignUpClick?: () => void
  hideStrategicLocation?: boolean
  hideDifference?: boolean
}

export const StrategicLocation = ({ className = '' }: { className?: string }) => (
  <motion.div
    className={`text-center ${className}`}
    initial={{ opacity: 0, y: 50 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8 }}
    viewport={{ once: true }}
  >
    <h3 className="text-3xl font-display font-bold text-black mb-4">
      STRATEGIC LOCATION
    </h3>
    <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-4">
      Located in Bowie, MD, our facility serves athletes across central Maryland
      and beyond.
    </p>
    <div className="text-center">
      <p className="text-lg font-semibold text-vortex-red mb-2">
        {BUSINESS_NAP.streetAddress}, {BUSINESS_NAP.addressLocality},{' '}
        {BUSINESS_NAP.addressRegion} {BUSINESS_NAP.postalCode}
      </p>
      <a
        href={GOOGLE_MAPS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-vortex-red hover:text-red-700 font-semibold transition-colors duration-300"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        View on Google Maps
      </a>
    </div>
  </motion.div>
)

const About = ({ onSignUpClick, hideStrategicLocation = false, hideDifference = false }: AboutProps) => {
  const features = [
    {
      icon: D1Icon,
      title: "Elite Development",
      description: "Developing the 8 core tenets of athleticism: Flexibility, Balance, Coordination, Strength, Explosiveness, Speed, Agility, and Body Control."
    },
    {
      icon: Cpu,
      title: "Technology-Driven",
      description: "Film review, science backed development, and telemetry data create detailed athlete profiles for measurable growth."
    },
    {
      icon: Target,
      title: "Kinematic Awareness",
      description: "Precise understanding of where the body is in space - the key to athleticism that separates champions from competitors."
    },
    {
      icon: Trophy,
      title: "Fail Your Way to Success",
      description: "We teach children to find fun in overcoming adversity and achieving success through a competitive edge mindset."
    }
  ]

  return (
    <section id="about" className="section-padding bg-white">
      <div className="container-custom">
        {!hideDifference && <>
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-5xl md:text-6xl font-display font-bold text-black mb-6">
            THE VORTEX
            <span className="text-vortex-red"> DIFFERENCE</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            We're not just another athletics or gymnastics facility. We're a cutting-edge athletic development 
            center that places gymnastics at the heart of comprehensive athletic training, 
            merging body control and advanced technology with rigorous, science-backed training.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {features.map((feature, index) => {
            const isTechnologyDriven = feature.title === "Technology-Driven"
            const Content = (
              <motion.div
                className="h-full min-h-[19rem] text-center p-6 rounded-2xl bg-gray-200 hover:bg-gray-300 transition-colors duration-300"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                <div className="w-16 h-16 bg-vortex-red rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-black mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            )

            return isTechnologyDriven ? (
              <a key={feature.title} href="#technology" className="block h-full cursor-pointer">
                {Content}
              </a>
            ) : (
              <div key={feature.title} className="h-full">{Content}</div>
            )
          })}
        </div>
        </>}

        {/* Mission Statement */}
        <motion.div
          className="hidden rounded-3xl bg-gradient-to-br from-gray-900 to-black p-12 text-center md:block md:p-16"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-8">
            OUR MISSION
          </h2>
          <p className="text-xl md:text-2xl text-gray-300 max-w-5xl mx-auto leading-relaxed mb-8">
            At Vortex Athletics, our mission is to harness the power of gymnastics and technology to transform 
            youth athletes into champions, regardless of sport. By merging rigorous gymnastics training, 
            advanced technology, and a relentless competitive mindset, we empower each participant to 
            cultivate strength, explosiveness, precise body control, and the resilience to "fail their 
            way to success." We don't merely train athletes. We guide future leaders toward a complete 
            transformation that fuels excellence in every aspect of life.
          </p>
          
          {onSignUpClick && (
            <Link
              to={getSiteEnrollHref()}
              className="inline-block border-2 border-vortex-red text-vortex-red px-10 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-vortex-red hover:text-white hover:scale-105"
            >
              <motion.span
                tabIndex={-1}
                className="inline-block"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Join the Transformation
              </motion.span>
            </Link>
          )}

          <div className="mx-auto mt-14 max-w-5xl border-t border-white/20 pt-12">
            <h2 className="mb-10 text-4xl font-display font-bold text-white md:text-5xl">
              OUR MINDSET
            </h2>
            <div className="space-y-10 text-left">
              <div>
                <h3 className="mb-4 text-2xl font-display font-bold text-white">
                  &ldquo;Fail Your Way to Success&rdquo;
                </h3>
                <p className="text-lg leading-relaxed text-gray-300">
                  We teach children to find fun in overcoming adversity and achieving success
                  through a competitive edge. Our athletes are simultaneously pushed and cared for.
                </p>
              </div>
              <div className="border-t border-white/15 pt-10">
                <h3 className="mb-4 text-2xl font-display font-bold text-white">
                  &ldquo;It&apos;s okay to lose. It&apos;s not okay to be okay with losing.&rdquo;
                </h3>
                <p className="text-lg leading-relaxed text-gray-300">
                  Losing is part of growth—we accept it as feedback, not as fate. What we don&apos;t
                  accept is settling. Our athletes learn to use every loss as fuel to get better,
                  not as permission to stop caring.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.details
          className="group rounded-2xl border border-gray-200 bg-white text-black shadow-lg md:hidden"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 font-display text-2xl font-bold [&::-webkit-details-marker]:hidden">
            <span>OUR MISSION &amp; OUR MINDSET</span>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-2xl font-normal text-white transition-transform duration-300 group-open:rotate-45"
              aria-hidden="true"
            >
              +
            </span>
          </summary>

          <div className="border-t border-gray-200 px-6 pb-8 pt-6">
            <h2 className="mb-4 text-3xl font-display font-bold text-black">
              OUR MISSION
            </h2>
            <p className="text-base leading-relaxed text-gray-700">
              At Vortex Athletics, our mission is to harness the power of gymnastics and technology to transform
              youth athletes into champions, regardless of sport. By merging rigorous gymnastics training,
              advanced technology, and a relentless competitive mindset, we empower each participant to
              cultivate strength, explosiveness, precise body control, and the resilience to &ldquo;fail their
              way to success.&rdquo; We don&apos;t merely train athletes. We guide future leaders toward a complete
              transformation that fuels excellence in every aspect of life.
            </p>

            {onSignUpClick && (
              <Link
                to={getSiteEnrollHref()}
                className="mt-6 inline-block rounded-lg border-2 border-vortex-red px-6 py-3 font-semibold text-vortex-red transition-colors duration-300 hover:bg-vortex-red hover:text-white"
              >
                Join the Transformation
              </Link>
            )}

            <div className="mt-8 border-t border-gray-200 pt-8">
              <h2 className="mb-6 text-3xl font-display font-bold text-black">
                OUR MINDSET
              </h2>
              <div className="space-y-7 text-left">
                <div>
                  <h3 className="mb-3 text-xl font-display font-bold text-black">
                    &ldquo;Fail Your Way to Success&rdquo;
                  </h3>
                  <p className="leading-relaxed text-gray-700">
                    We teach children to find fun in overcoming adversity and achieving success
                    through a competitive edge. Our athletes are simultaneously pushed and cared for.
                  </p>
                </div>
                <div className="border-t border-gray-200 pt-7">
                  <h3 className="mb-3 text-xl font-display font-bold text-black">
                    &ldquo;It&apos;s okay to lose. It&apos;s not okay to be okay with losing.&rdquo;
                  </h3>
                  <p className="leading-relaxed text-gray-700">
                    Losing is part of growth—we accept it as feedback, not as fate. What we don&apos;t
                    accept is settling. Our athletes learn to use every loss as fuel to get better,
                    not as permission to stop caring.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.details>

        {!hideStrategicLocation && <StrategicLocation className="mt-16" />}
      </div>
    </section>
  )
}

export default About
