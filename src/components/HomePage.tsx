import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { MapPin, Target, Brain } from 'lucide-react'
import Hero from './Hero'
import ParallaxGym from './ParallaxGym'
import About from './About'
import Programs from './Programs'
import Technology from './Technology'

interface HomePageProps {
  onSignUpClick?: () => void
}

const HomePage = ({ onSignUpClick }: HomePageProps) => {
  const tenets = [
    { name: 'Strength', description: 'Ability to exert force against resistance.' },
    { name: 'Explosiveness', description: 'Exert maximal force in minimal time.' },
    { name: 'Speed', description: 'Rapid execution of movement and reaction.' },
    { name: 'Agility', description: 'Rapid direction changes with control.' },
    { name: 'Flexibility', description: 'Range of motion and muscular elasticity.' },
    { name: 'Balance', description: 'Maintain stability in static or dynamic movement.' },
    { name: 'Coordination', description: 'Integrate multiple body parts for fluid motion.' },
    { name: 'Kinematic Awareness', description: 'Precise understanding of where the body is in space.' },
  ]

  const physiologicalEmphasis = [
    { category: 'Neural Activation', system: 'CNS, Reflex Arc', outcome: 'Faster motor unit recruitment, improved reaction' },
    { category: 'Muscular Load', system: 'Muscle, Joint', outcome: 'Strength, hypertrophy, and stability gains' },
    { category: 'Elastic Energy', system: 'Tendons, Fascia', outcome: 'Spring-like power and resilience' },
    { category: 'Control & Stability', system: 'Core, Proprioceptors', outcome: 'Enhanced balance, posture, precision' },
    { category: 'Movement Intelligence', system: 'Brain-Body Integration', outcome: 'Improved patterning, timing, and adaptation' },
  ]

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
      answer: 'We offer competitive teams in Trampoline & Tumbling, Artistic Gymnastics, and Rhythmic Gymnastics, plus our Athleticism Accelerator program for cross-sport development, recreational classes, and private coaching.'
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

  // Instagram: load embed.js once and process blockquotes when Instagram is selected (direct embed, no sandbox iframe)
  useEffect(() => {
    if (selectedVideo.id !== 'instagram' || !('reelUrl' in selectedVideo) || !selectedVideo.reelUrl) return
    const run = () => {
      if (typeof window !== 'undefined' && (window as any).instgrm?.Embeds?.process) {
        (window as any).instgrm.Embeds.process()
      }
    }
    const existing = document.querySelector('script[src="https://www.instagram.com/embed.js"]')
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://www.instagram.com/embed.js'
      script.async = true
      document.body.appendChild(script)
      script.onload = run
    } else {
      run()
    }
  }, [selectedVideo])

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

          {/* Supplement Section */}
          <motion.div
            className="bg-white rounded-2xl p-8 md:p-12 mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed max-w-4xl mx-auto text-center">
              Supplement football, basketball, soccer, wrestling, lacrosse and more through our Athleticism Accelerator programs. Supplement dance, cheer, acro, and gymnastics with focused tumbling and floor lessons from our international gymnast instructors and founders of A4 Gymnastics. Learn backflips, aerials, layouts, cartwheels, fulls, and more. Master the strength, technique, and body control needed to advance in your sport.
            </p>
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
      <Technology />

      {/* 8 Tenets Section */}
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
              ATHLETICISM ACCELERATOR <span className="text-vortex-red">PROGRAM</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6">
              Our Athleticism Accelerator focus means all training incorporates these core principles
            </p>
          </motion.div>

          {/* Tenets Table */}
          <motion.div
            className="overflow-x-auto mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl md:text-3xl font-display font-bold text-vortex-red mb-4 text-center">
              8 Tenets of Athleticism
            </h3>
            <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-lg">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-6 py-4 text-left font-bold text-lg">Tenet</th>
                  <th className="px-6 py-4 text-left font-bold text-lg">Description</th>
                </tr>
              </thead>
              <tbody>
                {tenets.map((tenet, index) => (
                  <tr
                    key={tenet.name}
                    className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-vortex-red/5 transition-colors`}
                  >
                    <td className="px-6 py-4 font-semibold text-vortex-red">{tenet.name}</td>
                    <td className="px-6 py-4 text-gray-700">{tenet.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                className="inline-block btn-primary"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Start Your Journey
              </motion.a>
            </motion.div>
          )}
        </div>
      </section>

      {/* Physiological Emphasis Table */}
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
              PHYSIOLOGICAL <span className="text-vortex-red">EMPHASIS</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-2">
              Designed for: <span className="font-bold">Vortex Athletics | Athleticism Accelerator™</span>
            </p>
            <p className="text-lg text-gray-600">
              Purpose: Develop adaptable, resilient, and high-performance athletes through structured physical intelligence.
            </p>
          </motion.div>

          <motion.div
            className="overflow-x-auto mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-lg">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-6 py-4 text-left font-bold text-lg">Category</th>
                  <th className="px-6 py-4 text-left font-bold text-lg">System Targeted</th>
                  <th className="px-6 py-4 text-left font-bold text-lg">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {physiologicalEmphasis.map((item, index) => (
                  <tr
                    key={item.category}
                    className={`border-b border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-vortex-red/5 transition-colors`}
                  >
                    <td className="px-6 py-4 font-semibold text-vortex-red">{item.category}</td>
                    <td className="px-6 py-4 text-gray-700">{item.system}</td>
                    <td className="px-6 py-4 text-gray-700">{item.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                className="inline-block btn-primary"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Experience the Science
              </motion.a>
            </motion.div>
          )}
        </div>
      </section>

      {/* Technology & Mindset Section */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          {/* Fail Your Way to Success mindset card */}
          <div className="max-w-2xl mx-auto mb-12">
            <motion.div
              className="bg-gray-200 rounded-2xl p-8 border-2 border-vortex-red/20"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <Brain className="w-8 h-8 text-vortex-red" />
                <h3 className="text-3xl font-display font-bold text-black">
                  "Fail Your Way to Success"
                </h3>
              </div>
              <p className="text-gray-700 mb-6 text-lg leading-relaxed">
                We teach children to find fun in overcoming adversity and achieving success through 
                a competitive edge. Our athletes are simultaneously pushed and cared for.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                This mindset cultivates resilience that fuels excellence in every aspect of life.
              </p>
            </motion.div>
          </div>
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

