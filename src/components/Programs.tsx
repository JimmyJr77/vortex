import { motion } from 'framer-motion'
import { Clock, Users, Target, Dumbbell, DollarSign, BarChart3, Zap, CheckCircle, Footprints } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getGymnasticsSiteUrl } from '../utils/gymnasticsSite'
import { NINJA_HOLD_TITLE, NINJA_PROGRAM_ON_HOLD } from '../utils/ninjaProgram'

const Programs = () => {
  const programs = [
    {
      title: "Competitive Gymnastics",
      description: "Formal competitive teams in multiple gymnastics disciplines including Acro, Artistic, Rhythmic, Tramp & Tumble, and Aerobic Gymnastics.",
      icon: Target,
      color: "bg-vortex-red"
    },
    {
      title: "Developmental Gymnastics",
      description: "Age-appropriate progressions for building foundational skills, coordination, and confidence. Structured development paths for young athletes.",
      icon: Target,
      color: "bg-amber-500"
    },
    {
      title: "Ninja Athlete",
      description: "Dynamic movement, legitimate physical training, and difficult obstacles. Build agility, strength, and confidence through challenging ninja-style courses and progressions.",
      icon: Footprints,
      color: "bg-amber-600"
    },
    {
      title: "Athleticism Accelerator",
      description: "Classes focused on building foundational athleticism and body control through gymnastics, acrobatics, plyometrics, and speed & agility training.",
      icon: Zap,
      color: "bg-blue-600"
    },
    {
      title: "Strength & Conditioning",
      description: "From drop in functional fitness thrashings to full instruction foundational weight lifting. We structure a variety of classes to help develop lasting strength and conditioning.",
      icon: Dumbbell,
      color: "bg-slate-600"
    },
    {
      title: "Daytime Programs",
      description: "Specialized daytime classes for homeschooled children and students with flexible schedules, plus Mommy & Me and Adult Fitness programs.",
      icon: Clock,
      color: "bg-green-600"
    },
    {
      title: "Private Coaching",
      description: "Personalized skill development and supplemental training with individualized coaching using our advanced technology tools.",
      icon: Users,
      color: "bg-purple-600"
    }
  ]


  return (
    <section id="programs" className="section-padding bg-gray-200 border-t border-b border-gray-300">
      <div className="container-custom">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-5xl md:text-6xl font-display font-bold text-black mb-6">
            OUR
            <span className="text-vortex-red"> PROGRAMS</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            Comprehensive training programs designed to transform athletes through our unique 
            gymnastics-first approach, blending traditional techniques with cutting-edge technology.
          </p>
        </motion.div>

        {/* Programs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {programs.map((program, index) => {
            const Content = (
              <div className="flex items-start space-x-4">
                <div className={`w-16 h-16 ${program.color} rounded-2xl flex items-center justify-center`}>
                  <program.icon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-black mb-2">{program.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{program.description}</p>
                </div>
              </div>
            )

            const isNinjaOnHold =
              program.title === 'Ninja Athlete' && NINJA_PROGRAM_ON_HOLD

            return (
              <motion.div
                key={program.title}
                className={`bg-white rounded-3xl p-8 shadow-lg transition-shadow duration-300 ${
                  isNinjaOnHold
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:shadow-xl cursor-pointer'
                }`}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={isNinjaOnHold ? undefined : { scale: 1.02 }}
                title={isNinjaOnHold ? NINJA_HOLD_TITLE : undefined}
                aria-disabled={isNinjaOnHold || undefined}
              >
                {program.title === "Athleticism Accelerator" ? (
                  <Link to="/vortex-athletics">
                    {Content}
                  </Link>
                ) : program.title === "Competitive Gymnastics" ? (
                  <a
                    href={getGymnasticsSiteUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {Content}
                  </a>
                ) : program.title === "Developmental Gymnastics" ? (
                  <a
                    href={getGymnasticsSiteUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {Content}
                  </a>
                ) : program.title === "Strength & Conditioning" ? (
                  <Link to="/strength-conditioning">
                    {Content}
                  </Link>
                ) : program.title === "Ninja Athlete" && !NINJA_PROGRAM_ON_HOLD ? (
                  <Link to="/ninja">
                    {Content}
                  </Link>
                ) : (
                  <>
                    {Content}
                  </>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Value Section */}
        <motion.div
          className="bg-black rounded-3xl p-12"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="text-center mb-12">
            <h3 className="text-4xl font-display font-bold text-white mb-4">
              VALUE
            </h3>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Premium training, measurable results, and unmatched athletic development.
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
            {[
              {
                icon: BarChart3,
                title: "Telemetry Data & Performance Tracking",
                description: "Advanced data collection refines training and monitors development in real-time. Track progress, identify strengths, and optimize weaknesses with precision analytics."
              },
              {
                icon: Clock,
                title: "Longer Class Times",
                description: "Extended sessions mean more time on equipment, deeper skill development, and comprehensive training without rushing. Quality over quantity, but we deliver both."
              },
              {
                icon: Target,
                title: "Wider Range of Skills Development",
                description: "Comprehensive athletic development—complete movement intelligence that transfers to every sport."
              },
              {
                icon: Zap,
                title: "Success-Driven Focus",
                description: "Every session is designed for measurable progress. Our methodology prioritizes results through science-backed training and proven progression systems."
              },
            ].map((value, index) => (
              <motion.div
                key={value.title}
                className="bg-white/10 rounded-2xl p-6"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-vortex-red/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <value.icon className="w-6 h-6 text-vortex-red" />
                  </div>
                  <h4 className="text-lg font-bold text-white">{value.title}</h4>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed text-center">{value.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-4xl text-center">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-lg">
              <CheckCircle className="h-5 w-5 text-vortex-red" />
              <span className="font-semibold text-vortex-red">Telemetry & Athlete Data:</span>
              <span className="font-semibold text-white">$85 annually</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Annual access to advanced performance tracking, data analytics, and continuous development monitoring. Access to the Vortex workout modal. Free Vortex T-shirt.
            </p>

            <div className="mt-8 border-t border-white/15 pt-8">
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-lg font-semibold">
                <DollarSign className="h-5 w-5 shrink-0 text-vortex-red" />
                <span className="text-vortex-red">Stack Classes &amp; Cash:</span>
                <span className="text-white">Up to 40% off with multiple class sign-ups.</span>
              </div>
              <p className="mt-2 text-sm text-gray-400">
                Discounts may apply to individuals or families as they register for additional classes.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Programs
