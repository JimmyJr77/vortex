import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Heart,
  Music,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'

export const JACKRABBIT_URL = 'https://app3.jackrabbitclass.com/regv2.asp?id=557920'

export interface DisciplineTheme {
  heroGradient: string
  heroHighlight: string
  enrollButton: string
  whatIsAccent: string
  iconBg: string
  iconColor: string
  skillsGradient: string
  skillsCheck: string
}

export interface DisciplineBenefit {
  icon: LucideIcon
  title: string
  description: string
}

export interface DisciplinePathwayLink {
  label: string
  to: string
}

export interface DisciplineLandingConfig {
  slug: string
  title: string
  shortName: string
  heroTitle: string
  heroHighlight: string
  heroDescription: string
  whatIsTitle: string
  intro: string
  benefits: DisciplineBenefit[]
  skillAreas: string[]
  heroImage: string
  theme: DisciplineTheme
  readyCta: string
  pathwayLinks?: DisciplinePathwayLink[]
}

export const ACRO_LANDING: DisciplineLandingConfig = {
  slug: 'acro-gymnastics',
  title: 'Acrobatic Gymnastics (Acro)',
  shortName: 'Acro',
  heroTitle: 'Balance. Trust.',
  heroHighlight: 'Lift Together.',
  heroDescription:
    'Acrobatic Gymnastics (Acro) at Vortex Gymnastics in Bowie, MD combines partner balances, dynamic skills, and group choreography — building strength, flexibility, and teamwork through the Athleticism Accelerator™.',
  whatIsTitle: 'Acro',
  intro:
    'Acrobatic gymnastics is a discipline where athletes work in pairs or groups to perform balances, lifts, and dynamic elements set to music. It demands extraordinary trust, timing, and body control — the same foundations that power success in every sport.',
  benefits: [
    {
      icon: Users,
      title: 'Trust & Teamwork',
      description:
        'Partner and group skills teach communication, timing, and shared responsibility — on and off the floor.',
    },
    {
      icon: Shield,
      title: 'Safe Progressions',
      description:
        'Structured progressions build strength and flexibility before advanced lifts, balances, and dynamic elements.',
    },
    {
      icon: Target,
      title: 'Body Control',
      description:
        'Develops precision in handstands, balances, and landings that transfer to artistic, cheer, and tumbling.',
    },
    {
      icon: Zap,
      title: 'Athleticism Accelerator',
      description:
        'Integrated strength, flexibility, and coordination work through Vortex’s eight tenets of athleticism.',
    },
    {
      icon: Heart,
      title: 'Confidence & Expression',
      description:
        'Athletes learn to perform with poise under pressure — supporting partners and showcasing artistry together.',
    },
  ],
  skillAreas: [
    'Partner balances & lifts',
    'Handstand and line work',
    'Dynamic tumbling connections',
    'Group pyramids & formations',
    'Flexibility & strength for bases and tops',
  ],
  heroImage: '/tumbling.jpeg',
  theme: {
    heroGradient: 'from-cyan-950 via-gray-900 to-black',
    heroHighlight: 'text-cyan-400',
    enrollButton: 'bg-cyan-500 hover:bg-cyan-400',
    whatIsAccent: 'text-cyan-600',
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-700',
    skillsGradient: 'from-cyan-600 to-teal-800',
    skillsCheck: 'text-cyan-200',
  },
  readyCta: 'Ready to start Acro?',
}

