import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ENROLL_PATH } from '../config/enrollSites'
import { getGymnasticsSiteUrl } from '../utils/gymnasticsSite'
import HeroPosterBackground from './HeroPosterBackground'

type SportTile =
  | {
      title: string
      teaser: string
      image: string
      kind: 'internal'
      to: string
    }
  | {
      title: string
      teaser: string
      image: string
      kind: 'external'
      href: string
    }

const SPORT_TILES: SportTile[] = [
  {
    title: 'Athleticism Training',
    teaser: 'Speed, power, and body control that transfer to every sport.',
    image: '/multisport.jpeg',
    kind: 'internal',
    to: '/athleticism-accelerator',
  },
  {
    title: 'Fit & Flip',
    teaser: 'Strength, conditioning, and acrobatics for the complete athlete.',
    image: '/strength.jpeg',
    kind: 'internal',
    to: '/strength-conditioning',
  },
  {
    title: 'Gymnastics',
    teaser: 'Grace, strength, and precision across every discipline.',
    image: '/gymnastics.jpeg',
    kind: 'external',
    href: getGymnasticsSiteUrl(),
  },
]

const tileClassName =
  'group relative block h-72 md:h-96 overflow-hidden rounded-3xl shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-vortex-red focus-visible:ring-offset-2'

const Sports = () => {
  return (
    <div className="min-h-screen bg-white">
      <h1 className="sr-only">Youth Sports Training in Bowie, MD</h1>

      {/* Desktop hero */}
      <section className="hidden md:block relative min-h-below-site-header w-full overflow-hidden pt-below-site-header">
        <HeroPosterBackground overlayClassName="absolute inset-0 bg-black/45 z-[1] pointer-events-none" />
        <div className="container-custom relative z-10 flex justify-center items-center min-h-below-site-header text-center">
          <div>
            <motion.div
              className="text-5xl md:text-7xl font-display font-bold text-white mb-6"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              Train <span className="text-vortex-red">Every</span> Sport.
            </motion.div>
            <motion.p
              className="text-2xl md:text-3xl text-gray-300 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              Pick your path. We&apos;ll build the athlete.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Mobile hero */}
      <section className="md:hidden relative h-[55vh] w-full overflow-hidden pt-below-site-header">
        <HeroPosterBackground overlayClassName="absolute inset-0 bg-black/50 z-[1] pointer-events-none" />
        <div className="container-custom relative z-10 flex h-full items-center justify-center text-center px-4">
          <div>
            <motion.div
              className="text-4xl sm:text-5xl font-display font-bold text-white mb-4"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              Train <span className="text-vortex-red">Every</span> Sport.
            </motion.div>
            <motion.p
              className="text-lg text-gray-300"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.7 }}
            >
              Pick your path. We&apos;ll build the athlete.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Sport route tiles */}
      <section className="section-padding bg-gray-200 border-t border-b border-gray-300">
        <div className="container-custom">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-black mb-4">
              OUR <span className="text-vortex-red">SPORTS</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
              Three paths. One standard of development. Choose where you start.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {SPORT_TILES.map((tile, index) => {
              const content = (
                <>
                  <img
                    src={tile.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 z-[1]" />
                  <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 md:p-8 text-left">
                    <h3 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">
                      {tile.title}
                    </h3>
                    <p className="text-gray-200 text-sm md:text-base mb-4 leading-relaxed">
                      {tile.teaser}
                    </p>
                    <span className="inline-flex items-center gap-2 text-vortex-red font-semibold">
                      Explore
                      <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </div>
                </>
              )

              return (
                <motion.div
                  key={tile.title}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.12, duration: 0.6 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.02 }}
                >
                  {tile.kind === 'internal' ? (
                    <Link to={tile.to} className={tileClassName}>
                      {content}
                    </Link>
                  ) : (
                    <a
                      href={tile.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={tileClassName}
                    >
                      {content}
                    </a>
                  )}
                </motion.div>
              )
            })}
          </div>

          <motion.div
            className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <Link
              to={ENROLL_PATH}
              className="inline-flex items-center justify-center border-2 border-vortex-red bg-transparent text-vortex-red px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-vortex-red/10 hover:scale-105"
            >
              Enroll Now
            </Link>
            <Link
              to="/read-board#schedule"
              className="inline-flex items-center justify-center border-2 border-vortex-red bg-transparent text-vortex-red px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 hover:bg-vortex-red/10 hover:scale-105"
            >
              View Class Schedule
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default Sports
