import { motion } from 'framer-motion'
import { Cpu, Target, Trophy } from 'lucide-react'

const D1Icon = ({ className }: { className?: string }) => (
  <span
    className={className}
    style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '2rem',
      fontWeight: 'bold',
      letterSpacing: '0.05em',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    }}
  >
    D1
  </span>
)

const features = [
  {
    icon: D1Icon,
    title: 'Elite Development',
    description:
      'Developing the 8 core tenets of athleticism: Flexibility, Balance, Coordination, Strength, Explosiveness, Speed, Agility, and Body Control.',
  },
  {
    icon: Cpu,
    title: 'Technology-Driven',
    description:
      'Film review, science backed development, and telemetry data create detailed athlete profiles for measurable growth.',
  },
  {
    icon: Target,
    title: 'Kinematic Awareness',
    description:
      'Precise understanding of where the body is in space - the key to athleticism that separates champions from competitors.',
  },
  {
    icon: Trophy,
    title: 'Fail Your Way to Success',
    description:
      'We teach children to find fun in overcoming adversity and achieving success through a competitive edge mindset.',
  },
]

export default function VortexDifference() {
  return (
    <div>
      <motion.div
        className="mb-16 text-center"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
      >
        <h2 className="mb-6 text-4xl font-display font-bold text-black md:text-5xl">
          THE VORTEX
          <span className="text-vortex-red"> DIFFERENCE</span>
        </h2>
        <p className="mx-auto max-w-4xl text-xl leading-relaxed text-gray-600">
          We&apos;re not just another athletics or gymnastics facility. We&apos;re a cutting-edge
          athletic development center that places gymnastics at the heart of comprehensive athletic
          training, merging body control and advanced technology with rigorous, science-backed
          training.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            className="h-full min-h-[19rem] rounded-2xl bg-gray-200 p-6 text-center transition-colors duration-300 hover:bg-gray-300"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.6 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.05 }}
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-vortex-red">
              <feature.icon className="h-8 w-8 text-white" />
            </div>
            <h3 className="mb-3 text-xl font-bold text-black">{feature.title}</h3>
            <p className="leading-relaxed text-gray-600">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
