import { ATHLETIC_DEVELOPMENT_GUIDE } from './athleticDevelopmentGuide'
import { BOWIE_YOUTH_SPORTS_GUIDE } from './bowieYouthSportsGuide'
import { GYMNASTICS_VS_TUMBLING_GUIDE } from './gymnasticsVsTumblingGuide'
import { PRESCHOOL_GYMNASTICS_GUIDE } from './preschoolGymnasticsGuide'
import { RETURNING_TO_GYMNASTICS_GUIDE } from './returningToGymnasticsGuide'

export const PUBLIC_GUIDES = [
  { ...ATHLETIC_DEVELOPMENT_GUIDE, topicLabel: 'Youth athletic development' },
  { ...BOWIE_YOUTH_SPORTS_GUIDE, topicLabel: 'Bowie youth sports' },
  { ...PRESCHOOL_GYMNASTICS_GUIDE, topicLabel: 'Preschool gymnastics' },
  { ...GYMNASTICS_VS_TUMBLING_GUIDE, topicLabel: 'Gymnastics vs. tumbling' },
  { ...RETURNING_TO_GYMNASTICS_GUIDE, topicLabel: 'Returning as an adult' },
]
