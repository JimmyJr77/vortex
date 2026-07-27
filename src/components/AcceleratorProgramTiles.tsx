import { motion } from 'framer-motion'

interface ProgramTile {
  title: string
  teaser: string
  image: string
  imageAlt: string
  lighterImage?: boolean
}

const tiles: ProgramTile[] = [
  {
    title: 'Sports Conditioning',
    teaser: 'Build stamina, movement quality, and game-ready conditioning that transfers to every sport.',
    image: '/multisport.jpeg',
    imageAlt: 'Young athletes completing sports conditioning drills at Vortex',
  },
  {
    title: 'Body Control',
    teaser: 'Develop body control through elite tumbling training on trampolines and mats.',
    image: '/fit-and-flip.jpeg',
    imageAlt: 'Young athlete performing a flip on a trampoline at Vortex',
    lighterImage: true,
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
  {
    title: 'Mobility & Balance',
    teaser: 'Master flexibility, mobility, fluidity, and balance.',
    image: '/balance.jpeg',
    imageAlt: 'Athlete developing mobility and balance at Vortex',
  },
  {
    title: 'Lifting Fundamentals',
    teaser: 'Learn safe and proper techniques for strength training. 8 & up.',
    image: '/lifting-fundamentals.jpeg',
    imageAlt: 'Young athlete practicing a barbell lift at Vortex',
  },
]

const tileClassName =
  'group relative h-72 overflow-hidden rounded-3xl border-2 border-vortex-red shadow-lg md:h-96'

export default function AcceleratorProgramTiles() {
  return (
    <section className="section-padding bg-black">
      <div className="container-custom">
        <motion.div
          className="mx-auto mb-12 max-w-4xl text-center md:mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
        >
          <h2 className="mb-4 text-4xl font-display font-bold text-white md:text-5xl">
            Fit &amp; Flip
          </h2>
          <p className="text-lg leading-relaxed text-gray-300 md:text-xl">
            Vortex Athletic&apos;s foundational athletics training program. Athletes train in
            1.5 hour blocks and combine advanced athletics training with tumbling,
            coordination, and body control. All training is underpinned by our Athleticism
            Accelerator training philosophy. Fit &amp; Flip trains all the below elements.
            Specialized training blocks also available.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8">
          {tiles.map((tile, index) => {
            const content = (
              <>
                <img
                  src={tile.image}
                  alt={tile.imageAlt}
                  className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                    tile.lighterImage ? 'brightness-100' : 'brightness-75'
                  }`}
                  loading="lazy"
                  decoding="async"
                />
                <div
                  className={`absolute inset-0 z-[1] ${
                    tile.lighterImage
                      ? 'bg-gradient-to-b from-black/60 via-black/20 to-transparent'
                      : 'bg-gradient-to-t from-black/85 via-black/40 to-black/20'
                  }`}
                />
                <div className="absolute inset-0 z-10 flex flex-col p-6 text-left md:p-8">
                  <h3 className="mb-2 text-2xl font-display font-bold text-white md:text-3xl">
                    {tile.title}
                  </h3>
                  <p className="mb-4 text-sm leading-relaxed text-gray-200 md:text-base">
                    {tile.teaser}
                  </p>
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
                <div className={tileClassName}>{content}</div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
