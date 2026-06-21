import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { PublicProgramOffered } from '../../utils/publicClassesApi'
import { formatAgeRange, formatSkillLevel } from '../../utils/classDisplayUtils'

interface ClassesOfferedListProps {
  programs: PublicProgramOffered[]
  /** Animate cards into view on scroll. Disable inside tabs/modals where whileInView is unreliable. */
  animate?: boolean
  /** Wrapper layout classes. Defaults to the public Read Board layout. */
  className?: string
}

const ClassesOfferedList = ({
  programs,
  animate = true,
  className = 'space-y-8 max-w-5xl mx-auto',
}: ClassesOfferedListProps) => {
  return (
    <div className={className}>
      {programs.map((group, groupIndex) => (
        <motion.div
          key={group.id}
          className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 md:p-8 border-2 border-gray-200"
          {...(animate
            ? {
                initial: { opacity: 0, y: 30 },
                whileInView: { opacity: 1, y: 0 },
                transition: { delay: groupIndex * 0.1, duration: 0.6 },
                viewport: { once: true },
              }
            : {})}
        >
          <h3 className="text-2xl font-display font-bold text-vortex-red mb-4">
            {group.displayName}
          </h3>
          {group.description && (
            <p className="text-gray-700 mb-6 leading-relaxed">{group.description}</p>
          )}
          <div className="space-y-6">
            {group.classes.map((classItem) => (
              <div
                key={classItem.id}
                className="border-l-4 border-vortex-red pl-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-semibold text-black mb-2">
                    {classItem.displayName}
                  </h4>
                  {classItem.description && (
                    <p className="text-gray-700 leading-relaxed mb-3">{classItem.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    <span>
                      <span className="font-medium text-gray-800">Age: </span>
                      {formatAgeRange(classItem.ageMin, classItem.ageMax)}
                    </span>
                    <span>
                      <span className="font-medium text-gray-800">Skill level: </span>
                      {formatSkillLevel(classItem.skillLevel)}
                    </span>
                  </div>
                  {classItem.skillRequirements && (
                    <p className="text-sm text-gray-600 mt-2">
                      <span className="font-medium text-gray-800">Requirements: </span>
                      {classItem.skillRequirements}
                    </p>
                  )}
                </div>
                {classItem.signupUrl != null && (
                  <Link
                    to={classItem.signupUrl}
                    className="shrink-0 inline-flex items-center justify-center px-5 py-2.5 rounded-lg font-semibold text-sm text-white bg-vortex-red hover:bg-red-700 transition-colors"
                  >
                    Sign Up
                  </Link>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export default ClassesOfferedList
