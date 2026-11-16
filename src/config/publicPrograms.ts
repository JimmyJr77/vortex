import type { Faq } from './faqs'

export type PublicProgramPath = '/gymnastics' | '/fit-and-flip' | '/adult-gymnastics'

type ProgramSection = {
  id: string
  heading: string
  description: string
  topics?: readonly { id: string; heading: string; description: string }[]
}

type PublicProgram = {
  name: string
  path: PublicProgramPath
  title: string
  description: string
  heading: string
  intro: string
  image: string
  imageAlt: string
  imageWidth: number
  imageHeight: number
  primaryAction: { href: string; label: string; analyticsKey: string }
  trialHref?: string
  sections: readonly ProgramSection[]
  faqs: Faq[]
  relatedPaths: readonly PublicProgramPath[]
}

export const PUBLIC_PROGRAMS: Record<PublicProgramPath, PublicProgram> = {
  '/gymnastics': {
    name: 'Youth Gymnastics',
    path: '/gymnastics',
    title: 'Youth Gymnastics Classes in Bowie, MD | Vortex',
    description: 'Find youth gymnastics in Bowie, MD, from preschool and beginner classes to developmental and team training. Find the right first class for your child.',
    heading: 'Youth gymnastics classes in Bowie, MD',
    intro: 'Find a place to start and room to grow. Vortex coaches teach kids and teens gymnastics skills alongside the strength, coordination, and body control to use them.',
    image: '/gymnastics-hero.webp',
    imageAlt: 'Young gymnasts learning together with a coach at Vortex',
    imageWidth: 1600,
    imageHeight: 1200,
    primaryAction: { href: '/enroll?program=Developmental%20Gymnastics', label: 'Browse gymnastics classes', analyticsKey: 'browse_classes' },
    trialHref: '/#free-trial',
    sections: [
      {
        id: 'choose-a-class',
        heading: 'Find the right starting class',
        description: 'The gymnastics trial finder uses your child’s age and experience to show the right type of class. Current openings appear when you choose Gymnastics in the finder.',
        topics: [
          { id: 'preschool', heading: 'Toddler and preschool gymnastics', description: 'The Mommy & Me trial is for potty-trained children ages 2–3. Ages 4–5 are directed to a preschool class, where coaches introduce balance, coordination, and basic gymnastics shapes through movement.' },
          { id: 'beginner', heading: 'First gymnastics class', description: 'Ages 6–17 with no prior gymnastics experience start with a Tornadoes trial when available. Coaches introduce the foundations of gymnastics and help athletes learn to move, support their body weight, and land with control.' },
          { id: 'youth', heading: 'Developmental and team pathways', description: 'Developmental classes let athletes build skills without competing. Team gymnastics adds competition for athletes placed in that pathway. Families can ask the coaching team how progression and team placement work.' },
          { id: 'teen', heading: 'Teens and experienced gymnasts', description: 'New teen gymnasts can enter through the beginner trial finder. Athletes ages 6–17 who have done gymnastics before are directed to a Trial Assessment, where a coach can help place them at a suitable level.' },
        ],
      },
      {
        id: 'disciplines',
        heading: 'Gymnastics disciplines',
        description: 'Developmental gymnastics builds foundations shared across disciplines. These are some of the skills athletes can encounter as they progress. Ask Vortex about the current class or team pathway for a particular discipline.',
        topics: [
          { id: 'artistic', heading: 'Artistic gymnastics', description: 'Floor skills and apparatus work develop strength, balance, swings, and controlled landings.' },
          { id: 'rhythmic', heading: 'Rhythmic gymnastics', description: 'Gymnasts combine movement, balance, and coordination with hand apparatus such as a hoop or ribbon.' },
          { id: 'acro', heading: 'Acrobatic gymnastics', description: 'Partner and group work adds timing, communication, and shared balance to individual gymnastics skills.' },
          { id: 'aerobic', heading: 'Aerobic gymnastics', description: 'Continuous sequences combine dynamic movement, rhythm, coordination, and endurance.' },
          { id: 'trampoline-tumbling', heading: 'Trampoline and tumbling', description: 'Athletes work on rebounds, aerial awareness, and floor tumbling with a focus on control through the landing.' },
        ],
      },
      {
        id: 'homeschool',
        heading: 'Gymnastics for homeschool families',
        description: 'If you are fitting gymnastics into a homeschool or co-op schedule, contact us with the athlete’s age, skill level, and preferred class times. We can help you check which current classes fit.',
      },
    ],
    faqs: [
      { question: 'Does my child need gymnastics experience to start?', answer: 'Beginners are welcome. The trial finder matches new gymnasts ages 6–17 with Tornadoes trials when available. If your athlete has trained before, choose the experienced pathway to look for a Trial Assessment.' },
      { question: 'Does my child have to compete?', answer: 'Competition is part of the team pathway. Athletes in developmental gymnastics can work on skills, strength, and body control without entering competitions.' },
      { question: 'How do I choose a gymnastics class?', answer: 'For a first visit, select Gymnastics in the free trial finder and enter your child’s age and experience. You can also browse the live class catalog or contact Vortex if you have a placement question.' },
    ],
    relatedPaths: ['/fit-and-flip', '/adult-gymnastics'],
  },
  '/fit-and-flip': {
    name: 'Fit & Flip Youth Athletic Training',
    path: '/fit-and-flip',
    title: 'Youth Sports Performance Training in Bowie, MD | Vortex',
    description: 'Fit & Flip is youth athletic training in Bowie, MD. Kids and teens build strength, explosiveness, and body control for sports, cheer, dance, and tumbling.',
    heading: 'Youth athletic training in Bowie, MD',
    intro: 'Fit & Flip helps young athletes get stronger, move more explosively, and stay in control. Coached strength and power work meets gymnastics-inspired movement in a class built for athletes across sports.',
    image: '/fit-and-flip-card.webp',
    imageAlt: 'A Vortex athlete practicing aerial body control on a trampoline',
    imageWidth: 900,
    imageHeight: 675,
    primaryAction: { href: '/enroll?program=Fit%20%26%20Flip', label: 'Browse Fit & Flip classes', analyticsKey: 'browse_classes' },
    trialHref: '/#free-trial',
    sections: [
      {
        id: 'athleticism-development',
        heading: 'Athleticism development through the Triad of Athleticism',
        description: 'The Triad links three qualities that athletes use together. A jump, for example, starts with the strength to create force, uses explosiveness to take off quickly, and needs body control to finish with a balanced landing.',
        topics: [
          { id: 'strength', heading: 'Strength', description: 'Progressive, coached resistance work develops the ability to push, pull, and support the body. That foundation helps an athlete hold a stable shape in gymnastics or stay balanced when they change direction on the court.' },
          { id: 'explosiveness', heading: 'Explosiveness', description: 'Jumps, takeoffs, and dynamic movement teach athletes to produce force quickly. That carries over to a first step on the field or a stronger takeoff in cheer and tumbling.' },
          { id: 'body-control', heading: 'Body control', description: 'Gymnastics-inspired work challenges coordination, balance, and awareness in the air. Athletes practice staying organized through rotation and arriving at a controlled landing.' },
        ],
      },
      {
        id: 'choose-a-class',
        heading: 'Who Fit & Flip is for',
        description: 'Field and court athletes can use Fit & Flip to complement their youth sports practice. Cheer, acro, dance, and tumbling athletes can work on the strength and takeoff behind their skills. Gymnasts can add more time for strength and power alongside their gymnastics classes.',
      },
      {
        id: 'training-fit',
        heading: 'Getting started with youth fitness training',
        description: 'Fit & Flip’s Cyclones groups are ages 8–11 and 12–15. Browse class details and experience levels in the catalog, or use the Fit & Flip free trial finder to look for an opening in your athlete’s age group.',
      },
    ],
    faqs: [
      { question: 'What is youth sports performance training?', answer: 'It is coached physical development that supports skills across sports. Fit & Flip combines strength work, explosive movement, and gymnastics-inspired body control so athletes practice creating and managing force.' },
      { question: 'Does my athlete need to be a gymnast?', answer: 'Fit & Flip is open to athletes from a range of sports. Coaches use gymnastics-inspired exercises alongside strength and power work. Check the age and level for the class you are considering.' },
      { question: 'When should my child choose youth gymnastics instead?', answer: 'Start with youth gymnastics if the goal is to learn and progress in gymnastics skills. Choose Fit & Flip if the main goal is physical development for a sport or additional strength, power, and body control for tumbling.' },
    ],
    relatedPaths: ['/gymnastics', '/adult-gymnastics'],
  },
  '/adult-gymnastics': {
    name: 'Adult Gymnastics and Acrobatics',
    path: '/adult-gymnastics',
    title: 'Adult Gymnastics & Acrobatics in Bowie, MD | Vortex',
    description: 'Ask about Typhoons at Vortex in Bowie, MD. Adults 18 and up can build strength, mobility, and introductory gymnastics and acrobatics skills.',
    heading: 'Adult gymnastics and acrobatics in Bowie, MD',
    intro: 'Typhoons is Vortex’s fitness and acrobatics class for adults 18 and up. It combines strength, conditioning, and mobility with introductory acrobatics. Beginners and returning gymnasts are welcome.',
    image: '/gym-DSC02636-1600.webp',
    imageAlt: 'Vortex Athletics gymnastics training area in Bowie, Maryland',
    imageWidth: 1600,
    imageHeight: 1066,
    primaryAction: { href: '/contact', label: 'Ask about adult class availability', analyticsKey: 'inquire' },
    sections: [
      {
        id: 'class-format',
        heading: 'What to expect in Typhoons',
        description: 'The adult class pairs conditioning and mobility work with gymnastics and introductory acrobatics. Expect to practice the physical foundations that help you control a movement, such as supporting your body weight, balancing, or moving through a new range of motion.',
        topics: [
          { id: 'adult-beginners', heading: 'Starting from scratch', description: 'You can start without a gymnastics background. Tell the team what you would like to learn and ask about the starting progressions for your experience level.' },
          { id: 'returning-gymnasts', heading: 'Returning to gymnastics', description: 'If you are coming back after time away, share your training background and goals. A coach can help you identify where to restart and build toward more demanding skills.' },
        ],
      },
      {
        id: 'adult-availability',
        heading: 'Plan your first adult class',
        description: 'Contact Vortex and ask about Typhoons. The team can confirm current openings, how to join, what to bring, and which class fits your experience.',
      },
    ],
    faqs: [
      { question: 'What age is the adult gymnastics class for?', answer: 'Typhoons is for adults ages 18 and up. Vortex has separate youth gymnastics pathways for kids and teens.' },
      { question: 'Can I join as a beginner?', answer: 'Yes. Typhoons welcomes adults without prior gymnastics experience. Contact Vortex if you would like help choosing your starting point.' },
      { question: 'How do I sign up for Typhoons?', answer: 'Contact Vortex and ask for the current adult schedule, availability, and registration options.' },
    ],
    relatedPaths: ['/gymnastics', '/fit-and-flip'],
  },
}
