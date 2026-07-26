const EXERCISE_PROFICIENCY_CLASSIFICATION_KEY =
  /(?:skilllevel|proficiencylevel|proficiencyclassification)/i

/**
 * Exercise cards are assessed with difficulty dimensions. Skill levels belong
 * only to skill-library cards, so any skill-level-shaped key in an exercise
 * card or its research packet is a semantic schema violation.
 */
export function findExerciseSkillLevelPaths(value) {
  const paths = []
  const seen = new WeakSet()

  function visit(current, path) {
    if (!current || typeof current !== 'object') return
    if (seen.has(current)) return
    seen.add(current)

    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`))
      return
    }

    for (const [key, item] of Object.entries(current)) {
      const itemPath = path ? `${path}.${key}` : key
      const normalizedKey = key.replace(/[^a-z0-9]/gi, '')
      if (EXERCISE_PROFICIENCY_CLASSIFICATION_KEY.test(normalizedKey)) {
        paths.push(itemPath)
      }
      visit(item, itemPath)
    }
  }

  visit(value, '')
  return paths
}
