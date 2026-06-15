import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ENROLL_PATH } from '../../../config/enrollSites'
import { type DisciplineLandingConfig } from '../data/disciplineLandings'

interface DisciplineLandingPageProps {
  config: DisciplineLandingConfig
}

const DisciplineLandingPage = ({ config }: DisciplineLandingPageProps) => {
  const { theme } = config

  return (
    <div className="min-h-screen bg-white">
      <section
        className={`relative min-h-below-site-header w-full overflow-hidden bg-gradient-to-br ${theme.heroGradient} pt-below-site-header`}
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${config.heroImage})` }}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="container-custom relative z-10 flex min-h-below-site-header flex-col justify-center py-16 text-center">
          <motion.h1
            className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white mb-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {config.heroTitle}{' '}
            <span className={theme.heroHighlight}>{config.heroHighlight}</span>
          </motion.h1>
          <motion.p
            className="mx-auto max-w-3xl text-xl md:text-2xl text-gray-300 leading-relaxed mb-10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            {config.heroDescription}
          </motion.p>
          <motion.div
            className="flex flex-wrap justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Link
              to={ENROLL_PATH}
              className={`inline-flex items-center gap-2 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all ${theme.enrollButton}`}
            >
              Enroll Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 border-2 border-white text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-all"
            >
              All Disciplines
            </Link>
          </motion.div>
        </div>
      </section>

      {config.pathwayLinks && config.pathwayLinks.length > 0 && (
        <section className="section-padding bg-gray-50 border-b border-gray-200">
          <div className="container-custom max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">
              Find Your <span className={theme.whatIsAccent}>Age Pathway</span>
            </h2>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4">
              {config.pathwayLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-900 px-6 py-3 rounded-xl font-bold transition-all hover:border-gray-900 hover:bg-white"
                >
                  {link.label}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section-padding bg-white">
        <div className="container-custom max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-6">
            What is <span className={theme.whatIsAccent}>{config.whatIsTitle}</span>?
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed">{config.intro}</p>
        </div>
        <div className="container-custom grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {config.benefits.map((item, index) => {
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
                <div
                  className={`w-12 h-12 ${theme.iconBg} rounded-xl flex items-center justify-center mb-4`}
                >
                  <Icon className={`w-6 h-6 ${theme.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-black mb-2">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              </motion.div>
            )
          })}
        </div>
      </section>

      <section
        className={`section-padding bg-gradient-to-br ${theme.skillsGradient} text-white`}
      >
        <div className="container-custom max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-8">Skills We Build</h2>
          <ul className="space-y-3 text-left max-w-md mx-auto">
            {config.skillAreas.map((skill) => (
              <li key={skill} className="flex items-start gap-3">
                <CheckCircle className={`w-6 h-6 shrink-0 ${theme.skillsCheck}`} />
                <span className="text-lg">{skill}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-padding bg-gray-100 text-center">
        <div className="container-custom">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-black mb-6">
            {config.readyCta}
          </h2>
          <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">
            Enroll through Jackrabbit or contact us to find the right class level for your athlete.
          </p>
          <Link
            to={ENROLL_PATH}
            className="inline-flex items-center gap-2 bg-vortex-red text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition-all"
          >
            Enroll Now
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  )
}

export default DisciplineLandingPage
