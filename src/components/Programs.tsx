import { motion } from 'framer-motion'
import { Clock, Users, Target, Dumbbell } from 'lucide-react'
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
      title: "Athleticism Accelerator",
      description: "Recreational classes focused on building foundational athleticism and body control through gymnastics, acrobatics, plyometrics, and speed & agility training.",
      features: ["8 Core Tenets", "Cross-Training", "Body Control"],
      icon: Dumbbell,
      color: "bg-blue-600"
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

  const pricing = [
    { classes: "1 Class/Week", price: "$150/mo", value: "50% longer sessions" },
    { classes: "2 Classes/Week", price: "$250/mo", value: "$50 discount" },
    { classes: "3 Classes/Week", price: "$325/mo", value: "$125 discount (Limited spaces)" },
    { classes: "5 Classes/Week", price: "$500/mo", value: "$250 discount (Limited spaces)" }
  ]

  return (
    <section id="programs" className="section-padding bg-gray-50">
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

        {/* Pricing Section */}
        <motion.div
          className="bg-black rounded-3xl p-12"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="text-center mb-12">
            <h3 className="text-4xl font-display font-bold text-white mb-4">
              TIERED PRICING
            </h3>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Our pricing reflects the premium value of extended class durations, 
              integrated fitness regimens, and cutting-edge technology. More Savings = More Success.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricing.map((tier, index) => (
              <motion.div
                key={tier.classes}
                className="bg-white/10 rounded-2xl p-6 text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                <div className="text-3xl font-bold text-vortex-red mb-2">{tier.price}</div>
                <div className="text-white font-semibold mb-2">{tier.classes}</div>
                <div className="text-gray-300 text-sm">{tier.value}</div>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <div className="text-lg text-gray-300 mb-2">
              <span className="font-semibold text-vortex-red">Telemetry & Athlete Data:</span> $250 one-time fee
            </div>
            <p className="text-gray-400 text-sm">
              Lifetime access to advanced performance tracking and data analytics
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Programs
