import type { Faq } from './faqs'
import { ATHLETIC_DEVELOPMENT_GUIDE } from './athleticDevelopmentGuide'
import { BOWIE_YOUTH_SPORTS_GUIDE } from './bowieYouthSportsGuide'
import { BUSINESS_FACILITY_PHOTO, CONTACT_INQUIRY_PATH } from './contact'
import { GYMNASTICS_VS_TUMBLING_GUIDE } from './gymnasticsVsTumblingGuide'
import { GYMNASTICS_CLASS_ATTIRE } from './gymnasticsFaqs'
import { PRESCHOOL_GYMNASTICS_GUIDE } from './preschoolGymnasticsGuide'
import searchPhotos from './publicSearchPhotos.json'
import trainingFilm from './publicTrainingVideo.json'
import { RETURNING_TO_GYMNASTICS_GUIDE } from './returningToGymnasticsGuide'
import type { FreeTrialProgram } from '../utils/freeTrialApi'
import {
  ADULT_BOOKING_HREF, ADULT_BOOKING_PROGRAM, ADULT_DROP_IN_HREF,
  DEVELOPMENTAL_GYMNASTICS_HREF, DEVELOPMENTAL_GYMNASTICS_PROGRAM,
  FIT_AND_FLIP_BOOKING_HREF, FIT_AND_FLIP_BOOKING_PROGRAM, FIT_AND_FLIP_DROP_IN_HREF,
  GYMNASTICS_TEAM_BOOKING_HREF,
  type RecurringBookingProgram,
} from '../utils/publicBookingPrograms'

export type PublicProgramPath = '/gymnastics' | '/fit-and-flip' | '/adult-gymnastics'

type ProgramAction = { href: string; label: string; analyticsKey: string }

type ProgramSection = {
  id: string
  heading: string
  description: string
  topics?: readonly { id: string; heading: string; description: string; link?: ProgramAction }[]
  links?: readonly ProgramAction[]
  trialLabel?: string
}

type PublicProgram = {
  name: string
  serviceType: string
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
  trial?: { program: FreeTrialProgram; label: string }
  recurringSchedule?: {
    id: string
    heading: string
    description?: string
    programName: RecurringBookingProgram
  }
  sections: readonly ProgramSection[]
  faqs: Faq[]
  relatedPaths: readonly PublicProgramPath[]
}

const GYMNASTICS_TRIAL_LABEL = 'Find a free gymnastics trial'
const GYMNASTICS_PRICING_ACTION = {
  href: '/gymnastics#youth-gymnastics-pricing',
  label: 'Compare youth gymnastics prices',
  analyticsKey: 'compare_youth_gymnastics_prices',
}
const FIT_AND_FLIP_TRIAL_LABEL = 'Find a free Fit & Flip trial'
const TUMBLING_GUIDE_ACTION = {
  href: GYMNASTICS_VS_TUMBLING_GUIDE.path,
  label: 'Compare gymnastics and tumbling for kids',
  analyticsKey: 'read_gymnastics_vs_tumbling_guide',
}

