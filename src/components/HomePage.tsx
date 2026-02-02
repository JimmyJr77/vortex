import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { MapPin, Target, Brain, Info, Shield } from 'lucide-react'
import Hero from './Hero'
import ParallaxGym from './ParallaxGym'
import About from './About'
import Programs from './Programs'
import Technology from './Technology'

interface HomePageProps {
  onSignUpClick?: () => void
}

const HomePage = ({ onSignUpClick }: HomePageProps) => {
  const faqs = [
    {
      question: 'Where are you located?',
      answer: 'Our facility is located at 4961 Tesla Dr, Ste E, Bowie, MD 20715. We serve athletes across central Maryland and beyond.'
    },
    {
      question: 'What ages do you serve?',
      answer: 'We offer programs for athletes of all ages, from preschoolers (3-5 years) to adults. Our training is tailored to each age group\'s developmental needs.'
    },
    {
      question: 'Do I need gymnastics experience to register for gymnastics classes?',
      answer: 'No prior gymnastics experience is required! Our programs will teach your athlete fundamentals, reinforce proper technique, and press toward advanced skills as the athlete progresses.'
    },
    {
      question: 'Is Vortex solely a gymnastics studio?',
      answer: 'No. We offer a lot more than just gymnastics. Vortex is a full athletic development studio. We recognize, however, that gymnastics are a core component to athleticism and incorporate tumbling and body awareness into our strength, condition, and fitness regimens.'
    },
    {
      question: 'What makes Vortex different from other gyms?',
      answer: 'Vortex combines rigorous gymnastics training with cutting-edge technology (high-speed cameras, force plates, AI analysis) and a science-backed approach to develop all 8 tenets of athleticism. We focus on transforming athletes, not just training them.'
    },
    {
      question: 'What programs do you offer?',
      answer: 'We offer competitive teams in Trampoline & Tumbling, Artistic Gymnastics, and Rhythmic Gymnastics, plus our Athleticism Accelerator program for cross-sport development, developmental classes, and private coaching.'
    },
    {
      question: 'What is the "Fail your way to success" mindset?',
      answer: 'We teach children to find fun in overcoming adversity and achieving success through a competitive edge. Our athletes are simultaneously pushed and cared for, learning resilience that fuels excellence in every aspect of life.'
    }
  ]

  // YouTube embed: channel uploads playlist ID (UU...) + optional first video ID so the player shows a video (avoids Error 153).
  const youtubeUploadsPlaylistId = 'UUmKOL4DZ6EzdwH_TQ3yPikw'
  const youtubeFirstVideoId = 'bvGYBIgc_H8' // Any video from your channel; update if needed
  const videoLibrary = [
    {
      id: 'youtube',
      platform: 'YouTube',
      title: 'Vortex Athletics Highlights',
      description:
        'Fast-paced drills, athlete highlights, and training tips straight from our YouTube channel.',
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeFirstVideoId}?list=${youtubeUploadsPlaylistId}`,
      link: 'https://www.youtube.com/@VortexAthleticsUSA'
    },
    {
      id: 'instagram',
      platform: 'Instagram',
      title: 'Reels of Athleticism',
      description:
        'Curated Instagram reels showing form, flexibility, and competitive glimpses.',
      link: 'https://www.instagram.com/vortexathletics.usa/',
      reelUrl: 'https://www.instagram.com/reel/DTs3e-YjoEx6yHTnpmrHPBQou0HpgsOS9cicMM0/',
      disabled: true // Grey out until embed works
    },
    {
      id: 'tiktok',
      platform: 'TikTok',
      title: 'Daily Training Snippets',
      description:
        'Short-form workouts, mindset cues, and progress reels coming soon to TikTok.',
      link: 'https://www.tiktok.com/@vortexathleticsusa',
      disabled: true // No account yet; grey out until available
    }
  ]
  const [selectedVideo, setSelectedVideo] = useState(videoLibrary[0])

  type TriadTab = 'what' | 'how' | 'why'
  const [triadTab, setTriadTab] = useState<TriadTab>('what')
  type TriadItem = { name: string; meaning: string }
  const triads: Record<
    TriadTab,
    { title: string; definition: string; whyItMatters: string; itemsLabel: string; items: TriadItem[] }
  > = {
    what: {
      title: 'Athletic Tenets (WHAT we build)',
      definition: 'The core performance qualities we develop—the outcomes athletes gain from training.',
      whyItMatters: 'These define what improves: not just “working out,” but building specific athletic qualities.',
      itemsLabel: 'Tenets we build',
      items: [
        { name: 'Strength', meaning: 'Ability to produce and resist force.' },
        { name: 'Explosiveness', meaning: 'Power and quick, forceful movement.' },
        { name: 'Speed', meaning: 'How fast the body can move.' },
        { name: 'Agility', meaning: 'Quick change of direction and reaction.' },
        { name: 'Flexibility', meaning: 'Range of motion and suppleness.' },
        { name: 'Balance', meaning: 'Stability and control in static and dynamic positions.' },
        { name: 'Coordination', meaning: 'Moving body parts together efficiently.' },
        { name: 'Body Control', meaning: 'Precision and awareness of movement.' }
      ]
    },
    how: {
      title: 'Training Methodologies (HOW we train)',
      definition: 'The tools we use to develop those qualities—how we apply stress and practice.',
      whyItMatters: 'Different tools create different adaptations; method matters as much as effort.',
      itemsLabel: 'Methodologies we use',
      items: [
        { name: 'Resistance & Calisthenics', meaning: 'Weights, bands, and bodyweight strength work.' },
        { name: 'Plyometrics', meaning: 'Jumping and explosive drills that build power.' },
        { name: 'Isometrics', meaning: 'Holding tension in one position to build strength and control.' },
        { name: 'Eccentric / Negative Training', meaning: 'Controlled lengthening under load for resilience.' },
        { name: 'Neural Training', meaning: 'Fast, reactive drills that sharpen reflexes and timing.' },
        { name: 'Balance & Stability Work', meaning: 'Drills that challenge equilibrium and core control.' },
        { name: 'Mobility & Flexibility Drills', meaning: 'Stretching and movement to improve range and recovery.' },
        { name: 'Core & Body Control Work', meaning: 'Targeted work for midsection and movement precision.' }
      ]
    },
    why: {
      title: 'Physiological Emphasis (WHY it works)',
      definition: 'The biological systems each class targets—so adaptation is intentional and safe.',
      whyItMatters: 'Training the right system at the right time leads to smarter, safer progress.',
      itemsLabel: 'Emphases we target',
      items: [
        { name: 'Neural Output & Readiness', meaning: 'Nervous system speed and reaction—how fast the body can fire.' },
        { name: 'Force Capacity & Tissue Capacity', meaning: 'Muscle and tendon strength and durability.' },
        { name: 'SSC & Stiffness (Elastic Energy)', meaning: 'Spring-like rebound and stored energy in movement.' },
        { name: 'Control & Stability', meaning: 'Joint and postural control under load and motion.' },
        { name: 'Movement Intelligence', meaning: 'Skill and pattern quality—doing the right thing at the right time.' }
      ]
    }
  }
  const triadTooltip =
    'Every Vortex class balances athletic outcomes, training methods, and physiological intent—so athletes progress with purpose, not guesswork.'

  // handleSignUp removed - buttons now link directly to enrollment URL

  return (
    <>
      <Hero />

      {/* What We Offer Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              WHAT YOUR ATHLETE WILL GET
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive training that develops every aspect of athletic performance
            </p>
          </motion.div>

          <motion.div
            className="bg-white rounded-2xl p-8 md:p-12 mb-12 border border-vortex-red"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm md:text-base">
              {[
                'Ninja training', 'Acrobatics', 'Trampoline work', 'Resistance training',
                'Plyometrics', 'Calisthenics', 'Isometrics', 'Reflex training',
                'Neural priming', 'Rapid direction change', 'Mobility', 'Tendon conditioning',
                'Eccentric training', 'Coordination games', 'Gymnastics',
                'Tumbling & floor', 'Body control',
                'Higher jumps', 'Faster Sprints', 'Dynamic movement'
              ].map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-vortex-red rounded-full flex-shrink-0" />
                  <span className="text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {onSignUpClick && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-vortex-red text-white px-10 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-red-700 hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Reserve Your Spot
              </motion.a>
            </motion.div>
          )}
        </div>
      </section>

      <section className="section-padding bg-gray-200 border-t border-b border-gray-300">
        <div className="container-custom">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
          >
            <p className="uppercase tracking-[0.3em] text-sm text-gray-500 mb-2">
              Vortex Video Library
            </p>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black">
              Watch our coaches and athletes in action
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto mt-3">
              Binge curated training, highlight reels, and storytelling from YouTube, TikTok, and Instagram — all in one polished gallery.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] items-start">
            <motion.div
              className="relative overflow-hidden rounded-[2.5rem] bg-black/90 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              <div className="relative aspect-video w-full min-h-[400px]">
                {selectedVideo.embedUrl ? (
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={selectedVideo.embedUrl}
                    title={`${selectedVideo.platform} preview`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : 'reelUrl' in selectedVideo && selectedVideo.reelUrl ? (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/80 overflow-auto p-4">
                    <blockquote
                      className="instagram-media"
                      data-instgrm-permalink={selectedVideo.reelUrl}
                      data-instgrm-version="14"
                      style={{ margin: '0 auto', maxWidth: 540, width: '100%' }}
                    >
                      <a href={selectedVideo.reelUrl} target="_blank" rel="noopener noreferrer">
                        View on Instagram
                      </a>
                    </blockquote>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-8 py-6 text-center text-white">
                    <p className="text-xl font-semibold mb-4">Watch this video on {selectedVideo.platform}</p>
                    <p className="text-sm text-white/80 mb-6">{selectedVideo.description}</p>
                    <a
                      href={selectedVideo.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold transition hover:border-white hover:bg-white/10"
                    >
                      Open {selectedVideo.platform}
                    </a>
                  </div>
                )}
              </div>
              <div className="border-t border-white/10 px-6 py-5 text-white/80">
                <p className="text-sm uppercase tracking-wide text-white/70">
                  Current source
                </p>
                <p className="text-lg font-semibold text-white">
                  {selectedVideo.title}
                </p>
                <p className="text-sm text-white/60">
                  {selectedVideo.description}
                </p>
                <a
                  href={selectedVideo.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex text-sm font-semibold text-vortex-red underline"
                >
                  Open on {selectedVideo.platform}
                </a>
              </div>
            </motion.div>

            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              viewport={{ once: true }}
            >
              {videoLibrary.map((video) => {
                const selected = selectedVideo.id === video.id
                const disabled = 'disabled' in video && video.disabled
                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => !disabled && setSelectedVideo(video)}
                    disabled={disabled}
                    className={`flex w-full flex-col rounded-2xl px-6 py-5 text-left transition ${
                      disabled
                        ? 'cursor-not-allowed bg-gray-100 border border-gray-200 text-gray-400 opacity-75'
                        : selected
                          ? 'bg-white border border-vortex-red text-black shadow-xl -translate-x-1'
                          : 'bg-white border border-gray-200 shadow-lg hover:translate-y-[-2px]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold uppercase tracking-[0.3em]">
                        {video.platform}
                      </p>
                      <span
                        className={`text-xs font-bold uppercase ${
                          disabled ? 'text-gray-400' : selected ? 'text-vortex-red' : 'text-gray-400'
                        }`}
                      >
                        {disabled ? 'Coming soon' : selected ? 'Current' : 'Preview'}
                      </span>
                    </div>
                    <h3 className={`mt-3 text-2xl font-display font-bold ${disabled ? 'text-gray-500' : 'text-black'}`}>
                      {video.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {video.description}
                    </p>
                  </button>
                )
              })}
            </motion.div>
          </div>
        </div>
      </section>

      <ParallaxGym />

      <About onSignUpClick={onSignUpClick} />
      <Programs />

      {/* How Vortex Classes Are Built — Triad Selector Card */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              TRAINING <span className="text-4xl md:text-5xl text-vortex-red">PHILOSOPHY</span>
            </h2>
            <p className="text-lg text-gray-600">
              Every class is designed using three connected training lenses—so athletes build real, transferable athleticism.
            </p>
          </motion.div>

          <motion.div
            className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            {/* Tab buttons */}
            <div className="flex border-b border-gray-200">
              {(['what', 'how', 'why'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTriadTab(tab)}
                  className={`flex-1 py-4 px-4 text-sm font-semibold uppercase tracking-wider transition ${
                    triadTab === tab
                      ? 'bg-vortex-red text-white border-b-2 border-vortex-red'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {tab === 'what' ? 'What' : tab === 'how' ? 'How' : 'Why'}
                </button>
              ))}
            </div>

            {/* Card content */}
            <div className="p-6 md:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={triadTab}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-xl md:text-2xl font-display font-bold text-black">
                      {triads[triadTab].title}
                    </h3>
                    <span
                      className="flex-shrink-0 rounded-full p-1.5 text-gray-600 hover:text-gray-700 hover:bg-gray-100 cursor-help"
                      title={triadTooltip}
                      aria-label="More about how triads work together"
                    >
                      <Info className="w-5 h-5" />
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed">
                    {triads[triadTab].definition}
                  </p>
                  <p className="text-sm font-medium text-vortex-red">
                    Why it matters: {triads[triadTab].whyItMatters}
                  </p>
                  <div className="mt-2 pt-4 border-t border-gray-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">
                      {triads[triadTab].itemsLabel}
                    </p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {triads[triadTab].items.map((item, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-vortex-red flex-shrink-0 mt-1.5" />
                          <span>
                            <strong className="text-gray-900">{item.name}</strong>
                            <span className="text-gray-700"> — {item.meaning}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* One-line differentiator */}
            <div className="border-t border-gray-200 bg-gray-200 px-6 md:px-8 py-4">
              <p className="text-sm md:text-base text-gray-700 text-center font-medium italic">
                Vortex classes aren&apos;t random workouts—they&apos;re structured to develop the right qualities, with the right tools, for the right reasons.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <Technology />

      {/* Safety & Coaching Excellence */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="flex items-start space-x-4 mb-6">
              <Shield className="w-12 h-12 text-vortex-red flex-shrink-0" />
              <div>
                <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
                  Safety & Coaching <span className="text-vortex-red">Excellence</span>
                </h2>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8 md:p-12 border-2 border-gray-200">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-3">Certified Excellence</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Our coaches are certified and trained in biomechanics, safe progressions, and youth development. They understand the science behind movement and how to keep athletes safe while pushing boundaries.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black mb-3">Long-Term Body Care</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Warm-ups and cool-downs are designed around joint health and long-term athletic development. We prioritize consistency and form over difficulty, ensuring your athlete develops sustainably.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black mb-3">Progressive Safety</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Every skill builds on the last. We don&apos;t rush progressions or skip steps — athletes master each level before advancing, reducing injury risk and building true competence.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Technology & Mindset Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          {/* Fail Your Way to Success mindset card */}
          <motion.div
              className="bg-vortex-red rounded-2xl p-8 md:p-12 border-2 border-black/20 mb-12"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <Brain className="w-8 h-8 text-white" />
                <h3 className="text-3xl font-display font-bold text-white">
                  "Fail Your Way to Success"
                </h3>
              </div>
              <p className="text-white mb-6 text-lg leading-relaxed">
                We teach children to find fun in overcoming adversity and achieving success through 
                a competitive edge. Our athletes are simultaneously pushed and cared for.
              </p>
              <p className="text-white text-lg leading-relaxed">
                This mindset cultivates resilience that fuels excellence in every aspect of life.
              </p>
            </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section-padding bg-gray-200" id="faq">
        <div className="container-custom">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              FREQUENTLY ASKED <span className="text-vortex-red">QUESTIONS</span>
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to know about Vortex Athletics
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto space-y-6 mb-12">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                className="bg-white rounded-xl shadow-2xl p-6 md:p-8"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <h3 className="text-xl md:text-2xl font-bold text-black mb-3 flex items-start">
                  <Target className="w-6 h-6 text-vortex-red mr-3 flex-shrink-0 mt-1" />
                  {faq.question}
                </h3>
                <p className="text-gray-700 leading-relaxed pl-9">
                  {faq.answer}
                </p>
              </motion.div>
            ))}
          </div>

          {onSignUpClick && (
            <motion.div
              className="text-center bg-vortex-red rounded-2xl p-12 text-white"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h3 className="text-3xl md:text-4xl font-display font-bold mb-4">
                Ready to Perform?
              </h3>
              <p className="text-xl mb-8 text-red-100 max-w-2xl mx-auto">
                Experience the future of athletic development.
              </p>
              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-white text-vortex-red px-12 py-6 rounded-lg font-bold text-xl transition-all duration-300 hover:bg-gray-100 hover:scale-105 shadow-xl"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Enroll now
              </motion.a>
            </motion.div>
          )}
        </div>
      </section>

      {/* Location Section */}
      <section className="section-padding bg-black text-white">
        <div className="container-custom text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-8">
              FIND US
            </h2>
            <div className="flex flex-col items-center space-y-4 mb-8">
              <div className="flex items-center space-x-2 text-xl">
                <MapPin className="w-6 h-6 text-vortex-red" />
                <span>4961 Tesla Dr, Ste E, Bowie, MD 20715</span>
              </div>
              <a 
                href="https://www.google.com/maps/place/Vortex+Athletics+and+Gymnastics/@38.9529792,-76.7165051,14z/data=!4m6!3m5!1s0x89b7ed0013e38567:0xd3ce87a1d2da30a5!8m2!3d38.9564345!4d-76.7076355!16s%2Fg%2F11mrrvn3bt?hl=en&entry=ttu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-vortex-red hover:text-red-400 font-semibold transition-colors text-lg underline"
              >
                View on Google Maps
              </a>
            </div>
            
            {onSignUpClick && (
              <motion.a
                href="https://app3.jackrabbitclass.com/regv2.asp?id=557920"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-vortex-red text-white px-12 py-6 rounded-lg font-bold text-xl transition-all duration-300 hover:bg-red-700 hover:scale-105"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Reserve Your Spot Today
              </motion.a>
            )}
          </motion.div>
        </div>
      </section>
    </>
  )
}

export default HomePage

