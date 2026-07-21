import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface ProgramTile {
  title: string
  teaser: string
  image: string
  imageAlt: string
  to?: string
}

const tiles: ProgramTile[] = [
  {
    title: 'Sports Conditioning',
    teaser: 'Build stamina, movement quality, and game-ready conditioning that transfers to every sport.',
    image: '/multisport.jpeg',
    imageAlt: 'Young athletes completing sports conditioning drills at Vortex',
  },
  {
    title: 'Fit & Flip',
    teaser: 'Strength, conditioning, and acrobatics for the complete athlete.',
    image: '/tumbling.jpeg',
    imageAlt: 'Young athlete performing a flip during tumbling training at Vortex',
    to: '/strength-conditioning',
  },
  {
    title: 'Speed & Agility Training',
    teaser: 'Develop faster acceleration, sharper direction changes, and quicker reactions for every sport.',
    image: '/agility.jpeg',
    imageAlt: 'Athlete completing a cone agility drill at Vortex',
  },
  {
    title: 'Strength & Explosiveness',
    teaser: 'Build force, power, and resilient movement that translate into stronger athletic performance.',
    image: '/strength.jpeg',
    imageAlt: 'Strength and power training equipment at Vortex',
  },
]

const tileClassName =
  'group relative block h-72 overflow-hidden rounded-3xl border-2 border-vortex-red shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-vortex-red focus-visible:ring-offset-2 md:h-96'

export default function AcceleratorProgramTiles() {
  return (
    <section className="section-padding bg-black">
      <div className="container-custom">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          {tiles.map((tile, index) => {
            const content = (
              <>
                <img
                  src={tile.image}
                  alt={tile.imageAlt}
                  className="absolute inset-0 h-full w-full object-cover brightness-75 transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
                <div className="absolute inset-0 z-10 flex flex-col p-6 text-left md:p-8">
                  <h3 className="mb-2 text-2xl font-display font-bold text-white md:text-3xl">
                    {tile.title}
                  </h3>
                  <p className="mb-4 text-sm leading-relaxed text-gray-200 md:text-base">
                    {tile.teaser}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-2 font-semibold text-vortex-red">
                    {tile.to ? (
                      <>
                        Explore
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </>
                    ) : (
                      'Coming soon'
                    )}
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
                {tile.to ? (
                  <Link to={tile.to} className={tileClassName}>
                    {content}
                  </Link>
                ) : (
                  <div className={tileClassName}>{content}</div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