export const PUBLIC_PROGRAMS: Record<PublicProgramPath, PublicProgram> = {
  '/gymnastics': {
    name: 'Youth Gymnastics',
    serviceType: 'Youth gymnastics classes',
    path: '/gymnastics',
    title: 'Youth Gymnastics Classes in Bowie, MD | Vortex',
    description: 'Find youth gymnastics classes in Bowie, MD, from preschool and beginner classes to competitive team. Compare weekly times, prices, trials, and placement options.',
    heading: 'Youth gymnastics classes in Bowie, MD',
    intro: 'Find a place to start and room to grow. Vortex coaches teach kids and teens gymnastics skills alongside the strength, coordination, and body control to use them.',
    image: searchPhotos.youthGymnastics,
    imageSrcSet: '/gymnastics-hero-768.webp 768w, /gymnastics-hero-1080.webp 1080w, /gymnastics-hero.webp 1600w',
    imageAlt: 'Young gymnasts learning together with a coach at Vortex',
    imageWidth: 1600,
    imageHeight: 1200,
    primaryAction: { href: DEVELOPMENTAL_GYMNASTICS_HREF, label: 'Browse gymnastics classes', analyticsKey: 'browse_classes' },
    secondaryAction: GYMNASTICS_PRICING_ACTION,
    trial: { program: 'gymnastics', label: GYMNASTICS_TRIAL_LABEL },
    recurringSchedule: {
      id: 'youth-gymnastics-schedule',
      heading: 'Weekly youth gymnastics class schedule',
      description: 'Check weekly times and tuition for Dirt Devils (Mommy & Me), Twisters (preschool), Tornadoes, Cyclones, and Vortex A4 Elite. For a first visit, use the age and placement guidance below to find a free trial.',
      programName: DEVELOPMENTAL_GYMNASTICS_PROGRAM,
    },
    sections: [
      {
        id: 'choose-a-class',
        heading: 'Find the right starting class',
        description: 'The gymnastics trial finder uses your child’s age and experience to show the right type of class and its current openings.',
        topics: [
          {
            id: 'preschool',
            heading: 'Mommy & Me and preschool gymnastics',
            description:
              'In Dirt Devils, a parent or caregiver joins their child for coached movement and play. This Mommy & Me class is for ages 2–3, and children must be potty trained for a trial. ' +
              'In Twisters, preschoolers ages 4–5 practice balance, coordination, and basic gymnastics shapes through play.',
            link: {
              href: PRESCHOOL_GYMNASTICS_GUIDE.path,
              label: PRESCHOOL_GYMNASTICS_GUIDE.heading,
              analyticsKey: 'read_preschool_gymnastics_guide',
            },
          },
          { id: 'beginner', heading: 'Beginner gymnastics for ages 6–17', description: 'Kids and teens with no gymnastics experience start with a Tornadoes trial when available. Athletes learn body shapes and controlled landings as they work toward skills such as rolls, cartwheels, and handstands.' },
          {
            id: 'youth',
            heading: 'Developmental and team pathways',
            description: 'Athletes can build skills through developmental gymnastics or ask about an evaluation for the competitive team.',
            link: { href: '/gymnastics#competitive-gymnastics-team', label: 'Compare developmental and competitive gymnastics', analyticsKey: 'compare_gymnastics_pathways' },
          },
          {
            id: 'teen',
            heading: 'Gymnastics for teens and returning athletes',
            description: 'Teens can start gymnastics with no prior experience. If your child has taken classes before, check how Vortex coaches choose a starting level.',
            link: { href: '/gymnastics#class-placement', label: 'Find the right gymnastics level', analyticsKey: 'read_gymnastics_placement' },
          },
        ],
        links: [
          { href: '/gymnastics#first-visit', label: 'Prepare for your first visit', analyticsKey: 'read_first_visit' },
          { href: '/gymnastics#youth-gymnastics-schedule', label: 'See weekly gymnastics class times', analyticsKey: 'read_youth_gymnastics_schedule' },
        ],
      },
      {
        id: 'class-placement',
        heading: 'How do I know what gymnastics level my child is ready for?',
        description: 'A cartwheel gives your coach one skill to build on. Beginner Tornadoes teaches rolls, cartwheels, and handstands. Intermediate Cyclones in developmental gymnastics expects several foundations together, including forward and backward rolls, handstands, cartwheels, and round-offs.',
        topics: [
          {
            id: 'experienced-trial',
            heading: 'How to find a Trial Assessment',
            description: 'For a child ages 6–17 who has taken gymnastics before, enter their age and choose “Has gymnastics experience” to see available Trial Assessment dates.',
          },
          {
            id: 'assessment-preparation',
            heading: 'What to tell the coach',
            description: 'Tell the coach which skills your child can repeat comfortably, including skills they learned at home or in cheer or tumbling. The coach will assess what your child is ready to work on and recommend a starting group.',
          },
        ],
        trialLabel: 'Find a free Trial Assessment',
      },
      {
        id: 'competitive-gymnastics-team',
        heading: 'Competitive gymnastics team in Bowie',
        description: 'Vortex Gymnastics Team is listed for ages 6 and up. The team requires an evaluation for placement. If your child wants to compete, tell the coaches their age, current level, and the discipline they’re interested in.',
        topics: [
          {
            id: 'gymnastics-team-evaluation',
            heading: 'Ask about a team evaluation',
            description: 'Ask what the evaluation covers, which team placements are currently available, and what to bring. If your child trained or competed elsewhere, share their previous level and the skills they can repeat comfortably.',
            link: { href: CONTACT_INQUIRY_PATH, label: 'Contact Vortex about a team evaluation', analyticsKey: 'inquire_gymnastics_team_evaluation' },
          },
          {
            id: 'gymnastics-team-commitment',
            heading: 'Review the team commitment',
            description: 'Ask how often athletes practice, which meets they attend, and what to budget for beyond class tuition. After placement, see the current team class times in enrollment.',
            link: { href: GYMNASTICS_TEAM_BOOKING_HREF, label: 'View team practice times', analyticsKey: 'browse_gymnastics_team_schedule' },
          },
          {
            id: 'advanced-developmental-gymnastics',
            heading: 'Advanced developmental gymnastics',
            description: 'Gymnasts can work toward advanced skills in developmental classes such as Vortex A4 Elite and train without entering meets. A developmental Trial Assessment helps coaches recommend a starting class for experienced athletes.',
            link: { href: '/gymnastics#class-placement', label: 'Find a developmental Trial Assessment', analyticsKey: 'read_gymnastics_placement' },
          },
        ],
      },
      {
        id: 'first-visit',
        heading: 'What to expect at your child’s first gymnastics class',
        description: 'A trial lets your child meet the coaches and try a class matched to their age and experience at our Bowie gym.',
        trialLabel: GYMNASTICS_TRIAL_LABEL,
        topics: [
          { id: 'gymnastics-attire', heading: GYMNASTICS_CLASS_ATTIRE.question, description: GYMNASTICS_CLASS_ATTIRE.answer },
          {
            id: 'gymnastics-trial-length',
            heading: 'How long is the trial class?',
            description: 'Plan for about 60 minutes for Dirt Devils (ages 2–3), Twisters (ages 4–5), or a Trial Assessment for an experienced athlete ages 6–17. Beginner Tornadoes trials for ages 6–17 last about 90 minutes. Check the exact start and end times when you choose a date.',
          },
          {
            id: 'reserve-gymnastics-trial',
            heading: 'How to book a free gymnastics trial',
            description: 'Enter your child’s age in the trial finder and pick an available date. A parent or legal guardian must create or sign in to a family account, add the athlete’s details, and sign the waivers before the class is confirmed. Each athlete can use one free trial. No payment card is required.',
          },
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
          {
            id: 'trampoline-tumbling',
            heading: 'Trampoline and tumbling',
            description: 'Athletes work on rebounds, aerial awareness, and floor tumbling with a focus on control through the landing.',
            link: TUMBLING_GUIDE_ACTION,
          },
        ],
        links: [{ href: trainingFilm.path, label: 'Watch gymnastics and athletic training at Vortex', analyticsKey: 'watch_training_film' }],
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
      { question: 'How do I ask about competitive team placement?', answer: 'Contact Vortex with your child’s age, current level, and discipline of interest. The Vortex Gymnastics Team is listed for ages 6 and up and requires an evaluation for placement.' },
      { question: 'How do I choose a gymnastics class?', answer: 'For a first visit, enter your child’s age and experience in the gymnastics trial finder. You can also browse the live class catalog or contact Vortex if you have a placement question.' },
      { question: 'How much do youth gymnastics classes cost?', answer: 'Monthly tuition depends on the class and schedule you choose. The price comparison shows current tuition and nonmember drop-in prices. Paid monthly enrollment requires an active annual membership for the athlete. A drop-in is for one class, and eligible athletes can book one free trial.' },
    ],
    relatedPaths: ['/fit-and-flip', '/adult-gymnastics'],
  },
  '/fit-and-flip': {
    name: 'Fit & Flip Youth Athletic Training',
    serviceType: 'Youth fitness and sports performance training',
    path: '/fit-and-flip',
    title: 'Youth Fitness & Sports Performance Training in Bowie, MD | Vortex',
    description: 'Fit & Flip offers coached youth fitness, strength training, and tumbling in Bowie, MD. Compare Cyclones prices, weekly times, and trials for ages 8–15.',
    heading: 'Youth athletic training in Bowie, MD',
    intro: 'Fit & Flip is a coached fitness class for ages 8–15. Athletes build strength, power, and body control through resistance work and gymnastics-inspired movement. Kids new to organized sports can start here, too.',
    image: searchPhotos.fitAndFlip,
    imageAlt: 'A Vortex athlete practicing aerial body control on a trampoline',
    imageWidth: 900,
    imageHeight: 675,
    primaryAction: { href: FIT_AND_FLIP_BOOKING_HREF, label: 'Browse Fit & Flip classes', analyticsKey: 'browse_classes' },
    trial: { program: 'fit-flip', label: FIT_AND_FLIP_TRIAL_LABEL },
    recurringSchedule: {
      id: 'fit-flip-schedule',
      heading: 'Recurring Fit & Flip class times',
      description: 'Check weekly Cyclones times for ages 8–11 and 12–15. Enrollment shows available spots and start dates.',
      programName: FIT_AND_FLIP_BOOKING_PROGRAM,
    },
    sections: [
      {
        id: 'athleticism-development',
        heading: 'Athleticism development through the Triad of Athleticism',
        description:
          'The Athleticism Accelerator is Vortex’s framework for developing eight qualities of movement. It covers strength, explosiveness, speed, agility, flexibility and mobility, balance, coordination, and body control. Fit & Flip organizes that work around the Triad. In a jump, strength creates force, explosiveness helps the athlete take off quickly, and body control helps them land in balance. Mobility and coordination help the athlete get into position and move smoothly through the jump.',
        topics: [
          {
            id: 'strength',
            heading: 'Youth strength training',
            description: 'Coaches teach kids to squat, hinge at the hips, push, and pull. These patterns help athletes support their body weight in gymnastics and control their position when they change direction in sports.',
            link: {
              href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#strength-training-readiness`,
              label: 'When kids are ready for strength training',
              analyticsKey: 'read_youth_strength_readiness',
            },
          },
          { id: 'explosiveness', heading: 'Explosiveness', description: 'Jumps, takeoffs, and dynamic movement teach athletes to produce force quickly. That carries over to a first step on the field or a stronger takeoff in cheer and tumbling.' },
          {
            id: 'body-control',
            heading: 'Body control and tumbling',
            description: 'Coaches use trampolines and tumble tracks to teach athletes how to hold a body shape and land steadily. Beginners can start with those skills and work toward connected tumbling as their control improves.',
            link: TUMBLING_GUIDE_ACTION,
          },
        ],
      },
      {
        id: 'fit-flip-class-example',
        heading: 'What happens in a Fit & Flip class?',
        description: 'In a 90-minute Cyclones class, coaches combine strength work, jumps, and gymnastics-inspired body control. Here’s how a coach might connect those activities around one goal: landing steadily on two feet.',
        topics: [
          { id: 'landing-rehearsal', heading: 'Rehearse the landing', description: 'A coach can show how to settle into a balanced landing position and pause there. Practicing it on the floor gives a beginner time to find their balance before adding a jump.' },
          { id: 'strength-practice', heading: 'Build strength for the same movement', description: 'A bodyweight squat lets an athlete practice lowering and standing with control. When they can repeat the movement consistently, the coach can decide whether light resistance is appropriate.' },
          { id: 'jump-practice', heading: 'Apply it to a jump', description: 'The coach might ask the athlete to land and hold their balance after a small two-foot jump. A steady finish gives the coach something to check before changing the height or difficulty.' },
        ],
        links: [{ href: trainingFilm.path, label: 'Watch strength and movement training at Vortex', analyticsKey: 'watch_training_film' }],
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
        links: [
          { href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#movement-progression`, label: 'See how coaches build speed and agility', analyticsKey: 'read_movement_progression' },
          { href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#progress`, label: 'See how coaches check athletic progress', analyticsKey: 'read_athletic_progress' },
          { href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#sports-season`, label: 'Fit training around practices and games', analyticsKey: 'read_youth_sports_training_schedule' },
          { href: `${BOWIE_YOUTH_SPORTS_GUIDE.path}#compare-athletic-training`, label: 'Compare youth athletic training in Bowie', analyticsKey: 'read_bowie_youth_sports_guide' },
        ],
      },
      {
        id: 'training-fit',
        heading: 'Youth fitness for beginners',
        description: 'New to training? Tell the coach which activities your child enjoys and what they want to try. Two athletes in the same age group can practice different versions of a movement based on what each can repeat with control.',
        trialLabel: FIT_AND_FLIP_TRIAL_LABEL,
        topics: [
          {
            id: 'first-fit-flip-class',
            heading: 'Find a first class',
            description:
              'Beginners can try a regular 90-minute Cyclones class without prior sports or gymnastics experience. Choose an available trial or drop-in date, or browse recurring classes for a weekly option.',
            link: { href: '/fit-and-flip#fit-flip-class-pricing', label: 'Compare monthly and drop-in prices', analyticsKey: 'compare_fit_flip_class_prices' },
          },
          {
            id: 'fit-flip-trial-age',
            heading: 'Which Cyclones age group should I choose?',
            description: 'Use your child’s age on the class date. An 11-year-old who will have turned 12 by the date they attend belongs in the 12–15 group. Contact Vortex for options outside the 8–15 age range.',
          },
          {
            id: 'book-fit-flip-trial',
            heading: 'How do I book a free Fit & Flip trial?',
            description: 'Enter your child’s age and choose an available date. A parent or legal guardian creates or signs in to a family account, adds the athlete’s details, and signs the waivers. Eligible athletes get one free trial, and no payment card is required.',
          },
        ],
        links: [
          { href: FIT_AND_FLIP_BOOKING_HREF, label: 'See recurring Fit & Flip classes', analyticsKey: 'browse_classes' },
          { href: FIT_AND_FLIP_DROP_IN_HREF, label: 'See Fit & Flip drop-in dates', analyticsKey: 'browse_drop_ins' },
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
    serviceType: 'Adult gymnastics and acrobatics classes',
    path: '/adult-gymnastics',
    title: 'Adult Gymnastics Classes in Bowie, MD | Vortex',
    description: 'Try beginner-friendly adult gymnastics in Bowie, MD. See Typhoons class times, what to expect on your first visit, and monthly or drop-in prices.',
    heading: 'Adult gymnastics and acrobatics in Bowie, MD',
    intro: 'Typhoons is a 90-minute, coach-led gymnastics and acrobatics class for ages 18 and up. Beginners and returning gymnasts can book one drop-in or enroll in a recurring class.',
    image: BUSINESS_FACILITY_PHOTO.src,
    imageSrcSet: BUSINESS_FACILITY_PHOTO.srcSet,
    imageAlt: BUSINESS_FACILITY_PHOTO.alt,
    imageWidth: BUSINESS_FACILITY_PHOTO.width,
    imageHeight: BUSINESS_FACILITY_PHOTO.height,
    primaryAction: { href: ADULT_BOOKING_HREF, label: 'See recurring class times', analyticsKey: 'browse_classes' },
    secondaryAction: { href: ADULT_DROP_IN_HREF, label: 'See Typhoons drop-in dates', analyticsKey: 'browse_drop_ins' },
    recurringSchedule: {
      id: 'adult-class-schedule',
      heading: 'Recurring adult gymnastics class times',
      programName: ADULT_BOOKING_PROGRAM,
    },
    sections: [
      {
        id: 'class-format',
        heading: 'What to expect in an adult gymnastics class',
        description: 'Typhoons pairs strength, conditioning, and mobility with introductory acrobatics. Beginners and returning gymnasts can join the same coach-led class and work on movements that fit their starting points.',
        topics: [
          {
            id: 'adult-beginners',
            heading: 'Can I start adult gymnastics with no experience?',
            description: 'Yes. You can come to Typhoons without a handstand, cartwheel, or splits. Tell your coach it’s your first class and mention something you’d like to try, such as practicing balance or working toward a handstand. If you’re unsure, ask the coach for one movement to start with.',
          },
          {
            id: 'adult-handstand-preparation',
            heading: 'What a first step toward a handstand could look like',
            description: 'A coach might start you in a supported position so you can practice putting some weight through your hands while keeping your feet on the floor. They can help you find a version you can hold steadily and explain what to look for before moving on.',
          },
          {
            id: 'returning-gymnasts',
            heading: 'Returning to gymnastics',
            description: 'Tell your coach what you used to practice and what you’d like to work toward now. Start with movements you can repeat comfortably and ask what to practice before revisiting a previous skill.',
            link: {
              href: RETURNING_TO_GYMNASTICS_GUIDE.path,
              label: 'Read the guide to returning as an adult',
              analyticsKey: 'read_returning_to_gymnastics_guide',
            },
          },
        ],
        links: [
          { href: '/adult-gymnastics#adult-availability', label: 'Plan your first Typhoons class', analyticsKey: 'read_adult_first_visit' },
          { href: `${RETURNING_TO_GYMNASTICS_GUIDE.path}#nearby-adult-gymnastics`, label: 'Compare adult classes and open gym near Bowie', analyticsKey: 'compare_adult_gymnastics_formats' },
        ],
      },
      {
        id: 'adult-availability',
        heading: 'Plan your first adult gymnastics class',
        description: 'Choose an available Typhoons drop-in date. The booking list shows the class time, nonmember price, remaining spots, and whether the date accepts free trials.',
        topics: [
          { id: 'adult-registration', heading: 'Register yourself and sign your waiver', description: 'Sign in or create an account, select yourself as the participant, and complete any waiver requested during booking. Review your total before confirming.' },
          { id: 'adult-what-to-bring', heading: 'What to bring', description: 'Bring water and wear comfortable clothes you can move in. Ask Vortex before your visit if you have questions about footwear or what to bring.' },
        ],
        links: [
          { href: ADULT_DROP_IN_HREF, label: 'Check Typhoons dates and prices', analyticsKey: 'browse_drop_ins' },
          { href: '/contact', label: 'Ask about Typhoons', analyticsKey: 'inquire' },
        ],
      },
    ],
    faqs: [
      { question: 'What age is the adult gymnastics class for?', answer: 'Typhoons is for adults ages 18 and up. Vortex has separate youth gymnastics pathways for kids and teens.' },
      { question: 'Can I join as a beginner?', answer: 'Yes. Typhoons welcomes adults without prior gymnastics experience. Contact Vortex if you would like help choosing your starting point.' },
      { question: 'Can I try one adult gymnastics class?', answer: 'Yes. Choose an available Typhoons drop-in date to reserve one coached class without a monthly enrollment. Availability depends on the date and remaining spots.' },
      { question: 'Can I try adult gymnastics for free?', answer: 'Look for “Accepts free trials” on Typhoons dates. You can apply an unused one-time free trial during registration and review your total before confirming. Annual membership is optional for a free trial.' },
      { question: 'How do I enroll in recurring Typhoons classes?', answer: 'Choose See recurring class times to check the current schedule and begin enrollment. If there are no classes available online, contact Vortex for help.' },
    ],
    relatedPaths: ['/gymnastics', '/fit-and-flip'],
  },
}
