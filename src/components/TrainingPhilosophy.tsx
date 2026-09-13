import { AnimatePresence, motion } from 'framer-motion'
import { Info } from 'lucide-react'
import { useState } from 'react'
import { VORTEX_DEVELOPMENT_COMPONENTS, VORTEX_PHILOSOPHY } from '../coach/vortexTrainingPhilosophy'

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
    title: 'Training Practice (HOW we train)',
    definition: 'Purposeful practice and progressive loading develop the eight tenets across four training components.',
    whyItMatters: 'We scale to demonstrated skill, readiness and training experience, with recovery that protects quality.',
    itemsLabel: 'How we put the philosophy into practice',
    items: [
      { name: 'Familiar Preparation', meaning: 'Dynamic movement and a specific rehearsal of the day’s demands.' },
      { name: 'Speed & Explosive Practice', meaning: 'Short sprints, jumps and throws with time to recover.' },
      { name: 'Progressive Full-Body Strength', meaning: 'Squat, hinge, push, pull and carry with controlled technique.' },
      { name: 'Isometric & Eccentric Work', meaning: 'Appropriate holds and controlled lowering within strength practice.' },
      { name: 'Movement Intelligence', meaning: 'Balance, rhythm and useful decisions woven into athletic movement.' },
      { name: 'Dedicated Tumbling', meaning: 'Coached progressions in orientation, support, rotation and landing.' },
      { name: 'Individual Progression', meaning: 'Control → Produce → Redirect → React, earned through repeatable skill.' },
      { name: 'Purposeful Play', meaning: 'Inclusive games, teamwork and competition that fit readiness and time.' },
    ],
  },
  why: {
    title: 'Physiological Emphasis (WHY it works)',
    definition: 'The intended adaptations connect exercise choice, effort and recovery to each athlete’s development.',
    whyItMatters: 'We protect speed and skill quality, build strength gradually and adjust the dose to the athlete.',
    itemsLabel: 'Emphases we target',
    items: [
      { name: 'Neural Output & Readiness', meaning: 'Nervous system speed and reaction—how fast the body can fire.' },
      { name: 'Force Capacity & Tissue Capacity', meaning: 'Muscle and tendon strength and durability.' },
      { name: 'SSC & Stiffness (Elastic Energy)', meaning: 'Spring-like rebound and stored energy in movement.' },
      { name: 'Control & Stability', meaning: 'Joint and postural control under load and motion.' },
      { name: 'Movement Intelligence', meaning: 'Skill and pattern quality—doing the right thing at the right time.' },
      { name: 'Capacity & Recovery', meaning: 'Repeat useful efforts and recover, with conditioning added when appropriate.' },
    ],
  },
}

export default function TrainingPhilosophy() {
  const [triadTab, setTriadTab] = useState<TriadTab>('what')
  const triadTooltip =
    'Every Vortex class balances athletic outcomes, training methods, and physiological intent—so athletes progress with purpose, not guesswork.'

  return (
    <div className="mt-24" id="training-philosophy">
      <motion.div className="mb-8 text-center" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
        <h2 className="mb-4 text-4xl font-display font-bold text-black md:text-5xl">
          TRAINING <span className="text-vortex-red">PHILOSOPHY</span>
        </h2>
        <p className="text-lg text-gray-600">
          {VORTEX_PHILOSOPHY.mission}
        </p>
        <p className="mt-4 font-semibold text-vortex-red">{VORTEX_PHILOSOPHY.identity}</p>
      </motion.div>

      <ol aria-label="Vortex training progression" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VORTEX_DEVELOPMENT_COMPONENTS.map((component, index) => (
          <li key={component.key} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-vortex-red">Step {index + 1}</p>
            <h3 className="font-display text-xl font-bold text-gray-950">{component.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{component.purpose}</p>
          </li>
        ))}
      </ol>
      <p className="mb-6 text-center text-sm leading-relaxed text-gray-600">
        All eight tenets stay at the center. Balance, coordination, movement intelligence and resilience run throughout.
        Each visit provides broad development; the emphasis and dose adapt to attendance and readiness.
      </p>

      <motion.div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
        <div className="flex border-b border-gray-200">
          {(['what', 'how', 'why'] as const).map((tab) => (
            <button key={tab} type="button" aria-pressed={triadTab === tab} onClick={() => setTriadTab(tab)} className={`flex-1 px-4 py-4 text-sm font-semibold uppercase tracking-wider transition ${triadTab === tab ? 'border-b-2 border-vortex-red bg-vortex-red text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
              {tab === 'what' ? 'What' : tab === 'how' ? 'How' : 'Why'}
            </button>
          ))}
        </div>
        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div key={triadTab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-xl font-display font-bold text-black md:text-2xl">{triads[triadTab].title}</h3>
                <span className="flex-shrink-0 cursor-help rounded-full p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-700" title={triadTooltip}>
                  <Info className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">More about how triads work together</span>
                </span>
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
            {VORTEX_PHILOSOPHY.standard}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
