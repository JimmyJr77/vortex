import { motion } from 'framer-motion'
import {
  Activity,
  CheckCircle2,
  Dumbbell,
  Layers,
  Zap,
} from 'lucide-react'
import Programs from './Programs'

const classCategories = [
  {
    title: 'HIIT / Thrash Sessions',
    description: 'Full-body, high-intensity conditioning for work capacity and resilience.',
  },
  {
    title: 'Olympic Lifting Foundations',
    description: 'Teaching technique, power generation, and barbell literacy.',
  },
  {
    title: 'Jump & Plyometric Classes',
    description: 'Vertical, horizontal, and reactive force development.',
  },
  {
    title: 'Rotational & Core Power',
    description: 'Transfer strength for throwing, striking, cutting, and sprinting.',
  },
  {
    title: 'Strength Foundations',
    description: 'Squat, hinge, push, pull patterns—done right.',
  },
  {
    title: 'Tumbling Skills',
    description:
      'Focused skill drills for rolls, handsprings, flips, and tumbling progressions.',
    icon: Activity,
  },
  {
    title: 'Sprint Starts',
    description:
      'Explosive starts, acceleration mechanics, and first-step power development.',
    icon: Zap,
  },
]

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

      <section className="section-padding bg-gray-50 border-y border-gray-200">
        <div className="container-custom">
          <motion.div
            className="mx-auto max-w-4xl"
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl">
              Fit &amp; Flip in the <span className="text-vortex-red">Vortex Ecosystem</span>
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-gray-700">
              <p>
                Fit &amp; Flip supports the Vortex training ecosystem with focused classes for
                specialized athletic development. These sessions target specific qualities—strength,
                jumping ability, rotational power, back handsprings, flips, and more—through short,
                intentional training blocks.
              </p>
              <p>
                Designed to supplement gymnastics, ninja, and other sports, Fit &amp; Flip reinforces
                the physical foundations that help athletes progress skills safely, efficiently, and
                with greater confidence.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-white">
        <div className="container-custom">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="mb-3 font-bold uppercase tracking-[0.2em] text-vortex-red">How It Fits</p>
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl">
              Same DNA. <span className="text-vortex-red">Different Mission.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <motion.article
              className="rounded-3xl border border-gray-200 bg-gray-50 p-8 shadow-sm md:p-10"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
                <Layers className="h-7 w-7" aria-hidden />
              </div>
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-vortex-red">
                Athleticism Accelerator
              </p>
              <h3 className="text-3xl font-display font-bold text-black md:text-4xl">
                Relationship to the Accelerator
              </h3>
              <p className="mt-5 text-lg leading-relaxed text-gray-600">
                Fit &amp; Flip classes borrow principles from the Accelerator but are not designed to
                deliver full-spectrum athletic development on their own. The Athleticism Accelerator
                is the comprehensive, progressive system; Fit &amp; Flip is modular, focused, and
                selectable.
              </p>
              <div className="mt-6 flex items-start gap-3 rounded-2xl border-l-4 border-vortex-red bg-white p-5">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-vortex-red" aria-hidden />
                <p className="font-medium leading-relaxed text-gray-700">
                  Accelerator = full program. Fit &amp; Flip = targeted skill-specific training
                  blocks.
                </p>
              </div>
            </motion.article>

            <motion.article
              className="rounded-3xl border border-gray-200 bg-gray-50 p-8 shadow-sm md:p-10"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.6 }}
            >
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
                <Activity className="h-7 w-7" aria-hidden />
              </div>
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-vortex-red">
                Gymnastics &amp; Ninja
              </p>
              <h3 className="text-3xl font-display font-bold text-black md:text-4xl">
                Relationship to Gymnastics
              </h3>
              <p className="mt-5 text-lg leading-relaxed text-gray-600">
                Fit &amp; Flip works alongside gymnastics and ninja by zeroing in on specific
                skills—back handsprings, flips, strength for bars, tumbling blocks—in a small-group
                setting. A cost-effective, focused alternative to one-on-one privates.
              </p>
              <div className="mt-6 flex items-start gap-3 rounded-2xl border-l-4 border-vortex-red bg-white p-5">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-vortex-red" aria-hidden />
                <p className="font-medium leading-relaxed text-gray-700">
                  Group focus with private-level targeting—without the full price of individual
                  coaching.
                </p>
              </div>
            </motion.article>
          </div>
        </div>
      </section>

      <section className="section-padding bg-gray-50 border-y border-gray-200">
        <div className="container-custom">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="mb-3 font-bold uppercase tracking-[0.2em] text-vortex-red">
              Modular Classes
            </p>
            <h2 className="text-4xl font-display font-bold text-black md:text-5xl">
              Class Types &amp; <span className="text-vortex-red">Training Focus</span>
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              These are tools, not linear tracks. Pick what fits your athlete&apos;s goals.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classCategories.map((category, index) => {
              const Icon = ('icon' in category ? category.icon : Dumbbell) ?? Dumbbell
              return (
                <motion.article
                  key={category.title}
                  className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.55 }}
                  viewport={{ once: true }}
                >
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="text-2xl font-display font-bold text-black">{category.title}</h3>
                  <p className="mt-3 leading-relaxed text-gray-600">{category.description}</p>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      <Programs />
    </main>
  )
}
