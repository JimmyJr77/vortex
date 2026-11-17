import type { Faq } from './faqs'
import { ATHLETIC_DEVELOPMENT_GUIDE } from './athleticDevelopmentGuide'
import { GYMNASTICS_CLASS_ATTIRE } from './gymnasticsFaqs'
import { ADULT_BOOKING_HREF, ADULT_DROP_IN_HREF } from '../utils/publicBookingPrograms'

export type PublicProgramPath = '/gymnastics' | '/fit-and-flip' | '/adult-gymnastics'

type ProgramSection = {
  id: string
  heading: string
  description: string
  topics?: readonly { id: string; heading: string; description: string }[]
  links?: readonly { href: string; label: string; analyticsKey: string }[]
}

type ProgramAction = { href: string; label: string; analyticsKey: string }

type PublicProgram = {
  name: string
  path: PublicProgramPath
  title: string
  description: string
  heading: string
  intro: string
  image: string
  imageSrcSet?: string
  imageAlt: string
  imageWidth: number
  imageHeight: number
  primaryAction: ProgramAction
  secondaryAction?: ProgramAction
  sections: readonly ProgramSection[]
  faqs: Faq[]
  relatedPaths: readonly PublicProgramPath[]
}

const DEVELOPMENTAL_GYMNASTICS_HREF = '/enroll?program=Developmental%20Gymnastics'
const FIT_AND_FLIP_ENROLLMENT_HREF = '/enroll?program=Fit%20%26%20Flip'
const FREE_TRIAL_ACTION = { href: '/#free-trial', label: 'Try a free class', analyticsKey: 'free_trial_section' }

