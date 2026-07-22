import { motion } from 'framer-motion'

export default function CopyPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="section-padding !pt-[calc(var(--site-header-height)+4rem)] bg-white">
        <div className="container-custom">
          <motion.div
            className="rounded-3xl border-2 border-vortex-red bg-white p-8 md:p-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="mb-6 text-2xl font-display font-bold text-black">
              Integrated Across Every Program
            </h1>
            <p className="mb-6 text-lg leading-relaxed text-gray-700">
              Whether your athlete plays football, basketball, competes in track &amp; field, or
              trains in gymnastics, the Athleticism Accelerator principles will drive your child
              toward peak performance. We ensure a holistic approach to athletic development –
              building strength while training flexibility, developing speed while enhancing
              balance. No athlete leaves with weak links in their athletic chain.
            </p>
            <p className="mb-6 text-lg leading-relaxed text-gray-700">
              Through biomechanics sensors, movement AI, and personalized programming, we track and
              adapt training to maximize each athlete&apos;s potential across all eight tenets. This
              isn&apos;t just gymnastics training – it&apos;s comprehensive athletic development that
              will make your child a better athlete, regardless of their primary sport.
            </p>
            <p className="text-lg leading-relaxed text-gray-700">
              But if you want your athlete to most fully excel in a focused training regimen geared
              toward athletic development, the Athletic Accelerator program is your go to training
              regimen. This is not a series of random workouts strung together into a program. This
              is a calculated and targeted development plan to get the most out of your athlete.
            </p>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
