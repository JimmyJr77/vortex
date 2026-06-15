import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Zap,
  Dumbbell,
  Move,
  ArrowUpDown,
  ShieldCheck,
  Activity,
  RotateCcw,
  Mountain,
  Timer,
  Gauge,
  TrendingUp,
  Target,
  CheckCircle2,
  Flame,
  Ruler,
  School,
} from 'lucide-react'

/** Primary conversion CTA — always points to the in-house signup flow. */
const SignUpCta = ({ className = '' }: { className?: string }) => (
  <Link
    to="/enroll"
    className={`inline-flex items-center justify-center gap-2 bg-vortex-red border-2 border-vortex-red text-white px-8 py-4 rounded-lg font-bold text-lg transition-all duration-300 hover:bg-red-700 hover:border-red-700 hover:scale-105 ${className}`}
  >
    Enroll Now!
  </Link>
)

const OfferBadge = ({ dark = false }: { dark?: boolean }) => (
  <div
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm md:text-base font-semibold ${
      dark
        ? 'bg-vortex-red/15 border border-vortex-red text-white'
        : 'bg-red-50 border border-vortex-red text-vortex-red'
    }`}
  >
    <School className="w-4 h-4 text-vortex-red flex-shrink-0" />
    Free training sessions are available for students from select middle and high schools.
  </div>
)

const SummerAthleticTraining = () => {
  const trainingCards = [
    {
      icon: Zap,
      title: 'Speed & Acceleration',
      copy: 'Sprint starts, acceleration mechanics, and top-end speed work that shows up on the field, court, and track.',
    },
    {
      icon: Dumbbell,
      title: 'Strength & Power',
      copy: 'Lifting technique and strength fundamentals that build real, usable power for young athletes.',
    },
    {
      icon: Move,
      title: 'Agility & Change of Direction',
      copy: 'Cut harder, react faster, and stay in control through every change of direction.',
    },
    {
      icon: ArrowUpDown,
      title: 'Jumping & Landing Mechanics',
      copy: 'Jump higher and land safer with mechanics that protect knees and ankles.',
    },
    {
      icon: ShieldCheck,
      title: 'Mobility & Injury Resilience',
      copy: 'Mobility and flexibility routines that keep athletes durable through a full season.',
    },
    {
      icon: Flame,
      title: 'Conditioning & HIIT',
      copy: 'High-intensity interval training and conditioning circuits built for game-speed endurance.',
    },
    {
      icon: RotateCcw,
      title: 'Tumbling & Body Control',
      copy: 'Tumbling basics, coordination, and core strength that teach athletes to own their movement.',
    },
    {
      icon: Mountain,
      title: 'Obstacle Negotiation',
      copy: 'Climb, vault, and move through obstacles to build confidence and total-body athleticism.',
    },
  ]

  const skills = [
    'Sprint starts',
    'Acceleration mechanics',
    'Speed drills',
    'Agility drills',
    'Change-of-direction skills',
    'Jump mechanics',
    'Landing mechanics',
    'Lifting technique',
    'Strength fundamentals',
    'Mobility routines',
    'Conditioning circuits',
    'Obstacle negotiation',
    'Tumbling basics',
    'Body control & coordination',
    'Competitive mindset',
  ]

  const metrics = [
    { icon: Timer, label: 'Speed', detail: 'Sprint times' },
    { icon: ArrowUpDown, label: 'Jump Power', detail: 'Jump height and distance' },
    { icon: Move, label: 'Agility', detail: 'Change-of-direction performance' },
    { icon: Activity, label: 'Conditioning', detail: 'Work capacity improvements' },
    { icon: Gauge, label: 'Strength & Movement', detail: 'Strength and movement quality' },
  ]

  const whoShouldJoin = [
    'Middle school athletes preparing for high school sports',
    'High school athletes preparing for next season',
    'Athletes who want to get faster, stronger, and more explosive',
    'Athletes who need better conditioning',
    'Athletes improving confidence, coordination, mobility, and body control',
    'Multi-sport athletes',
    'Beginners who want a stronger athletic foundation',
    'Competitive athletes who want an edge',
  ]

  const sports =
    'Football, basketball, soccer, lacrosse, baseball, softball, track, wrestling, cheer, gymnastics, volleyball — and every athlete in between.'

  return (
    <div className="min-h-screen bg-white">
      {/* Single keyword-focused H1 for SEO; visible hero headline is styled below. */}
      <h1 className="sr-only">
        Middle and High School Summer Athletic Training Program in Bowie, MD
      </h1>

      {/* 1. Hero */}
      <section className="relative w-full overflow-hidden bg-gradient-to-br from-black via-gray-900 to-black pt-below-site-header">
        {/* Red glow accents */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-vortex-red/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -right-24 w-96 h-96 bg-vortex-red/10 rounded-full blur-3xl pointer-events-none" />

        <motion.img
          src="/summer-training-sticky-note.png"
          alt="Free training sessions for select schools"
          className="pointer-events-none absolute z-[5] hidden md:block w-32 lg:w-40 xl:w-48 drop-shadow-2xl top-28 lg:top-1/2 lg:-translate-y-1/2 right-4 lg:right-8 xl:right-16 max-w-[min(28vw,12rem)]"
          initial={{ opacity: 0, scale: 0.9, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: -6 }}
          transition={{ delay: 0.35, duration: 0.7, ease: 'easeOut' }}
        />

        <div className="container-custom relative z-10 py-20 md:py-28 text-center">
          <div className="flex flex-col items-center gap-6 mb-8 max-w-3xl mx-auto">
            <motion.p
              className="text-vortex-red font-display font-bold tracking-[0.25em] uppercase text-sm md:text-base"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              For Middle & High School Athletes
            </motion.p>

            <motion.div
              className="text-5xl sm:text-6xl md:text-8xl font-display font-bold text-white leading-none"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              SUMMER <span className="text-vortex-red">ATHLETIC TRAINING</span>
            </motion.div>

            <motion.p
              className="text-lg md:text-xl text-gray-300"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              A summer training program for middle and high school athletes focused on conditioning
              and complete athletic development. Outwork the competition.
            </motion.p>
          </div>

          <motion.div
            className="mb-10"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <OfferBadge dark />
          </motion.div>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <SignUpCta className="w-full sm:w-auto" />
            <a
              href="#program-details"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/40 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:border-vortex-red hover:text-vortex-red w-full sm:w-auto"
            >
              View Program Details
            </a>
          </motion.div>
        </div>
      </section>

      {/* 2. Why This Program Exists */}
      <section id="program-details" className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto text-center"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
              NEXT SEASON STARTS <span className="text-vortex-red">NOW</span>
            </h2>
            <p className="text-xl text-gray-700 leading-relaxed mb-4">
              Next season does not start at tryouts. It starts in the summer. Athleticism
              Accelerator is a summer athletic development program that helps middle and high
              school athletes build the speed, strength, conditioning, mobility, and confidence
              they need before they step back onto the field, court, mat, or track.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed">
              Train like an athlete before the next season starts. Be ready for next year.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 3. What Athletes Train */}
      <section className="section-padding bg-gray-100">
        <div className="container-custom">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              WHAT ATHLETES <span className="text-vortex-red">TRAIN</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Youth speed and agility training, strength and conditioning for teens, and complete
              athlete performance development — all in one summer program.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trainingCards.map((card, index) => (
              <motion.div
                key={card.title}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border-t-4 border-vortex-red"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.5 }}
                viewport={{ once: true }}
              >
                <div className="w-12 h-12 bg-vortex-red rounded-xl flex items-center justify-center mb-4">
                  <card.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-display font-bold text-black mb-2">{card.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{card.copy}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Athletic Foundation */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="bg-black rounded-3xl p-10 md:p-16 text-white relative overflow-hidden"
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-vortex-red/20 rounded-full blur-3xl pointer-events-none" />
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6 relative z-10">
              BUILT ON A COMPLETE <span className="text-vortex-red">ATHLETIC FOUNDATION</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-300 leading-relaxed mb-6 max-w-4xl relative z-10">
              Athletes train across isometrics, plyometrics, HIIT, strength training, mobility,
              flexibility, and overall conditioning to develop complete athleticism — not just one
              skill in isolation.
            </p>
            <p className="text-xl md:text-2xl font-bold text-white relative z-10">
              The goal is not just to work hard. The goal is to{' '}
              <span className="text-vortex-red">
                move better, get stronger, become faster, and compete with more confidence.
              </span>
            </p>
          </motion.div>
        </div>
      </section>

      {/* 5. Skills Athletes Will Learn */}
      <section className="section-padding bg-white pt-0">
        <div className="container-custom">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              SKILLS ATHLETES WILL <span className="text-vortex-red">LEARN</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Every session develops real, coachable skills that transfer to every sport.
            </p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
            {skills.map((skill, index) => (
              <motion.span
                key={skill}
                className="inline-flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-full px-5 py-2.5 text-gray-800 font-semibold text-sm md:text-base"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.04, duration: 0.4 }}
                viewport={{ once: true }}
              >
                <CheckCircle2 className="w-4 h-4 text-vortex-red flex-shrink-0" />
                {skill}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Performance Testing */}
      <section className="section-padding bg-gray-900 text-white relative overflow-hidden">
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-vortex-red/10 rounded-full blur-3xl pointer-events-none" />
        <div className="container-custom relative z-10">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 bg-vortex-red/15 border border-vortex-red rounded-full px-4 py-1.5 text-sm font-semibold text-white mb-6">
              <Ruler className="w-4 h-4 text-vortex-red" />
              Performance Tracking
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
              OFFICIAL SPEED AND <span className="text-vortex-red">JUMP MEASUREMENTS</span>
            </h2>
            <p className="text-2xl md:text-3xl font-display font-bold text-vortex-red mb-6">
              Don't just train. Measure it.
            </p>
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">
              Athletes receive official jump and speed measurements so they can track progress
              throughout the summer. We test, train, and retest so athletes can see measurable
              improvement.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                className="bg-white/5 border border-white/10 rounded-xl p-5 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
              >
                <metric.icon className="w-8 h-8 text-vortex-red mx-auto mb-3" />
                <div className="font-display font-bold text-lg">{metric.label}</div>
                <div className="text-gray-400 text-sm mt-1">{metric.detail}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Free Sessions for Select Schools */}
      <section className="section-padding bg-vortex-red relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-black/20 rounded-full blur-3xl pointer-events-none" />
        <div className="container-custom relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-6xl font-display font-bold text-white mb-6">
              FREE SUMMER TRAINING SESSIONS FOR SELECT SCHOOLS
            </h2>
            <p className="text-lg md:text-xl text-red-50 max-w-3xl mx-auto leading-relaxed mb-10">
              Vortex Athletics is offering free Athleticism Accelerator sessions for students from
              select middle and high schools. This gives athletes a chance to experience structured
              performance training, build confidence, and prepare for next season.
            </p>
            <Link
              to="/enroll"
              className="inline-flex items-center justify-center gap-2 bg-white text-vortex-red px-10 py-5 rounded-lg font-bold text-xl transition-all duration-300 hover:bg-gray-100 hover:scale-105"
            >
              Enroll Now!
            </Link>
            <p className="text-red-100 text-sm mt-6">
              Spots may be limited. Availability may depend on school, schedule, and program
              capacity.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 8. Who Should Join */}
      <section className="section-padding bg-white">
        <div className="container-custom">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              WHO SHOULD <span className="text-vortex-red">JOIN</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">{sports}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {whoShouldJoin.map((item, index) => (
              <motion.div
                key={item}
                className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl p-5"
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06, duration: 0.5 }}
                viewport={{ once: true }}
              >
                <Target className="w-6 h-6 text-vortex-red flex-shrink-0 mt-0.5" />
                <span className="text-gray-800 font-semibold">{item}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Fit and Flip / Movement Tie-In */}
      <section className="section-padding bg-gray-100">
        <div className="container-custom">
          <motion.div
            className="max-w-4xl mx-auto bg-white border-2 border-vortex-red rounded-3xl p-8 md:p-12"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-8 h-8 text-vortex-red" />
              <h2 className="text-2xl md:text-3xl font-display font-bold text-black">
                MORE THAN LIFTING AND <span className="text-vortex-red">RUNNING</span>
              </h2>
            </div>
            <p className="text-lg text-gray-700 leading-relaxed">
              Athleticism Accelerator combines performance training with movement skills inspired
              by Vortex's Fit and Flip approach. Athletes do not just lift and run. They learn how
              to control their bodies, absorb force, jump, land, climb, rotate, balance, and move
              with confidence.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 10. Final CTA */}
      <section className="section-padding bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-vortex-red/20 rounded-full blur-3xl pointer-events-none" />
        <div className="container-custom relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-6xl font-display font-bold mb-6">
              BE READY FOR <span className="text-vortex-red">NEXT SEASON</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
              Summer training is the difference between showing up and standing out. Build the
              athletic foundation now.
            </p>
            <SignUpCta className="px-12 py-5 text-xl" />
            <p className="text-gray-400 mt-6">
              Free classes are available for students from select schools.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default SummerAthleticTraining
