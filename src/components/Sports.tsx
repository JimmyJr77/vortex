import { motion } from 'framer-motion'
import { ArrowRight, LayoutGrid } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getGymnasticsSiteUrl } from '../utils/gymnasticsSite'
import HomePage from './HomePage'

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
    to: '/vortex-athletics',
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
  'group relative block h-72 md:h-96 overflow-hidden rounded-3xl border-2 border-vortex-red shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-vortex-red focus-visible:ring-offset-2'

const showHomePageSignupCtas = () => undefined

const SPORTS_OFFER_HEADLINES = [
  {
    leading: 'JUMP HIGHER.\u00a0 THROW FARTHER.\u00a0 RUN FASTER.\u00a0 MOVE BETTER.',
    emphasis: 'BE A BETTER ATHLETE.',
  },
  {
    leading: "DON'T JUST PLAY AT THE TRAMPOLINE PARK, LEARN HOW TO",
    emphasis: 'FLIP & TUMBLE',
    trailing: 'LIKE AN ATHLETE',
  },
  {
    leading: 'LEARN THE POWER, GRACE, SKILL AND FOCUS REQUIRED TO BE THE',
    emphasis: 'NEXT GREAT GYMNAST.',
  },
]

const SportsRouteTiles = () => (
  <section className="section-padding bg-black">
    <div className="container-custom">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
        {SPORT_TILES.map((tile, index) => {
          const content = (
            <>
              <img
                src={tile.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
              <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 text-left md:p-8">
                <h3 className="mb-2 text-2xl font-display font-bold text-white md:text-3xl">
                  {tile.title}
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-gray-200 md:text-base">
                  {tile.teaser}
                </p>
                <span className="inline-flex items-center gap-2 font-semibold text-vortex-red">
                  Explore
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
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
    </div>
  </section>
)

const Sports = () => {
  const [hoveredBanner, setHoveredBanner] = useState<'athletics' | 'gymnastics' | null>(null)

  return (
    <div className="min-h-screen bg-white">
      {/* Sports hero — replaces the standard Athletics home-page hero. */}
      <section
        className="section-padding !pt-[calc(var(--site-header-height)+2rem)] min-[1075px]:!pt-[calc(var(--site-header-height)+7rem)] bg-black border-y border-gray-900"
      >
        <div className="container-custom">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
          >
            <h1 className="mb-5 text-5xl font-display font-bold text-white sm:text-6xl md:text-7xl">
              Train <span className="text-vortex-red">Every</span> Sport.
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
              Pick your path. We&apos;ll build the athlete.
            </p>
          </motion.div>

          <motion.div
            className="mb-8 flex flex-col items-center gap-5 min-[1075px]:flex-row min-[1075px]:gap-8"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            viewport={{ once: true }}
          >
            <motion.div
              className="aspect-[1600/607] w-full min-w-0 overflow-hidden rounded-xl border-2 border-white bg-black shadow-lg min-[1075px]:w-auto min-[1075px]:basis-0 md:rounded-2xl"
              animate={{
                flexGrow: hoveredBanner === 'athletics' ? 1.08 : hoveredBanner === 'gymnastics' ? 0.92 : 1,
              }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              onMouseEnter={() => setHoveredBanner('athletics')}
              onMouseLeave={() => setHoveredBanner(null)}
            >
              <Link
                to="/vortex-athletics"
                className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vortex-red"
                onFocus={() => setHoveredBanner('athletics')}
                onBlur={() => setHoveredBanner(null)}
              >
                <img
                  src="/vortex-athletics-banner.jpg"
                  alt="Go to the Vortex Athletics home page"
                  className="h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              </Link>
            </motion.div>
            <motion.div
              className="aspect-[1600/607] w-full min-w-0 overflow-hidden rounded-xl border-2 border-white bg-black shadow-lg min-[1075px]:w-auto min-[1075px]:basis-0 md:rounded-2xl"
              animate={{
                flexGrow: hoveredBanner === 'gymnastics' ? 1.08 : hoveredBanner === 'athletics' ? 0.92 : 1,
              }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              onMouseEnter={() => setHoveredBanner('gymnastics')}
              onMouseLeave={() => setHoveredBanner(null)}
            >
              <a
                href={getGymnasticsSiteUrl()}
                className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vortex-red"
                onFocus={() => setHoveredBanner('gymnastics')}
                onBlur={() => setHoveredBanner(null)}
              >
                <img
                  src="/vortex-gymnastics-banner.jpg"
                  alt="Go to the Vortex Gymnastics home page"
                  className="h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              </a>
            </motion.div>
          </motion.div>

          <p className="text-center text-sm text-gray-400">Select your challenge above</p>
          <motion.div
            className="mt-3 flex items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <Link
              to="/read-board"
              className="inline-flex min-w-[13rem] items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-center text-sm font-semibold text-black transition-all duration-300 hover:scale-105 hover:bg-gray-100 hover:shadow-lg"
            >
              <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
              View Classes &amp; Events
            </Link>
          </motion.div>
        </div>
      </section>

      <HomePage
        hideHero
        onSignUpClick={showHomePageSignupCtas}
        offerHeadlines={SPORTS_OFFER_HEADLINES}
        strategicLocationAfterOffers
        hideTrainingPhilosophy
        hideTechnology
        afterOffersContent={<SportsRouteTiles />}
      />
    </div>
  )
}

export default Sports
