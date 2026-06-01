export interface Faq {
  question: string
  answer: string
}

/** Home/FAQ content. Rendered visibly on the homepage AND used for FAQPage schema. */
export const HOME_FAQS: Faq[] = [
  {
    question: 'Where are you located?',
    answer:
      'Our facility is located at 4961 Tesla Dr, Ste E, Bowie, MD 20715. We serve athletes across Bowie and central Maryland, including Crofton, Mitchellville, Upper Marlboro, and Prince George\u2019s and Anne Arundel Counties.',
  },
  {
    question: 'What ages do you serve?',
    answer:
      "We offer programs for athletes of all ages, from preschoolers (2-5 years) to adults. Our training is tailored to each age group's developmental needs.",
  },
  {
    question: 'Do I need gymnastics experience to register for gymnastics classes?',
    answer:
      'No prior gymnastics experience is required! Our programs will teach your athlete fundamentals, reinforce proper technique, and press toward advanced skills as the athlete progresses.',
  },
  {
    question: 'Is Vortex solely a gymnastics studio?',
    answer:
      'No. We offer a lot more than just gymnastics. Vortex is a full athletic development studio. We recognize, however, that gymnastics are a core component to athleticism and incorporate tumbling and body awareness into our strength, conditioning, and fitness regimens.',
  },
  {
    question: 'What makes Vortex different from other gyms?',
    answer:
      'Vortex combines rigorous gymnastics training with cutting-edge technology (high-speed cameras, force plates, AI analysis) and a science-backed approach to develop all 8 tenets of athleticism. We focus on transforming athletes, not just training them.',
  },
  {
    question: 'What programs do you offer?',
    answer:
      'We offer competitive teams in Trampoline & Tumbling, Artistic Gymnastics, and Rhythmic Gymnastics, plus our Athleticism Accelerator program for cross-sport development, developmental classes, ninja classes, and private coaching.',
  },
  {
    question: 'What is the "Fail your way to success" mindset?',
    answer:
      'We teach children to find fun in overcoming adversity and achieving success through a competitive edge. Our athletes are simultaneously pushed and cared for, learning resilience that fuels excellence in every aspect of life.',
  },
]
