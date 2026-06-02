import { motion } from 'framer-motion'
import { ArrowRight, Users, Shield, Heart, Target, Zap, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

const JACKRABBIT_URL = 'https://app3.jackrabbitclass.com/regv2.asp?id=557920'

interface AcroGymnasticsPageProps {
  onSignUpClick?: () => void
}

const benefits = [
  {
    icon: Users,
    title: 'Trust & Teamwork',
    description:
      'Partner and group skills teach communication, timing, and shared responsibility — on and off the floor.',
  },
  {
    icon: Shield,
    title: 'Safe Progressions',
    description:
      'Structured progressions build strength and flexibility before advanced lifts, balances, and dynamic elements.',
  },
  {
    icon: Target,
    title: 'Body Control',
    description:
      'Develops precision in handstands, balances, and landings that transfer to artistic, cheer, and tumbling.',
  },
  {
    icon: Zap,
    title: 'Athleticism Accelerator',
    description:
      'Integrated strength, flexibility, and coordination work through Vortex’s eight tenets of athleticism.',
  },
  {
    icon: Heart,
    title: 'Confidence & Expression',
    description:
      'Athletes learn to perform with poise under pressure — supporting partners and showcasing artistry together.',
  },
]

const skillAreas = [
  'Partner balances & lifts',
  'Handstand and line work',
  'Dynamic tumbling connections',
  'Group pyramids & formations',
  'Flexibility & strength for bases and tops',
]

const AcroGymnasticsPage = ({ onSignUpClick: _onSignUpClick }: AcroGymnasticsPageProps) => {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative min-h-below-site-header w-full overflow-hidden bg-gradient-to-br from-cyan-950 via-gray-900 to-black pt-below-site-header">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: 'url(/tumbling.jpeg)' }}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="container-custom relative z-10 flex min-h-below-site-header flex-col justify-center py-16 text-center">
          <motion.h1
            className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white mb-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Balance. Trust.{' '}
            <span className="text-cyan-400">Lift Together.</span>
          </motion.h1>
          <motion.p
            className="mx-auto max-w-3xl text-xl md:text-2xl text-gray-300 leading-relaxed mb-10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            Acrobatic Gymnastics (Acro) at Vortex Gymnastics in Bowie, MD combines partner balances,
            dynamic skills, and group choreography — building strength, flexibility, and teamwork
            through the Athleticism Accelerator™.
          </motion.p>
          <motion.div
            className="flex flex-wrap justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <a
              href={JACKRABBIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-cyan-500 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-cyan-400 transition-all"
            >
              Enroll Now
              <ArrowRight className="w-5 h-5" />
            </a>
            <Link
              to="/"
              className="inline-flex items-center gap-2 border-2 border-white text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-all"
            >
              All Disciplines
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-custom max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
            What is <span className="text-cyan-600">Acro</span>?
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed">
            Acrobatic gymnastics is a discipline where athletes work in pairs or groups to perform
            balances, lifts, and dynamic elements set to music. It demands extraordinary trust,
            timing, and body control — the same foundations that power success in every sport.
          </p>
        </div>
        <div className="container-custom grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((item, index) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.title}
                className="bg-gray-50 rounded-2xl p-6 border border-gray-200"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-cyan-700" />
                </div>
                <h3 className="text-xl font-bold text-black mb-2">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              </motion.div>
            )
          })}
        </div>
      </section>

      <section className="section-padding bg-gradient-to-br from-cyan-600 to-teal-800 text-white">
        <div className="container-custom max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-8">Skills We Build</h2>
          <ul className="space-y-3 text-left max-w-md mx-auto">
            {skillAreas.map((skill) => (
              <li key={skill} className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 shrink-0 text-cyan-200" />
                <span className="text-lg">{skill}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-padding bg-gray-100 text-center">
        <div className="container-custom">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-black mb-6">
            Ready to start Acro?
          </h2>
          <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">
            Enroll through Jackrabbit or contact us to find the right class level for your athlete.
          </p>
          <a
            href={JACKRABBIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-vortex-red text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition-all"
          >
            Enroll Now
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>
    </div>
  )
}

export default AcroGymnasticsPage
