import { ArrowRight, CheckCircle, MapPin, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BEGINNER_GYMNASTICS_FAQS } from '../../../config/beginnerGymnasticsFaqs'
import { getSiteEnrollHref } from '../../../utils/enrollSite'

const foundations = [
  'Safe landings, rolls, and basic tumbling shapes',
  'Balance, coordination, flexibility, and body control',
  'Handstand and cartwheel progressions',
  'Age-appropriate vault, bars, beam, and floor fundamentals',
  'Listening skills, confidence, and positive training habits',
]

const BeginnerGymnasticsPage = () => {
  const enrollHref = getSiteEnrollHref({ programName: 'Beginner Gymnastics' })

  return (
    <main className="min-h-screen bg-white pt-below-site-header">
      <section className="bg-gradient-to-br from-red-950 via-gray-950 to-black px-4 py-20 text-white md:py-28">
        <div className="container-custom mx-auto max-w-5xl text-center">
          <p className="mb-4 font-bold uppercase tracking-[0.2em] text-red-300">No experience needed</p>
          <h1 className="text-4xl font-display font-bold md:text-6xl">
            Beginner Gymnastics Classes in Bowie, MD
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-200 md:text-xl">
            Give your child a confident, safe start in gymnastics. Vortex coaches teach the
            fundamentals through clear progressions that make movement fun and help every athlete
            build strength, coordination, and skills at the right pace.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Link to={enrollHref} className="inline-flex items-center gap-2 rounded-xl bg-vortex-red px-8 py-4 text-lg font-bold text-white hover:bg-red-700">
              Find a Beginner Class <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/read-board#schedule" className="rounded-xl border-2 border-white px-8 py-4 text-lg font-bold hover:bg-white/10">
              View Classes &amp; Events
            </Link>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-custom grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-display font-bold text-black md:text-4xl">A strong first step for every new gymnast</h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-700">
              Starting gymnastics should feel exciting, not intimidating. Our beginner pathway
              introduces children to the gym, equipment, and essential movement patterns in a
              supportive setting. Coaches break each skill into manageable steps, reinforce safe
              technique, and celebrate progress without rushing athletes into skills they are not
              ready to perform.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-gray-700">
              Gymnastics is also a powerful foundation for other youth sports. The balance, spatial
              awareness, mobility, strength, and landing mechanics learned here transfer naturally
              to dance, cheer, soccer, football, martial arts, and everyday play.
            </p>
          </div>
          <div className="rounded-3xl bg-gray-50 p-8 ring-1 ring-gray-200">
            <h2 className="text-2xl font-bold text-black">Beginner foundations</h2>
            <ul className="mt-6 space-y-4">
              {foundations.map((item) => (
                <li key={item} className="flex gap-3 text-gray-700">
                  <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-vortex-red" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section-padding bg-gray-950 text-white">
        <div className="container-custom">
          <h2 className="text-center text-3xl font-display font-bold md:text-4xl">What families can expect at Vortex</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              [ShieldCheck, 'Progression before pressure', 'Athletes build prerequisite strength and technique before advancing to harder skills.'],
              [Users, 'Coaching that meets them where they are', 'Instruction is age-aware and adaptable so beginners can learn with confidence.'],
              [Sparkles, 'Progress families can see', 'Each class develops physical ability alongside focus, resilience, and self-belief.'],
            ].map(([Icon, title, copy]) => {
              const CardIcon = Icon as typeof ShieldCheck
              return (
                <article key={title as string} className="rounded-2xl bg-white/10 p-7">
                  <CardIcon className="h-8 w-8 text-red-400" aria-hidden="true" />
                  <h3 className="mt-4 text-xl font-bold">{title as string}</h3>
                  <p className="mt-3 leading-relaxed text-gray-300">{copy as string}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-custom max-w-4xl">
          <div className="text-center">
            <MapPin className="mx-auto h-9 w-9 text-vortex-red" aria-hidden="true" />
            <h2 className="mt-4 text-3xl font-display font-bold text-black md:text-4xl">Beginner gymnastics near Bowie families</h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-gray-700">
              Train at 4961 Tesla Dr, Ste E in Bowie, Maryland. Vortex welcomes beginner gymnasts
              from Bowie, Crofton, Mitchellville, Upper Marlboro, Glenn Dale, Lanham, and throughout
              Prince George&apos;s and Anne Arundel counties. Explore our
              {' '}<Link className="font-semibold text-vortex-red underline" to="/artistic-gymnastics-early">preschool gymnastics</Link>,
              {' '}<Link className="font-semibold text-vortex-red underline" to="/artistic-gymnastics-6-12">ages 6–12 pathway</Link>,
              {' '}or <Link className="font-semibold text-vortex-red underline" to="/trampoline-tumbling">trampoline and tumbling classes</Link>.
            </p>
          </div>
          <div className="mt-14">
            <h2 className="text-center text-3xl font-display font-bold text-black">Beginner gymnastics FAQs</h2>
            <div className="mt-8 space-y-4">
              {BEGINNER_GYMNASTICS_FAQS.map((faq) => (
                <details key={faq.question} className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                  <summary className="cursor-pointer text-lg font-bold text-black">{faq.question}</summary>
                  <p className="mt-4 leading-relaxed text-gray-700">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-vortex-red px-4 py-14 text-center text-white">
        <h2 className="text-3xl font-display font-bold">Ready for your child&apos;s first gymnastics class?</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg">Choose an age-appropriate class or contact our team for help finding the right fit.</p>
        <Link to={enrollHref} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-bold text-vortex-red hover:bg-gray-100">
          Explore Beginner Classes <ArrowRight className="h-5 w-5" />
        </Link>
      </section>
    </main>
  )
}

export default BeginnerGymnasticsPage
