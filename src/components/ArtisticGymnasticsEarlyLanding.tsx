import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle, Shield, Users, Sparkles, Heart } from 'lucide-react'
import HeroBackgroundVideo from './HeroBackgroundVideo'

interface ArtisticGymnasticsEarlyLandingProps {
  onSignUpClick?: () => void
}

const JACKRABBIT_URL = 'https://app3.jackrabbitclass.com/regv2.asp?id=557920'

/**
 * Campaign 1: Artistic Gymnastics – Mommy & Me + Preschool (Ages 2–5)
 * Target: Mom (25–40), wants confidence building, safe environment, structure without pressure
 * Theme: "Confidence Starts Early."
 */
const ArtisticGymnasticsEarlyLanding = ({ onSignUpClick }: ArtisticGymnasticsEarlyLandingProps) => {
  return (
    <div className="min-h-screen bg-white">
      {/* HERO SECTION */}
      <section className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black pt-20">
        <HeroBackgroundVideo
          videoFileName="artistic_gymnastics.mp4"
          posterFileName="campaign_early_dev_hero.jpg"
          imageOnly
          playRequested={false}
          className="absolute inset-0 w-full h-full object-cover"
          overlayClassName="absolute inset-0 bg-black/50 z-[1] pointer-events-none"
          onVideoReady={() => {}}
          onVideoError={() => {}}
        />
        <div className="absolute inset-0 z-[1]">
          <motion.div
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-vortex-red/20 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-vortex-red/10 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="container-custom relative z-10 flex min-h-[calc(100vh-5rem)] flex-col justify-center py-16 text-center">
          <motion.h1
            className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white mb-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Confidence <span className="text-vortex-red">Starts Early.</span>
          </motion.h1>
          <motion.p
            className="mx-auto max-w-3xl text-xl md:text-2xl text-gray-300 leading-relaxed mb-10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            Structured early development gymnastics for ages 2–5, building balance, coordination, and courage from the very first class.
          </motion.p>
          <motion.a
            href={JACKRABBIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 bg-vortex-red text-white px-12 py-6 rounded-xl font-bold text-xl shadow-2xl transition-all duration-300 hover:bg-red-700 hover:scale-105 hover:shadow-red-500/50 group mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span>Start Your Child&apos;s Journey</span>
            <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
          </motion.a>

          {/* Scroll indicator */}
          <motion.div
            className="flex justify-center mt-12"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
              <motion.div
                className="w-1 h-3 bg-vortex-red rounded-full mt-2"
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 1 – Built Early. Built Right. */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6 text-center">
              Built Early. <span className="text-vortex-red">Built Right.</span>
            </h2>
            <p className="text-lg text-gray-700 text-center leading-relaxed mb-8 max-w-2xl mx-auto">
            They may be small, but their potential isn't. The early years are where athletic wiring is built — balance, coordination, body awareness, and confidence.               You&apos;re not here for playtime. You&apos;re here because you understand something bigger: Foundations built early create advantages that last.
            </p>
            <p className="text-lg text-gray-700 text-center leading-relaxed mb-10 max-w-2xl mx-auto">
              At Vortex, we don&apos;t sell open gym or playtime entertainment. We run structured and development-focused environments where every movement has intention.
            </p>

            {/* Every roll / Every jump / Every obstacle – triplet */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {[
                { line: 'Every roll', sub: 'teaches control.' },
                { line: 'Every jump', sub: 'builds power.' },
                { line: 'Every obstacle', sub: 'builds courage.' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="bg-gray-200 rounded-2xl p-6 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <p className="text-xl font-display font-bold text-vortex-red mb-1">{item.line}</p>
                  <p className="text-lg text-gray-700">{item.sub}</p>
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-xl font-semibold text-vortex-red mb-2">
                <span className="text-black">Small bodies.</span>{' '}
                <span className="text-vortex-red">BIG potential.</span>
              </p>
              <p className="text-xl text-gray-700">
                Built correctly from the start.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2 – Our Early Development Track */}
      <section className="section-padding bg-gray-200 border-t border-b border-gray-300">
        <div className="container-custom">
          <motion.h2
            className="text-4xl md:text-5xl font-display font-bold text-black mb-12 text-center"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            Our Early <span className="text-vortex-red">Development</span> Track
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Dust Devils */}
            <motion.div
              className="bg-white rounded-2xl p-8 shadow-lg border-2 border-gray-100 hover:border-vortex-red/20 transition-all"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 bg-vortex-red/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Heart className="w-7 h-7 text-vortex-red" />
                </div>
                <div className="text-left">
                  <h3 className="text-2xl font-display font-bold text-black">
                    Dust Devils — Mommy & Me
                  </h3>
                  <p className="text-gray-500 text-lg font-sans">(Ages 2–3)</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4">
                Parent-assisted exploration focused on:
              </p>
              <ul className="space-y-2 mb-4">
                {['Balance', 'Rolling', 'Jumping', 'Obstacle confidence', 'Listening skills'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Little Twisters */}
            <motion.div
              className="bg-white rounded-2xl p-8 shadow-lg border-2 border-gray-100 hover:border-vortex-red/20 transition-all"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 bg-vortex-red/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-7 h-7 text-vortex-red" />
                </div>
                <div className="text-left">
                  <h3 className="text-2xl font-display font-bold text-black">
                    Little Twisters — Preschool
                  </h3>
                  <p className="text-gray-500 text-lg font-sans">(Ages 4–5)</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4">
                Your child builds:
              </p>
              <ul className="space-y-2">
                {['Body awareness', 'Introductory gymnastics skills', 'Coordination', 'Independence', 'Confidence in structured learning'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-vortex-red flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <p className="text-xl font-semibold text-center text-vortex-red mt-10">
            This isn&apos;t free play. It&apos;s guided development.
          </p>
        </div>
      </section>

      {/* SECTION 3 – Why Vortex Is Different */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-8 text-center">
              Why <span className="text-vortex-red">Vortex</span> Is Different
            </h2>
            <p className="text-lg text-gray-700 mb-8 text-center">
              At Vortex, we treat even our youngest athletes like athletes.
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {[
                'Neuromuscular control',
                'Safe landing mechanics',
                'Balance and spatial awareness',
                'Early flexibility and strength',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 bg-gray-200 rounded-xl px-6 py-4">
                  <CheckCircle className="w-6 h-6 text-vortex-red flex-shrink-0" />
                  <span className="text-gray-800 font-medium">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xl font-semibold text-center text-vortex-red">
              The earlier confidence is built, the stronger the foundation becomes.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SECTION 4 – Safety & Coaching */}
      <section className="section-padding bg-vortex-red">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-8 text-center">
              Safety & Coaching
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Shield, label: 'Professional coaching staff' },
                { icon: CheckCircle, label: 'Structured progressions' },
                { icon: Users, label: 'Small class ratios' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="bg-white rounded-xl p-6 shadow-md flex flex-col items-center text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <item.icon className="w-10 h-10 text-vortex-red mb-3" />
                  <p className="text-gray-800 font-medium">{item.label}</p>
                </motion.div>
              ))}
            </div>
            <p className="text-center text-white mt-6">
              Clean, organized facility. Development-focused environment.
            </p>
            <p className="text-xl font-bold text-center text-white mt-4">
              Your child will feel safe.<br />
              You will feel confident.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SECTION 5 – CTA */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="max-w-2xl mx-auto text-center"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 text-black">
              Strong starts create <span className="text-vortex-red">strong futures.</span>
            </h2>
            <p className="text-xl text-gray-700 mb-10 max-w-2xl mx-auto">
              Book your trial class today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.a
                href={JACKRABBIT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-vortex-red border-2 border-vortex-red text-white px-10 py-5 rounded-xl font-bold text-lg transition-all duration-300 hover:bg-red-700 hover:border-red-700 hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Here
              </motion.a>
              {onSignUpClick && (
                <motion.button
                  type="button"
                  onClick={onSignUpClick}
                  className="inline-block border-2 border-vortex-red bg-transparent text-vortex-red px-10 py-5 rounded-xl font-bold text-lg transition-all duration-300 hover:bg-vortex-red/10 hover:scale-105"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Have Questions? Inquire
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default ArtisticGymnasticsEarlyLanding