export const ARTISTIC_LANDING: DisciplineLandingConfig = {
  slug: 'artistic-gymnastics',
  title: 'Artistic Gymnastics',
  shortName: 'Artistic',
  heroTitle: 'Master Movement. Build Strength.',
  heroHighlight: 'Elevate Artistry.',
  heroDescription:
    'Artistic gymnastics at Vortex Gymnastics in Bowie, MD is the foundation of athletic mastery — vault, bars, beam, and floor with grace, strength, flexibility, and control through the Athleticism Accelerator™.',
  whatIsTitle: 'Artistic Gymnastics',
  intro:
    'Artistic gymnastics combines apparatus work and floor exercise into a complete expression of human movement. Athletes develop power, precision, and artistry while building skills that transfer to every sport and life.',
  benefits: [
    {
      icon: Zap,
      title: 'Faster Skill Development',
      description:
        'Increased apparatus exposure accelerates learning through more repetitions and muscle memory.',
    },
    {
      icon: Target,
      title: 'Coordination & Control',
      description:
        'Enhanced balance, spatial awareness, and body control through progressive skill building.',
    },
    {
      icon: Shield,
      title: 'Safe Progressions',
      description:
        'Progressive conditioning and proper form precede difficulty, keeping athletes safe.',
    },
    {
      icon: Sparkles,
      title: 'Artistic Confidence',
      description:
        'Build self-expression and artistic flair through mastery of movement.',
    },
    {
      icon: Activity,
      title: 'Multi-Sport Foundation',
      description:
        'Transferable skills that enhance performance across all athletic disciplines.',
    },
  ],
  skillAreas: [
    'Vault power and flight',
    'Bars swings, releases & dismounts',
    'Beam balance & acro series',
    'Floor tumbling & dance',
    'Strength, flexibility & form',
  ],
  heroImage: '/gymnastics.jpeg',
  theme: {
    heroGradient: 'from-red-950 via-gray-900 to-black',
    heroHighlight: 'text-red-400',
    enrollButton: 'bg-vortex-red hover:bg-red-700',
    whatIsAccent: 'text-vortex-red',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-700',
    skillsGradient: 'from-vortex-red to-red-800',
    skillsCheck: 'text-red-200',
  },
  readyCta: 'Ready to start Artistic Gymnastics?',
  pathwayLinks: [
    { label: 'Early Development (Ages 2–5)', to: '/artistic-gymnastics-early' },
    { label: 'Ages 6–12', to: '/artistic-gymnastics-6-12' },
    { label: 'Ages 13–18', to: '/artistic-gymnastics-13-18' },
  ],
}

export const RHYTHMIC_LANDING: DisciplineLandingConfig = {
  slug: 'rhythmic-gymnastics',
  title: 'Rhythmic Gymnastics',
  shortName: 'Rhythmic',
  heroTitle: 'Grace in Motion.',
  heroHighlight: 'Strength in Every Line.',
  heroDescription:
    'Rhythmic gymnastics at Vortex Gymnastics in Bowie, MD blends athletic precision and artistic flow — choreography, flexibility, and apparatus control with strength and stability through the Athleticism Accelerator™.',
  whatIsTitle: 'Rhythmic Gymnastics',
  intro:
    'Rhythmic gymnastics combines dance, flexibility, and apparatus mastery (ribbon, hoop, ball, clubs, rope). Athletes develop posture, timing, and expressive performance in a discipline that builds the complete athlete.',
  benefits: [
    {
      icon: Sparkles,
      title: 'Posture & Spatial Awareness',
      description:
        'Develops exceptional body awareness, posture, and understanding of space through rhythmic movement.',
    },
    {
      icon: Music,
      title: 'Fine Motor Control',
      description:
        'Builds precise timing, dexterity, and apparatus control through repetitive skill practice.',
    },
    {
      icon: Heart,
      title: 'Confidence & Expression',
      description:
        'Enhances self-expression and artistic confidence through choreographed performances.',
    },
    {
      icon: Zap,
      title: 'Athleticism Accelerator',
      description:
        'Reinforces strength and coordination through integrated tenets-based training.',
    },
    {
      icon: Target,
      title: 'Multi-Sport Transfer',
      description:
        'Creates a physical foundation transferable to dance, cheer, and acrobatics.',
    },
  ],
  skillAreas: [
    'Ribbon, hoop, ball, clubs & rope',
    'Flexibility & leaps',
    'Choreography & musicality',
    'Balance & turns',
    'Strength for apparatus control',
  ],
  heroImage: '/gymnastics.jpeg',
  theme: {
    heroGradient: 'from-purple-950 via-gray-900 to-black',
    heroHighlight: 'text-purple-400',
    enrollButton: 'bg-purple-600 hover:bg-purple-500',
    whatIsAccent: 'text-purple-600',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-700',
    skillsGradient: 'from-purple-600 to-purple-900',
    skillsCheck: 'text-purple-200',
  },
  readyCta: 'Ready to start Rhythmic Gymnastics?',
}

