import type { Faq } from './faqs'
import { ATHLETIC_DEVELOPMENT_GUIDE } from './athleticDevelopmentGuide'
import { BOWIE_YOUTH_SPORTS_GUIDE } from './bowieYouthSportsGuide'
import { BUSINESS_FACILITY_PHOTO, contactInquiryHref, CONTACT_INQUIRY_PATH, GYMNASTICS_EQUIPMENT_PATH } from './contact'
import { FIT_AND_FLIP_PUBLIC_COPY } from './fitAndFlipCopy'
import { GYMNASTICS_TEAM_PUBLIC_DESCRIPTION } from './publicCatalog'
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

type ProgramTopic = {
  id: string
  heading: string
  description: string
  link?: ProgramAction
  links?: readonly ProgramAction[]
}

type ProgramSection = {
  id: string
  heading: string
  description: string
  topics?: readonly ProgramTopic[]
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
  imageAvifSrcSet?: string
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
    description: 'Explore preschool, recreational, and competitive youth gymnastics in Bowie, MD. Compare class levels, weekly schedules, prices, and free trial options.',
    heading: 'Youth gymnastics classes in Bowie, MD',
    intro: 'Find a place to start and room to grow. Vortex coaches teach kids and teens gymnastics skills alongside the strength, coordination, and body control to use them.',
    image: searchPhotos.youthGymnastics,
    imageSrcSet: '/gymnastics-hero-768.webp 768w, /gymnastics-hero-1080.webp 1080w, /gymnastics-hero.webp 1600w',
    imageAvifSrcSet: '/gymnastics-hero-768.avif 768w, /gymnastics-hero-1080.avif 1080w, /gymnastics-hero-1600.avif 1600w',
    imageAlt: 'Young gymnasts learning together with a coach at Vortex',
    imageWidth: 1600,
    imageHeight: 1200,
    primaryAction: { href: DEVELOPMENTAL_GYMNASTICS_HREF, label: 'Browse gymnastics classes', analyticsKey: 'browse_classes' },
    secondaryAction: GYMNASTICS_PRICING_ACTION,
    trial: { program: 'gymnastics', label: GYMNASTICS_TRIAL_LABEL },
    recurringSchedule: {
      id: 'youth-gymnastics-schedule',
      heading: 'Weekly youth gymnastics class schedule',
      description: 'Check weekly times and tuition for Dirt Devils (Mommy & Me), Twisters (preschool), Tornadoes, Cyclones, and Vortex A4 Elite. Open a class to see its times and published skill requirements. Use the placement guidance below to choose a first visit.',
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
              'In Twisters, preschoolers ages 4–5 practice balance, coordination, and basic gymnastics shapes through play. ' +
              'Use your child’s age on the day of the trial to choose a class.',
            link: {
              href: PRESCHOOL_GYMNASTICS_GUIDE.path,
              label: PRESCHOOL_GYMNASTICS_GUIDE.heading,
              analyticsKey: 'read_preschool_gymnastics_guide',
            },
          },
          { id: 'beginner', heading: 'Beginner gymnastics for ages 6–17', description: 'Kids and teens with no gymnastics experience start with a Tornadoes trial when available. Athletes learn body shapes and controlled landings as they work toward skills such as rolls, cartwheels, and handstands.' },
          {
            id: 'youth',
            heading: 'Gymnastics classes for ages 6–12',
            description: 'Start with a Tornadoes beginner class if your child is new to gymnastics. If they’ve taken gymnastics before, start with a Trial Assessment so the coach can find the right class for the skills they can repeat.',
            links: [
              { href: '/gymnastics#youth-gymnastics-schedule', label: 'See weekly Tornadoes class times', analyticsKey: 'read_youth_gymnastics_schedule' },
              { href: '/gymnastics#experienced-trial', label: 'Find a Trial Assessment for an experienced gymnast', analyticsKey: 'read_gymnastics_placement' },
              { href: '/gymnastics#competitive-gymnastics-team', label: 'Compare developmental and competitive gymnastics', analyticsKey: 'compare_gymnastics_pathways' },
            ],
          },
          {
            id: 'teen',
            heading: 'Gymnastics for teens and returning athletes',
            description: 'Teens can start gymnastics with no prior experience. If your child has taken classes before, check how Vortex coaches choose a starting level. Gymnasts ages 18 and up can look for a Typhoons date that accepts free trials.',
            links: [
              { href: `${GYMNASTICS_VS_TUMBLING_GUIDE.path}#teen-gymnastics-options`, label: 'Compare local gymnastics and tumbling options for teens', analyticsKey: 'read_teen_gymnastics_options' },
              { href: '/gymnastics#class-placement', label: 'Find the right gymnastics level', analyticsKey: 'read_gymnastics_placement' },
              { href: '/adult-gymnastics#adult-availability', label: 'See Typhoons adult gymnastics trials', analyticsKey: 'read_adult_first_visit' },
            ],
          },
        ],
        links: [
          { href: '/gymnastics#class-placement', label: 'Compare recreational gymnastics levels', analyticsKey: 'read_gymnastics_placement' },
          { href: '/gymnastics#first-visit', label: 'Prepare for your first visit', analyticsKey: 'read_first_visit' },
          { href: '/gymnastics#youth-gymnastics-schedule', label: 'See weekly gymnastics class times', analyticsKey: 'read_youth_gymnastics_schedule' },
        ],
      },
      {
        id: 'class-placement',
        heading: 'Recreational gymnastics levels and placement',
        description: 'Vortex calls its recreational classes for ages 6 and up Developmental Gymnastics. Kids and teens can progress from beginner to advanced classes without entering meets. If your child has trained before, a Trial Assessment helps the coach choose a class based on the skills your child can repeat with control.',
        topics: [
          {
            id: 'gymnastics-level-beginner',
            heading: 'Beginner Tornadoes',
            description: 'Start here with no gymnastics experience. Coaches teach body shapes, rolls, cartwheels, handstands, and controlled landings. First-time gymnasts ages 6–17 can look for a Tornadoes trial.',
          },
          {
            id: 'gymnastics-level-intermediate',
            heading: 'Intermediate Cyclones',
            description: 'Coaches look for forward and backward rolls, a handstand, a cartwheel, a round-off, a front limber, and a kickover from a bridge. They also check split readiness. A cartwheel gives the coach one skill to build on as they check the rest.',
            link: { href: '/fit-and-flip#compare-cyclones-classes', label: 'Compare both Cyclones programs', analyticsKey: 'compare_cyclones_programs' },
          },
          {
            id: 'gymnastics-level-advanced',
            heading: 'Advanced Vortex A4 Elite',
            description: 'Athletes build on the Cyclones skills. Coaches also look for a front or back handspring and a full split. Gymnasts in this developmental class can keep progressing without joining the competitive team.',
            links: [
              { href: '/gymnastics#competitive-gymnastics-team', label: 'Compare advanced classes and team placement', analyticsKey: 'compare_gymnastics_pathways' },
              { href: `${GYMNASTICS_VS_TUMBLING_GUIDE.path}#handspring-class-placement`, label: 'Compare classes for a first back handspring', analyticsKey: 'read_handspring_class_placement' },
            ],
          },
          {
            id: 'experienced-trial',
            heading: 'How to find a Trial Assessment',
            description: 'For a child ages 6–17 who has taken gymnastics before, enter their age and choose “Has gymnastics experience” to see available Trial Assessment dates.',
          },
          {
            id: 'assessment-preparation',
            heading: 'What to tell the coach',
            description: 'Tell the coach which skills your child can repeat comfortably, including skills from cheer or tumbling. For a cartwheel, a coach might watch the order of the hands, how the athlete supports their weight, and whether they can finish in balance.',
          },
          {
            id: 'gymnastics-progress',
            heading: 'How to follow your child’s gymnastics progress',
            description: 'When a coach publishes an evaluation for your child, sign in to your linked Vortex account and open Progress. Under Gymnastics Evaluation Reports, you can see your child’s strengths, what to practice next, and any note the coach included. Ask your coach which skills your child should be able to repeat before moving up.',
          },
        ],
        trialLabel: 'Find a free Trial Assessment',
      },
      {
        id: 'trampoline-tumbling',
        heading: 'Tumbling and trampoline training in Bowie',
        description: 'At Vortex, developmental gymnastics teaches floor tumbling. Fit & Flip combines trampoline and tumble-track drills with strength and conditioning. For a specific goal such as double mini or power tumbling, ask our team about coaching options.',
        topics: [
          {
            id: 'beginner-floor-tumbling',
            heading: 'Learn floor tumbling in Tornadoes',
            description: 'Beginners practice rolls, cartwheels, round-offs, and controlled landings in this developmental gymnastics class. First-time gymnasts ages 6–17 can look for a Tornadoes trial.',
            links: [
              { href: '/gymnastics#youth-gymnastics-schedule', label: 'Check Tornadoes class times and prices', analyticsKey: 'read_youth_gymnastics_schedule' },
              { href: '/gymnastics#open-free-trial', label: 'Find a Tornadoes trial', analyticsKey: 'free_trial_section' },
            ],
          },
          {
            id: 'experienced-floor-tumbling',
            heading: 'Find a level for an experienced tumbler',
            description: 'For youth ages 6–17 who have trained before, a Trial Assessment helps the coach choose a developmental level. Tell the coach what your child can do independently, including skills learned in cheer or tumbling.',
            link: { href: '/gymnastics#open-free-trial-class-placement', label: 'Look for a Trial Assessment', analyticsKey: 'free_trial_section' },
          },
          {
            id: 'fit-flip-trampoline',
            heading: 'Practice trampoline skills in Fit & Flip',
            description: 'Fit & Flip Cyclones uses trampoline and tumble-track drills to practice takeoffs, landings, and body control. Check class times for ages 8–11 or 12–15.',
            links: [
              { href: '/fit-and-flip#fit-flip-schedule', label: 'Check Fit & Flip class times', analyticsKey: 'read_fit_flip_schedule' },
              { href: '/fit-and-flip#body-control', label: 'See trampoline and tumbling in Fit & Flip', analyticsKey: 'read_fit_flip_body_control' },
            ],
          },
        ],
        links: [
          { href: contactInquiryHref('trampoline-tumbling'), label: 'Ask about trampoline and tumbling coaching', analyticsKey: 'inquire_trampoline_gymnastics' },
          { ...TUMBLING_GUIDE_ACTION, href: `${GYMNASTICS_VS_TUMBLING_GUIDE.path}#nearby-tumbling-classes`, label: 'Compare tumbling classes near Bowie' },
          { href: `${GYMNASTICS_VS_TUMBLING_GUIDE.path}#nearby-trampoline-gymnastics`, label: 'Compare coached trampoline gymnastics near Bowie', analyticsKey: 'read_trampoline_gymnastics_guide' },
        ],
      },
      {
        id: 'competitive-gymnastics-team',
        heading: 'Competitive gymnastics team in Bowie',
        description: GYMNASTICS_TEAM_PUBLIC_DESCRIPTION,
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
          {
            id: 'full-gymnastics-dates',
            heading: 'What if the gymnastics class is full?',
            description: 'Check other days in the trial finder. If all trial times are full, ask our team about another first visit. For monthly enrollment, check the class listing for waitlist options.',
            links: [
              { href: CONTACT_INQUIRY_PATH, label: 'Ask about another trial date', analyticsKey: 'ask_about_trial' },
              { href: DEVELOPMENTAL_GYMNASTICS_HREF, label: 'Check monthly enrollment and waitlist options', analyticsKey: 'browse_classes' },
            ],
          },
          {
            id: 'gymnastics-class-access',
            heading: 'Questions about class access or participation?',
            description: 'If you have questions about the space, noise levels, or how your child would take part, ask our team before booking a trial.',
            links: [
              { href: CONTACT_INQUIRY_PATH, label: 'Ask Vortex about class access or participation', analyticsKey: 'ask_vortex_gymnastics_access' },
              { href: `${GYMNASTICS_VS_TUMBLING_GUIDE.path}#accessible-gymnastics`, label: 'Compare adaptive and accessible gymnastics near Bowie', analyticsKey: 'read_gymnastics_vs_tumbling' },
            ],
          },
        ],
      },
      {
        id: 'disciplines',
        heading: 'Gymnastics disciplines',
        description: 'Developmental gymnastics builds foundations shared across disciplines. Classes are listed by age and skill level. For a specific discipline or team evaluation, tell Vortex what your child wants to work on.',
        topics: [
          {
            id: 'artistic',
            heading: 'Artistic gymnastics',
            description: 'Floor skills and apparatus work develop strength, balance, swings, and controlled landings. Beginners ages 6–17 can start in Tornadoes. Gymnasts with experience can try a developmental Trial Assessment to find their starting level.',
            links: [
              { href: '/gymnastics#choose-a-class', label: 'Find a starting gymnastics class', analyticsKey: 'read_gymnastics_placement' },
              { ...TUMBLING_GUIDE_ACTION, href: `${GYMNASTICS_VS_TUMBLING_GUIDE.path}#boys-gymnastics`, label: 'Compare boys’ gymnastics and apparatus classes' },
            ],
          },
          {
            id: 'rhythmic',
            heading: 'Rhythmic gymnastics',
            description: 'Rhythmic routines combine dance and balance with hand apparatus such as a hoop or ribbon. Tell us which apparatus your child wants to use and what experience they have so we can check coaching and evaluation options.',
            link: { href: contactInquiryHref('rhythmic-gymnastics'), label: 'Ask about rhythmic gymnastics coaching', analyticsKey: 'inquire_rhythmic_gymnastics' },
          },
          {
            id: 'acro',
            heading: 'Acrobatic gymnastics',
            description: 'Pairs and groups practice partner balances and dynamic skills. Tell us what gymnastics or partner work your child has done and which skills they can repeat so we can check coaching and evaluation options.',
            link: { href: contactInquiryHref('acrobatic-gymnastics'), label: 'Ask about partner and group acro', analyticsKey: 'inquire_acrobatic_gymnastics' },
          },
          {
            id: 'aerobic',
            heading: 'Aerobic gymnastics',
            description: 'Aerobic routines combine continuous movement to music with jumps, balance, and strength. Tell us whether your child wants to learn a routine or compete so we can check which options are available.',
            link: { href: contactInquiryHref('aerobic-gymnastics'), label: 'Ask about aerobic gymnastics routines', analyticsKey: 'inquire_aerobic_gymnastics' },
          },
        ],
        links: [
          { href: '/gymnastics#trampoline-tumbling', label: 'See tumbling and trampoline training options', analyticsKey: 'read_trampoline_tumbling_options' },
          { href: GYMNASTICS_EQUIPMENT_PATH, label: 'See Vortex’s practice beams and training rings', analyticsKey: 'see_inside_the_gym' },
          { href: trainingFilm.path, label: 'Watch gymnastics and athletic training at Vortex', analyticsKey: 'watch_training_film' },
        ],
      },
      {
        id: 'homeschool',
        heading: 'Gymnastics for homeschool families',
        description: 'Use our regular class schedule to find gymnastics that fits your homeschool week. For daytime classes or group PE, see which nearby programs enroll individual children and which work with homeschool groups.',
        links: [
          { href: '/gymnastics#youth-gymnastics-schedule', label: 'Check weekly youth gymnastics times', analyticsKey: 'view_youth_gymnastics_schedule' },
          { href: `${BOWIE_YOUTH_SPORTS_GUIDE.path}#homeschool-pe`, label: 'Compare homeschool gymnastics and PE near Bowie', analyticsKey: 'read_bowie_youth_sports_guide' },
        ],
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
    ...FIT_AND_FLIP_PUBLIC_COPY,
    name: 'Fit & Flip Youth Athletic Training',
    path: '/fit-and-flip',
    title: 'Youth Fitness & Sports Performance Training in Bowie, MD | Vortex',
    image: searchPhotos.fitAndFlip,
    imageSrcSet: searchPhotos.fitAndFlipSrcSet,
    imageAlt: 'A Vortex athlete practicing aerial body control on a trampoline',
    imageWidth: 900,
    imageHeight: 675,
    primaryAction: { href: FIT_AND_FLIP_BOOKING_HREF, label: 'Browse Fit & Flip classes', analyticsKey: 'browse_classes' },
    trial: { program: 'fit-flip', label: FIT_AND_FLIP_TRIAL_LABEL },
    recurringSchedule: {
      id: 'fit-flip-schedule',
      heading: 'Recurring Fit & Flip class times',
      description: 'Check weekly Cyclones times for ages 8–11 and 12–15. The schedule lists the days offered for each age group. Choose a recurring weekday during enrollment, where you can check spots and start dates.',
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
            id: 'apply-athleticism-accelerator',
            heading: 'Practice the Athleticism Accelerator in Fit & Flip',
            description: 'Fit & Flip Cyclones brings the framework into a 90-minute group class. Choose the group for ages 8–11 or 12–15, then check its weekly times or try one class.',
            links: [
              { href: '/fit-and-flip#fit-flip-schedule', label: 'See weekly Fit & Flip class times', analyticsKey: 'read_fit_flip_schedule' },
              { href: '/fit-and-flip#training-fit', label: 'See how to try a Fit & Flip class', analyticsKey: 'read_fit_flip_first_class' },
            ],
          },
          {
            id: 'strength',
            heading: 'Youth strength training',
            description: 'Coaches teach kids to squat, hinge at the hips, push, and pull. These patterns help athletes support their body weight in gymnastics and control their position when they change direction in sports.',
            link: {
              href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#strength-training-readiness`,
              label: 'See how kids progress from bodyweight to light resistance',
              analyticsKey: 'read_youth_strength_readiness',
            },
          },
          {
            id: 'explosiveness',
            heading: 'Youth plyometrics and explosive movement',
            description: 'Plyometrics help young athletes practice producing force quickly. A coach may begin with a small jump and a held landing. Once the athlete can repeat it with control, the coach can add a small rebound. Athletes can use that quick push-off in a first step on the field or a takeoff in cheer and tumbling.',
            link: {
              href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#youth-plyometrics`,
              label: 'See how coaches introduce youth plyometrics',
              analyticsKey: 'read_youth_plyometrics_guide',
            },
          },
          {
            id: 'body-control',
            heading: 'Body control and tumbling',
            description: 'Coaches use trampolines and tumble tracks to teach athletes how to hold a body shape and land steadily. Beginners can start with those skills and work toward connected tumbling as their control improves.',
            links: [
              { href: '/fit-and-flip#fit-flip-schedule', label: 'Check Fit & Flip class times and prices', analyticsKey: 'read_fit_flip_schedule' },
              TUMBLING_GUIDE_ACTION,
            ],
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
        links: [
          { href: trainingFilm.path, label: 'Watch strength and movement training at Vortex', analyticsKey: 'watch_training_film' },
          { href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#balance-during-a-growth-spurt`, label: 'See how coaches can adapt a landing during a growth spurt', analyticsKey: 'read_youth_growth_spurt_balance' },
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
            links: [
              { href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#speed-vs-agility`, label: 'Compare sprint starts, planned turns, and reacting', analyticsKey: 'read_speed_and_agility_guide' },
              { href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#soccer-speed-and-agility`, label: 'See how speed and agility fit youth soccer', analyticsKey: 'read_youth_soccer_speed_and_agility' },
            ],
          },
          {
            id: 'conditioning',
            heading: 'Youth conditioning for sports',
            description: 'Conditioning helps athletes keep moving well as a practice or game goes on. A coach can adjust the work and recovery if an athlete loses control when they land or slow down. Tell the coach about your child’s practices and games so the extra training fits their week.',
            link: {
              href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#sports-season`,
              label: 'Fit training around practices and games',
              analyticsKey: 'read_youth_sports_training_schedule',
            },
          },
        ],
        links: [
          { href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#movement-progression`, label: 'See how coaches build speed and agility', analyticsKey: 'read_movement_progression' },
          { href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#progress`, label: 'See how coaches check athletic progress', analyticsKey: 'read_athletic_progress' },
          { href: `${BOWIE_YOUTH_SPORTS_GUIDE.path}#compare-athletic-training`, label: 'Compare youth athletic training in Bowie', analyticsKey: 'read_bowie_youth_sports_guide' },
          { href: `${BOWIE_YOUTH_SPORTS_GUIDE.path}#youth-team-training`, label: 'Find training for a whole youth team', analyticsKey: 'read_youth_team_training' },
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
            links: [
              { href: '/fit-and-flip#fit-flip-class-pricing', label: 'Compare monthly and drop-in prices', analyticsKey: 'compare_fit_flip_class_prices' },
              { href: `${ATHLETIC_DEVELOPMENT_GUIDE.path}#youth-performance-assessment`, label: 'Compare a trial class with a youth performance assessment', analyticsKey: 'compare_youth_performance_assessment' },
            ],
          },
          {
            id: 'compare-cyclones-classes',
            heading: 'Which Cyclones class should I choose?',
            description: 'Fit & Flip Cyclones welcomes beginners ages 8–11 and 12–15 for strength, jumps, and body control. Developmental gymnastics Cyclones is the intermediate level for gymnasts who can already demonstrate the entry skills with control.',
            link: { href: '/gymnastics#gymnastics-level-intermediate', label: 'Check the intermediate gymnastics Cyclones skills', analyticsKey: 'read_gymnastics_placement' },
          },
          {
            id: 'fit-flip-trial-age',
            heading: 'Which Cyclones age group should I choose?',
            description: 'Use your child’s age on the class date. An 11-year-old who will have turned 12 by the date they attend belongs in the 12–15 group. Children ages 6–7 who want a coached movement class can try beginner gymnastics with Tornadoes and work on balance, rolls, and controlled landings.',
            links: [
              { href: '/gymnastics#first-visit', label: 'Find a beginner gymnastics trial for ages 6–7', analyticsKey: 'read_gymnastics_first_visit' },
              { href: `${BOWIE_YOUTH_SPORTS_GUIDE.path}#fitness-without-a-team`, label: 'Compare Bowie fitness options by age', analyticsKey: 'read_bowie_youth_sports_guide' },
              { href: `${BOWIE_YOUTH_SPORTS_GUIDE.path}#high-school-sports-training`, label: 'Compare sports training for ages 16–17', analyticsKey: 'read_high_school_sports_training' },
            ],
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
            description: 'A coach might start you in a supported position with your feet on the floor. They can watch whether your shoulders stay steady as you put weight through your hands and whether you can come out of the position with control. If you used to do handstands, ask what the coach notices about your balance and alignment today.',
            link: { href: `${trainingFilm.path}#strength-and-handstand`, label: 'Watch a handstand in the Vortex training film', analyticsKey: 'watch_training_film' },
          },
          {
            id: 'adult-tumbling',
            heading: 'Working toward a tumbling skill as an adult?',
            description: 'If you want to work toward a cartwheel or another floor skill, tell your Typhoons coach and ask what to practice first. If you’re looking for a class focused on floor tumbling, compare nearby options and check their age and skill requirements.',
            link: {
              href: `${RETURNING_TO_GYMNASTICS_GUIDE.path}#nearby-adult-gymnastics`,
              label: 'Compare adult tumbling, gymnastics, and open gym near Bowie',
              analyticsKey: 'compare_adult_gymnastics_formats',
            },
          },
          {
            id: 'returning-gymnasts',
            heading: 'Returning to gymnastics',
            description: 'Tell your coach what you used to practice and what you’d like to work toward now. Start with movements you can repeat comfortably and ask what to practice before revisiting a previous skill. If you want to train on specific apparatus, check which equipment is available before choosing a class or open gym.',
            links: [
              {
                href: RETURNING_TO_GYMNASTICS_GUIDE.path,
                label: 'Read the guide to returning as an adult',
                analyticsKey: 'read_returning_to_gymnastics_guide',
              },
              {
                href: `${RETURNING_TO_GYMNASTICS_GUIDE.path}#adult-gymnastics-apparatus`,
                label: 'Find adult gymnastics with bars, beam, or vault',
                analyticsKey: 'compare_adult_gymnastics_apparatus',
              },
              {
                href: `${RETURNING_TO_GYMNASTICS_GUIDE.path}#adult-gymnastics-competition`,
                label: 'Find adult gymnastics competition options',
                analyticsKey: 'read_adult_gymnastics_competition',
              },
            ],
          },
        ],
        links: [
          { href: '/adult-gymnastics#adult-availability', label: 'Plan your first Typhoons class', analyticsKey: 'read_adult_first_visit' },
        ],
      },
      {
        id: 'adult-availability',
        heading: 'Plan your first adult gymnastics class',
        description: 'Choose an available Typhoons drop-in date. The booking list shows the class time, nonmember price, remaining spots, and whether the date accepts free trials.',
        topics: [
          { id: 'adult-registration', heading: 'Register yourself and sign your waiver', description: 'Sign in or create an account, select yourself as the participant, and complete any waiver requested during booking. Review your total before confirming.' },
          {
            id: 'adult-drop-in-confirmation',
            heading: 'How do I know my Typhoons drop-in is booked?',
            description: 'When you see “Drop-in confirmed” on the page, your place is booked. If “Drop-in payment” still appears after card checkout, select “Check payment status” when it’s available. You can check the class date and time in your confirmation email.',
            link: { href: CONTACT_INQUIRY_PATH, label: 'Ask Vortex about a drop-in booking', analyticsKey: 'inquire_adult_drop_in_booking' },
          },
          { id: 'adult-what-to-bring', heading: 'What to bring', description: 'Bring water and wear comfortable clothes you can move in. Ask Vortex before your visit if you have questions about footwear or what to bring.' },
          {
            id: 'adult-weekly-training',
            heading: 'Can I start adult gymnastics with one class a week?',
            description: 'Yes. You can start with one 90-minute Typhoons class a week. Before you leave, ask your coach which movement to revisit next class and whether they recommend any conditioning between sessions. If your schedule changes from week to week, check available drop-in dates.',
            link: { href: '/adult-gymnastics#adult-class-schedule', label: 'Check the weekly Typhoons schedule', analyticsKey: 'view_adult_weekly_training' },
          },
        ],
        links: [
          { href: ADULT_DROP_IN_HREF, label: 'Check Typhoons dates and prices', analyticsKey: 'browse_drop_ins' },
          { href: '/contact', label: 'Ask about Typhoons', analyticsKey: 'inquire' },
        ],
      },
    ],
    faqs: [
      { question: 'Is there an upper age limit for adult gymnastics?', answer: 'Typhoons is open to adults ages 18 and up, with no upper age limit. If you’re starting later in adulthood, tell your coach you’re new so they can help you choose a movement to start with.' },
      { question: 'Can I join as a beginner?', answer: 'Yes. Typhoons welcomes adults without prior gymnastics experience. Contact Vortex if you would like help choosing your starting point.' },
      { question: 'Can I try one adult gymnastics class?', answer: 'Yes. Choose an available Typhoons drop-in date to reserve one coached class without a monthly enrollment. Availability depends on the date and remaining spots.' },
      { question: 'Can I try adult gymnastics for free?', answer: 'Look for “Accepts free trials” on Typhoons dates. You can apply an unused one-time free trial during registration and review your total before confirming. Annual membership is optional for a free trial.' },
      { question: 'How do I enroll in recurring Typhoons classes?', answer: 'Choose See recurring class times to check the current schedule and begin enrollment. If there are no classes available online, contact Vortex for help.' },
    ],
    relatedPaths: ['/gymnastics', '/fit-and-flip'],
  },
}