export const PUBLIC_PROGRAMS: Record<PublicProgramPath, PublicProgram> = {
  '/gymnastics': {
    name: 'Youth Gymnastics',
    path: '/gymnastics',
    title: 'Youth Gymnastics Classes in Bowie, MD | Vortex',
    description: 'Find youth gymnastics classes in Bowie, MD, for toddlers, preschoolers, kids, and teens. Choose a starting class, see what to wear, and book a free trial.',
    heading: 'Youth gymnastics classes in Bowie, MD',
    intro: 'Find a place to start and room to grow. Vortex coaches teach kids and teens gymnastics skills alongside the strength, coordination, and body control to use them.',
    image: '/gymnastics-hero.webp',
    imageSrcSet: '/gymnastics-hero-768.webp 768w, /gymnastics-hero-1080.webp 1080w, /gymnastics-hero.webp 1600w',
    imageAlt: 'Young gymnasts learning together with a coach at Vortex',
    imageWidth: 1600,
    imageHeight: 1200,
    primaryAction: { href: DEVELOPMENTAL_GYMNASTICS_HREF, label: 'Browse gymnastics classes', analyticsKey: 'browse_classes' },
    secondaryAction: FREE_TRIAL_ACTION,
    sections: [
      {
        id: 'choose-a-class',
        heading: 'Find the right starting class',
        description: 'The gymnastics trial finder uses your child’s age and experience to show the right type of class. Current openings appear when you choose Gymnastics in the finder.',
        topics: [
          {
            id: 'preschool',
            heading: 'Mommy & Me and preschool gymnastics',
            description:
              'In Dirt Devils, a parent or caregiver joins their child for coached movement and play. This Mommy & Me class is for ages 2–3, and children must be potty trained for a trial. ' +
              'In Twisters, preschoolers ages 4–5 practice balance, coordination, and basic gymnastics shapes through play.',
          },
          { id: 'beginner', heading: 'Beginner gymnastics for ages 6–17', description: 'Kids and teens with no gymnastics experience start with a Tornadoes trial when available. Athletes learn body shapes and controlled landings as they work toward skills such as rolls, cartwheels, and handstands.' },
          { id: 'youth', heading: 'Developmental and team pathways', description: 'Developmental classes let athletes build skills without competing. Team gymnastics adds competition for athletes placed in that pathway. Families can ask the coaching team how progression and team placement work.' },
          { id: 'teen', heading: 'Gymnastics for teens and returning athletes', description: 'Teens can start gymnastics with no prior experience. If your child has trained before and is between 6 and 17, choose the experience option in the trial finder. A coach uses a Trial Assessment to evaluate what they are ready to work on and recommend a group.' },
        ],
        links: [
          { href: '/gymnastics#first-visit', label: 'Prepare for your first visit', analyticsKey: 'read_first_visit' },
          { href: DEVELOPMENTAL_GYMNASTICS_HREF, label: 'Browse developmental gymnastics classes', analyticsKey: 'browse_classes' },
        ],
      },
      {
        id: 'first-visit',
        heading: 'What to expect at your child’s first gymnastics class',
        description: 'A trial lets your child meet the coaches and try a class matched to their age and experience at our Bowie gym.',
        topics: [
          { id: 'gymnastics-attire', heading: GYMNASTICS_CLASS_ATTIRE.question, description: GYMNASTICS_CLASS_ATTIRE.answer },
          {
            id: 'reserve-gymnastics-trial',
            heading: 'How to book a free gymnastics trial',
            description: 'Choose Gymnastics in the trial finder, enter your child’s age, and pick an available date. A parent or legal guardian must create or sign in to a family account, add the athlete’s details, and sign the waivers before the class is confirmed. Each athlete can use one free trial. No payment card is required.',
          },
        ],
        links: [{ ...FREE_TRIAL_ACTION, label: 'Find a gymnastics trial' }],
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
    title: 'Youth Fitness & Sports Performance Training in Bowie, MD | Vortex',
    description: 'Fit & Flip offers youth fitness and sports performance training in Bowie, MD. Beginners and young athletes build strength, power, and body control.',
    heading: 'Youth athletic training in Bowie, MD',
    intro: 'Fit & Flip is a coached fitness class for kids and teens. Athletes build strength, power, and body control through resistance work and gymnastics-inspired movement. Kids new to organized sports can start here, too.',
    image: '/fit-and-flip-card.webp',
    imageAlt: 'A Vortex athlete practicing aerial body control on a trampoline',
    imageWidth: 900,
    imageHeight: 675,
    primaryAction: { href: FIT_AND_FLIP_ENROLLMENT_HREF, label: 'Browse Fit & Flip classes', analyticsKey: 'browse_classes' },
    secondaryAction: FREE_TRIAL_ACTION,
    sections: [
      {
        id: 'athleticism-development',
        heading: 'Athleticism development through the Triad of Athleticism',
        description:
          'The Athleticism Accelerator is Vortex’s framework for developing eight qualities of movement. It covers strength, explosiveness, speed, agility, flexibility and mobility, balance, coordination, and body control. Fit & Flip organizes that work around the Triad. In a jump, strength creates force, explosiveness helps the athlete take off quickly, and body control helps them land in balance. Mobility and coordination help the athlete get into position and move smoothly through the jump.',
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
        topics: [
          {
            id: 'speed-agility',
            heading: 'Speed and agility for youth sports',
            description: 'Coaches can use short starts to practice the first few steps and stopping drills to teach athletes how to slow down with control. As athletes get comfortable, a coach might cue them to start toward a cone or change direction on the move.',
          },
        ],
      },
      {
        id: 'training-fit',
        heading: 'Youth fitness for beginners',
        description:
          'If your child is looking for a way to get active or build confidence with movement, start with the basics. A coach might use a bodyweight squat to practice lowering with control or a small jump to practice balancing on landing. As your child gets comfortable with the movement, the coach can give them a more challenging version.',
        topics: [
          {
            id: 'first-fit-flip-class',
            heading: 'Find a first class',
            description:
              'Fit & Flip’s 90-minute Cyclones classes are grouped by age, 8–11 and 12–15. Browse current class times or choose Fit & Flip in the free trial finder and enter your child’s age. Contact Vortex if no trial dates are available or your child falls outside those age groups.',
          },
        ],
        links: [
          { href: FIT_AND_FLIP_ENROLLMENT_HREF, label: 'See Fit & Flip class times', analyticsKey: 'browse_classes' },
          { ...FREE_TRIAL_ACTION, label: 'Look for a Fit & Flip trial' },
          { href: '/contact', label: 'Ask about class options', analyticsKey: 'inquire' },
          { href: ATHLETIC_DEVELOPMENT_GUIDE.path, label: 'Read the parent guide to athletic development', analyticsKey: 'read_athletic_development_guide' },
        ],
      },
    ],
    faqs: [
      { question: 'What is youth sports performance training?', answer: 'It is coached physical development that supports skills across sports. Fit & Flip combines strength work, explosive movement, and gymnastics-inspired body control so athletes practice creating and managing force.' },
      { question: 'Can my child start Fit & Flip without playing a sport?', answer: 'Yes. Kids who are new to organized sports can use Fit & Flip to build basic strength, coordination, and confidence with movement. Check the class age and experience level in the live catalog or try the free trial finder.' },
      { question: 'Does my athlete need to be a gymnast?', answer: 'Fit & Flip is open to athletes from a range of sports. Coaches use gymnastics-inspired exercises alongside strength and power work. Check the age and level for the class you are considering.' },
      { question: 'When should my child choose youth gymnastics instead?', answer: 'Start with youth gymnastics if the goal is to learn and progress in gymnastics skills. Choose Fit & Flip if the main goal is physical development for a sport or additional strength, power, and body control for tumbling.' },
    ],
    relatedPaths: ['/gymnastics', '/adult-gymnastics'],
  },
  '/adult-gymnastics': {
    name: 'Adult Gymnastics and Acrobatics',
    path: '/adult-gymnastics',
    title: 'Adult Gymnastics & Acrobatics in Bowie, MD | Vortex',
    description: 'Try Typhoons adult gymnastics and acrobatics in Bowie, MD. Beginners and returning gymnasts ages 18 and up can book a drop-in or enroll in recurring classes.',
    heading: 'Adult gymnastics and acrobatics in Bowie, MD',
    intro: 'Typhoons is Vortex’s fitness and acrobatics class for adults 18 and up. It combines strength, conditioning, and mobility with introductory acrobatics. Beginners and returning gymnasts are welcome.',
    image: '/gym-DSC02636-1600.webp',
    imageSrcSet: '/gym-DSC02636-768.webp 768w, /gym-DSC02636-1080.webp 1080w, /gym-DSC02636-1600.webp 1600w',
    imageAlt: 'Vortex Athletics gymnastics training area in Bowie, Maryland',
    imageWidth: 1600,
    imageHeight: 1066,
    primaryAction: { href: ADULT_BOOKING_HREF, label: 'See recurring class times', analyticsKey: 'browse_classes' },
    secondaryAction: { href: ADULT_DROP_IN_HREF, label: 'See Typhoons drop-in dates', analyticsKey: 'browse_drop_ins' },
    sections: [
      {
        id: 'class-format',
        heading: 'What to expect in Typhoons',
        description: 'This 90-minute, coach-led class pairs conditioning and mobility work with gymnastics and introductory acrobatics. Expect to practice supporting your body weight, balancing, and moving through a new range of motion.',
        topics: [
          { id: 'adult-beginners', heading: 'Starting from scratch', description: 'You can start without a gymnastics background. Tell the team what you would like to learn and ask about the starting progressions for your experience level.' },
          { id: 'returning-gymnasts', heading: 'Returning to gymnastics', description: 'If you are coming back after time away, share your training background and goals. A coach can help you identify where to restart and build toward more demanding skills.' },
        ],
      },
      {
        id: 'adult-availability',
        heading: 'Plan your first adult class',
        description: 'Reserve a drop-in to try one available Typhoons class. If you want a regular weekly class, check the recurring schedule and enroll. Contact Vortex if you have questions about what to bring or which starting level fits.',
        links: [
          { href: '/contact', label: 'Ask about Typhoons', analyticsKey: 'inquire' },
        ],
      },
    ],
    faqs: [
      { question: 'What age is the adult gymnastics class for?', answer: 'Typhoons is for adults ages 18 and up. Vortex has separate youth gymnastics pathways for kids and teens.' },
      { question: 'Can I join as a beginner?', answer: 'Yes. Typhoons welcomes adults without prior gymnastics experience. Contact Vortex if you would like help choosing your starting point.' },
      { question: 'Can I try one adult gymnastics class?', answer: 'Yes. Choose an available Typhoons drop-in date to reserve one coached class without a monthly enrollment. Availability depends on the date and remaining spots.' },
      { question: 'How do I enroll in recurring Typhoons classes?', answer: 'Choose See recurring class times to check the current schedule and begin enrollment. If there are no classes available online, contact Vortex for help.' },
    ],
    relatedPaths: ['/gymnastics', '/fit-and-flip'],
  },
}