export const TRAMPOLINE_LANDING: DisciplineLandingConfig = {
  slug: 'trampoline-tumbling',
  title: 'Trampoline & Tumbling',
  shortName: 'Trampoline & Tumbling',
  heroTitle: 'Bounce Higher. Land Stronger.',
  heroHighlight: 'Tumble Smarter.',
  heroDescription:
    'Trampoline & tumbling at Vortex Gymnastics in Bowie, MD develops air awareness and body control — trampoline, tumbling, and double-mini from safe landings to routine construction through the Athleticism Accelerator™.',
  whatIsTitle: 'Trampoline & Tumbling',
  intro:
    'This discipline trains athletes to understand flight, rotation, and landing mechanics. Progressive skill development builds confidence in the air while emphasizing safe shapes, spotting, and competition-ready routines.',
  benefits: [
    {
      icon: TrendingUp,
      title: 'Air Awareness',
      description:
        'Develops spatial orientation and timing essential for tumbling, diving, and acrobatic sports.',
    },
    {
      icon: Shield,
      title: 'Safe Landings First',
      description:
        'Structured progressions prioritize shapes, rebounds, and spotting before advanced skills.',
    },
    {
      icon: Zap,
      title: 'Power & Explosiveness',
      description:
        'Builds leg drive and core stability for higher jumps and stronger tumbling passes.',
    },
    {
      icon: Target,
      title: 'Routine Construction',
      description:
        'Athletes learn to link skills into competitive trampoline and tumbling routines.',
    },
    {
      icon: Activity,
      title: 'Athleticism Accelerator',
      description:
        'Integrated strength, coordination, and body control across all eight tenets.',
    },
  ],
  skillAreas: [
    'Trampoline basics & routines',
    'Tumbling passes & connections',
    'Double-mini mount-dismount sequences',
    'Safe landings & shapes',
    'Strength for takeoff & control',
  ],
  heroImage: '/tumbling.jpeg',
  theme: {
    heroGradient: 'from-amber-950 via-gray-900 to-black',
    heroHighlight: 'text-amber-400',
    enrollButton: 'bg-amber-600 hover:bg-amber-500',
    whatIsAccent: 'text-amber-600',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    skillsGradient: 'from-amber-600 to-amber-900',
    skillsCheck: 'text-amber-200',
  },
  readyCta: 'Ready to start Trampoline & Tumbling?',
}

export const AEROBIC_LANDING: DisciplineLandingConfig = {
  slug: 'aerobic-gymnastics',
  title: 'Aerobic Gymnastics',
  shortName: 'Aerobic',
  heroTitle: 'Power. Precision.',
  heroHighlight: 'Performance.',
  heroDescription:
    'Aerobic gymnastics at Vortex Gymnastics in Bowie, MD delivers high-energy routines combining dynamic strength, flexibility, and continuous movement — building fitness, coordination, and show-stopping performances.',
  whatIsTitle: 'Aerobic Gymnastics',
  intro:
    'Aerobic gymnastics features fast-paced, music-driven routines that demand cardiovascular fitness, agility, and precise execution. Athletes develop endurance, teamwork, and performance quality in individual or group settings.',
  benefits: [
    {
      icon: Heart,
      title: 'Cardiovascular Fitness',
      description:
        'Continuous movement patterns build endurance and athletic stamina.',
    },
    {
      icon: Zap,
      title: 'Dynamic Strength',
      description:
        'Combines explosive elements with controlled landings and transitions.',
    },
    {
      icon: Users,
      title: 'Team & Individual Options',
      description:
        'Perform solo or in groups — ideal for athletes who thrive on energy and expression.',
    },
    {
      icon: Target,
      title: 'Coordination & Timing',
      description:
        'Sharp choreography develops rhythm, precision, and performance discipline.',
    },
    {
      icon: Activity,
      title: 'Athleticism Accelerator',
      description:
        'Full-body conditioning aligned with Vortex’s eight tenets of athleticism.',
    },
  ],
  skillAreas: [
    'Dynamic strength elements',
    'Flexibility & splits',
    'Continuous movement patterns',
    'Group synchronization',
    'Performance & presentation',
  ],
  heroImage: '/multisport.jpeg',
  theme: {
    heroGradient: 'from-rose-950 via-gray-900 to-black',
    heroHighlight: 'text-rose-400',
    enrollButton: 'bg-rose-600 hover:bg-rose-500',
    whatIsAccent: 'text-rose-600',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-700',
    skillsGradient: 'from-rose-600 to-rose-900',
    skillsCheck: 'text-rose-200',
  },
  readyCta: 'Ready to start Aerobic Gymnastics?',
}
