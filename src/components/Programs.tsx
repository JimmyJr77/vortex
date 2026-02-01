import { motion } from 'framer-motion'
import { Clock, Users, Target, Dumbbell, DollarSign, BarChart3, Zap, CheckCircle, Activity, GraduationCap } from 'lucide-react'
import { Link } from 'react-router-dom'

const Programs = () => {
  const programs = [
    {
      title: "Competition Programs",
      description: "Formal competitive teams in multiple gymnastics disciplines including Tramp & Tumble, Acrobatics, Artistic, Rhythmic, and Aerobic Gymnastics.",
      features: ["Elite Performance", "Technical Precision", "Competitive Mindset"],
      icon: Target,
      color: "bg-vortex-red"
    },
    {
      title: "Developmental Programs",
      description: "Age-appropriate progressions for building foundational skills, coordination, and confidence. Structured development paths for young athletes.",
      features: ["Age-Appropriate", "Foundational Skills", "Structured Progressions"],
      icon: GraduationCap,
      color: "bg-teal-600"
    },
    {
      title: "Ninja Athlete",
      description: "Dynamic movement, legitimate physical training, and difficult obstacles. Build agility, strength, and confidence through challenging ninja-style courses and progressions.",
      features: ["Dynamic Movement", "Physical Training", "Difficult Obstacles"],
      icon: Activity,
      color: "bg-amber-600"
    },
    {
      title: "Athleticism Accelerator",
      description: "Classes focused on building foundational athleticism and body control through gymnastics, acrobatics, plyometrics, and speed & agility training.",
      features: ["8 Core Tenets", "Cross-Training", "Body Control"],
      icon: Zap,
      color: "bg-blue-600"
    },
    {
      title: "Strength & Fitness",
      description: "Learn basic form, focus on specific muscle groups, Olympic lifts, functional fitness, and calisthenics. Structured programming for lasting strength and conditioning.",
      features: ["Basic Form", "Olympic Lifts", "Functional Fitness", "Calisthenics"],
      icon: Dumbbell,
      color: "bg-slate-600"
    },
    {
      title: "Daytime Programs",
      description: "Specialized daytime classes for homeschooled children and students with flexible schedules, plus Mommy & Me and Adult Fitness programs.",
      features: ["Flexible Scheduling", "All Ages", "Family Bonding"],
      icon: Clock,
      color: "bg-green-600"
    },
    {
      title: "Private Coaching",
      description: "Personalized skill development and supplemental training with individualized coaching using our advanced technology tools.",
      features: ["One-on-One", "Custom Training", "Technology Integration"],
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
              <div className="flex items-start space-x-4 mb-6">
                <div className={`w-16 h-16 ${program.color} rounded-2xl flex items-center justify-center`}>
                  <program.icon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-black mb-2">{program.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{program.description}</p>
                </div>
              </div>
            )

            const Features = (
              <div className="flex flex-wrap gap-2">
                {program.features.map((feature) => (
                  <span
                    key={feature}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            )

            return (
              <motion.div
                key={program.title}
                className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                {program.title === "Athleticism Accelerator" ? (
                  <Link to="/athleticism-accelerator">
                    {Content}
                    {Features}
                  </Link>
                ) : program.title === "Competition Programs" ? (
                  <Link to="/trampoline-tumbling">
                    {Content}
                    {Features}
                  </Link>
                ) : program.title === "Ninja Athlete" ? (
                  <Link to="/ninja">
                    {Content}
                    {Features}
                  </Link>
                ) : (
                  <>
                    {Content}
                    {Features}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: DollarSign,
                title: "Discounted Rates for Young Children",
                description: "Special pricing available for early development athletes. Invest in foundational skills at accessible rates designed for growing families."
              },
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
                description: "Comprehensive athletic development across all 8 tenets. Not just gymnastics—complete movement intelligence that transfers to every sport and life."
              },
              {
                icon: Zap,
                title: "Success-Driven Focus",
                description: "Every session is designed for measurable progress. Our methodology prioritizes results through science-backed training and proven progression systems."
              },
              {
                icon: Dumbbell,
                title: "Small Group Excellence",
                description: "More individualized attention, personalized feedback, and coach-to-athlete time means faster progress and better results."
              }
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

          <div className="text-center mt-12">
            <div className="inline-flex items-center space-x-2 text-lg text-gray-300 mb-2">
              <CheckCircle className="w-5 h-5 text-vortex-red" />
              <span className="font-semibold text-vortex-red">Telemetry & Athlete Data:</span>
              <span>$250 one-time fee</span>
            </div>
            <p className="text-gray-400 text-sm">
              Lifetime access to advanced performance tracking, data analytics, and continuous development monitoring
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Programs
