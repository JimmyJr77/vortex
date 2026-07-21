import { AnimatePresence, motion } from 'framer-motion'
import { Info } from 'lucide-react'
import { useState } from 'react'

type TriadTab = 'what' | 'how' | 'why'
type TriadItem = { name: string; meaning: string }

const triads: Record<
  TriadTab,
  { title: string; definition: string; whyItMatters: string; itemsLabel: string; items: TriadItem[] }
> = {
  what: {
    title: 'Athletic Tenets (WHAT we build)',
    definition: 'The core performance qualities we develop—the outcomes athletes gain from training.',
    whyItMatters: 'These define what improves: not just “working out,” but building specific athletic qualities.',
    itemsLabel: 'Tenets we build',
    items: [
      { name: 'Strength', meaning: 'Ability to produce and resist force.' },
      { name: 'Explosiveness', meaning: 'Power and quick, forceful movement.' },
      { name: 'Speed', meaning: 'How fast the body can move.' },
      { name: 'Agility', meaning: 'Quick change of direction and reaction.' },
      { name: 'Flexibility', meaning: 'Range of motion and suppleness.' },
      { name: 'Balance', meaning: 'Stability and control in static and dynamic positions.' },
      { name: 'Coordination', meaning: 'Moving body parts together efficiently.' },
      { name: 'Body Control', meaning: 'Precision and awareness of movement.' },
    ],
  },
  how: {
    title: 'Training Methodologies (HOW we train)',
    definition: 'The tools we use to develop those qualities—how we apply stress and practice.',
    whyItMatters: 'Different tools create different adaptations; method matters as much as effort.',
    itemsLabel: 'Methodologies we use',
    items: [
      { name: 'Resistance & Calisthenics', meaning: 'Weights, bands, and bodyweight strength work.' },
      { name: 'Plyometrics', meaning: 'Jumping and explosive drills that build power.' },
      { name: 'Isometrics', meaning: 'Holding tension in one position to build strength and control.' },
      { name: 'Eccentric / Negative Training', meaning: 'Controlled lengthening under load for resilience.' },
      { name: 'Neural Training', meaning: 'Fast, reactive drills that sharpen reflexes and timing.' },
      { name: 'Balance & Stability Work', meaning: 'Drills that challenge equilibrium and core control.' },
      { name: 'Mobility & Flexibility Drills', meaning: 'Stretching and movement to improve range and recovery.' },
      { name: 'Core & Body Control Work', meaning: 'Targeted work for midsection and movement precision.' },
    ],
  },
  why: {
    title: 'Physiological Emphasis (WHY it works)',
    definition: 'The biological systems each class targets—so adaptation is intentional and safe.',
    whyItMatters: 'Training the right system at the right time leads to smarter, safer progress.',
    itemsLabel: 'Emphases we target',
    items: [
      { name: 'Neural Output & Readiness', meaning: 'Nervous system speed and reaction—how fast the body can fire.' },
      { name: 'Force Capacity & Tissue Capacity', meaning: 'Muscle and tendon strength and durability.' },
      { name: 'SSC & Stiffness (Elastic Energy)', meaning: 'Spring-like rebound and stored energy in movement.' },
      { name: 'Control & Stability', meaning: 'Joint and postural control under load and motion.' },
      { name: 'Movement Intelligence', meaning: 'Skill and pattern quality—doing the right thing at the right time.' },
    ],
  },
}

export default function TrainingPhilosophy() {
  const [triadTab, setTriadTab] = useState<TriadTab>('what')
  const triadTooltip =
    'Every Vortex class balances athletic outcomes, training methods, and physiological intent—so athletes progress with purpose, not guesswork.'

  return (
    <div className="mt-24">
      <motion.div className="mb-8 text-center" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
        <h2 className="mb-4 text-4xl font-display font-bold text-black md:text-5xl">
          TRAINING <span className="text-vortex-red">PHILOSOPHY</span>
        </h2>
        <p className="text-lg text-gray-600">
          Every class is designed using three connected training lenses—so athletes build real, transferable athleticism.
        </p>
      </motion.div>

      <motion.div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
        <div className="flex border-b border-gray-200">
          {(['what', 'how', 'why'] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setTriadTab(tab)} className={`flex-1 px-4 py-4 text-sm font-semibold uppercase tracking-wider transition ${triadTab === tab ? 'border-b-2 border-vortex-red bg-vortex-red text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
              {tab === 'what' ? 'What' : tab === 'how' ? 'How' : 'Why'}
            </button>
          ))}
        </div>
        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div key={triadTab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-xl font-display font-bold text-black md:text-2xl">{triads[triadTab].title}</h3>
                <span className="flex-shrink-0 cursor-help rounded-full p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-700" title={triadTooltip} aria-label="More about how triads work together"><Info className="h-5 w-5" /></span>
              </div>
              <p className="leading-relaxed text-gray-700">{triads[triadTab].definition}</p>
              <p className="text-sm font-medium text-vortex-red">Why it matters: {triads[triadTab].whyItMatters}</p>
              <div className="mt-2 border-t border-gray-200 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600">{triads[triadTab].itemsLabel}</p>
                <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  {triads[triadTab].items.map((item) => (
                    <li key={item.name} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-vortex-red" /><span><strong className="text-gray-900">{item.name}</strong><span className="text-gray-700"> — {item.meaning}</span></span></li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="border-t border-gray-200 bg-gray-200 px-6 py-4 md:px-8">
          <p className="text-center text-sm font-medium italic text-gray-700 md:text-base">
            Vortex classes aren&apos;t random workouts—they&apos;re structured to develop the right qualities, with the right tools, for the right reasons.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
