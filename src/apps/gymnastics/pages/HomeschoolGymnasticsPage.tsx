import { ArrowRight, BookOpenCheck, Clock3, HeartHandshake, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { HOMESCHOOL_GYMNASTICS_FAQS } from '../../../config/localSeoFaqs'
import { getSiteEnrollHref } from '../../../utils/enrollSite'

const benefits = [
  {
    icon: BookOpenCheck,
    title: 'A complete physical-education foundation',
    copy: 'Balance, coordination, strength, flexibility, spatial awareness, and safe movement taught through progressive gymnastics.',
  },
  {
    icon: HeartHandshake,
    title: 'Movement and meaningful social time',
    copy: 'Athletes learn alongside peers, practice listening and cooperation, and build confidence in a supportive setting.',
  },
  {
    icon: ShieldCheck,
    title: 'Beginner-friendly coaching',
    copy: 'No gymnastics background is required. Coaches adapt progressions to each athlete’s age, readiness, and experience.',
  },
]

const HomeschoolGymnasticsPage = () => {
  const enrollHref = getSiteEnrollHref({ programName: 'Homeschool Gymnastics' })

  return (
    <main className="min-h-screen bg-white pt-below-site-header">
      <section className="bg-gradient-to-br from-blue-950 via-gray-950 to-black px-4 py-20 text-center text-white md:py-28">
        <div className="container-custom max-w-5xl">
          <p className="font-bold uppercase tracking-[0.2em] text-sky-300">Daytime movement and PE</p>
          <h1 className="mt-4 text-4xl font-display font-bold md:text-6xl">
            Homeschool Gymnastics &amp; PE in Bowie, MD
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-200 md:text-xl">
            Structured daytime gymnastics helps homeschool athletes build physical literacy,
            confidence, and friendships while giving families a purposeful physical-education option.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Link to={enrollHref} className="inline-flex items-center gap-2 rounded-xl bg-vortex-red px-8 py-4 text-lg font-bold hover:bg-red-700">
              Check Class Availability <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/read-board#schedule" className="rounded-xl border-2 border-white px-8 py-4 text-lg font-bold hover:bg-white/10">
              View Classes &amp; Events
            </Link>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-custom max-w-5xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-display font-bold text-black md:text-4xl">
              More than an activity break
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-700">
              Gymnastics develops the movement vocabulary children use in every sport and throughout
              daily life. Vortex homeschool programming combines purposeful instruction, physical
              challenge, and fun so athletes can meet PE goals while learning skills they are proud
              to practice.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {benefits.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="rounded-2xl border border-gray-200 bg-gray-50 p-7">
                <Icon className="h-8 w-8 text-vortex-red" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-bold text-black">{title}</h3>
                <p className="mt-3 leading-relaxed text-gray-700">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-gray-950 text-white">
        <div className="container-custom grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Clock3 className="h-9 w-9 text-sky-300" aria-hidden="true" />
            <h2 className="mt-4 text-3xl font-display font-bold md:text-4xl">
              Flexible-schedule gymnastics for local families
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-300">
              Our Bowie facility welcomes homeschool and flexible-schedule families from Crofton,
              Mitchellville, Upper Marlboro, Glenn Dale, Lanham, and nearby Prince George&apos;s and
              Anne Arundel County communities.
            </p>
            <p className="mt-4 leading-relaxed text-gray-300">
              Daytime offerings can change by session. Check current availability online or ask the
              Vortex team which class best matches your athlete&apos;s age and experience.
            </p>
          </div>
          <div className="rounded-3xl bg-white/10 p-8">
            <h2 className="text-2xl font-bold">Continue exploring</h2>
            <div className="mt-5 grid gap-3">
              <Link className="rounded-xl bg-white px-5 py-4 font-bold text-black hover:bg-gray-100" to="/beginner-gymnastics">Beginner Gymnastics</Link>
              <Link className="rounded-xl bg-white px-5 py-4 font-bold text-black hover:bg-gray-100" to="/artistic-gymnastics-early">Preschool &amp; Parent-Child Gymnastics</Link>
              <Link className="rounded-xl bg-white px-5 py-4 font-bold text-black hover:bg-gray-100" to="/trampoline-tumbling">Trampoline &amp; Tumbling</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-custom max-w-4xl">
          <h2 className="text-center text-3xl font-display font-bold text-black">Homeschool gymnastics FAQs</h2>
          <div className="mt-8 space-y-4">
            {HOMESCHOOL_GYMNASTICS_FAQS.map((faq) => (
              <details key={faq.question} className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <summary className="cursor-pointer text-lg font-bold text-black">{faq.question}</summary>
                <p className="mt-4 leading-relaxed text-gray-700">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default HomeschoolGymnasticsPage
